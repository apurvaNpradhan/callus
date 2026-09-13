import type { Context as HonoContext } from "hono";

import { auth } from "@callus/auth";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const data = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session: data?.session,
    user: data?.user,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
