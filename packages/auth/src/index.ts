import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins/jwt";

import { db } from "@callus/db";
import { account, jwks, session, user, verification } from "@callus/db/schema/auth";
import { env } from "@callus/env/server";

export function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: { account, session, user, verification, jwks },
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,

      "callus://",
      "exp://",
      "http://localhost:8081",
    ],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [
      expo(),
      jwt({
        jwks: {
          jwksPath: "/jwks",
          keyPairConfig: { alg: "RS256" },
        },
        jwt: {
          audience: env.POWERSYNC_URL,
          issuer: env.BETTER_AUTH_URL,
          expirationTime: "5 minutes",
        },
      }),
    ],
  });
}

export const auth = createAuth();
