import { createEnv } from "@t3-oss/env-core";
import "dotenv/config";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    POWERSYNC_URL: z.url(),
    PS_DATABASE_URI: z.string().min(1).optional(),
    PS_DATABASE_CA_CERT: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
