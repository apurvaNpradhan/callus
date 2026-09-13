import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { initLogger } from "evlog";
import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";
import { createFsDrain } from "evlog/fs";
import { evlog, type EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "@callus/api/context";
import { appRouter } from "@callus/api/routers/index";
import { auth } from "@callus/auth";
import { applyItemOperations, closeDatabase } from "@callus/db";
import { env } from "@callus/env/server";

import { uploadPayloadSchema } from "./powersync-contract";

initLogger({
  env: { service: "callus-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

export const app = new Hono<EvlogVariables>();

app.use(evlog({ drain: env.NODE_ENV === "production" ? undefined : createFsDrain() }));
app.use("*", async (c, next) => {
  await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
  await next();
});

app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

async function getSession(c: { req: { raw: Request } }) {
  return auth.api.getSession({ headers: c.req.raw.headers });
}

app.get("/powersync/credentials", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const result = await auth.api.getToken({ headers: c.req.raw.headers });
  if (!result?.token) return c.json({ error: "Unable to issue PowerSync token" }, 503);

  return c.json({ endpoint: env.POWERSYNC_URL, token: result.token });
});

app.post("/powersync/upload", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ ok: false, error: "Unauthorized" }, 200);

  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > 64_000) return c.json({ ok: false, error: "Payload too large" }, 200);

  let parsed: ReturnType<typeof uploadPayloadSchema.safeParse>;
  try {
    parsed = uploadPayloadSchema.safeParse(await c.req.json());
  } catch {
    return c.json({ ok: false, error: "Invalid JSON" }, 200);
  }
  if (!parsed.success) return c.json({ ok: false, error: "Invalid upload payload" }, 200);

  const rejected: string[] = [];
  try {
    const operations = parsed.data.operations.map((operation) => {
      if (operation.op === "DELETE") return operation;
      if (operation.op === "PUT")
        return { id: operation.id, op: operation.op, title: operation.opData.title };
      return { id: operation.id, op: operation.op, title: operation.opData.title };
    });
    rejected.push(...(await applyItemOperations(session.user.id, operations)));
  } catch (error) {
    c.get("log").error(error instanceof Error ? error : new Error(String(error)));
    return c.json({ ok: false, error: "Temporary database failure" }, 503);
  }

  return c.json({ ok: true, rejected });
});

const openapiGenerator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferenceHandlerPlugin({
      provider: "scalar",
      spec: () =>
        openapiGenerator.generate(appRouter, {
          base: {
            info: { title: "Callus API", version: "0.0.0" },
            servers: [{ url: "/api-reference" }],
          },
        }),
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter);

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

import { serve } from "@hono/node-server";

export function createApp() {
  return app;
}

export async function startServer() {
  const server = serve({
    fetch: createApp().fetch,
    port: env.PORT,
  });

  const shutdown = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }).finally(closeDatabase);

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}

const isMainModule = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;

if (isMainModule) {
  void startServer();
}
