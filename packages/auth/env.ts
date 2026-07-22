import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

import { envSchemas } from "@acme/env";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_DISCORD_ID: envSchemas.AUTH_DISCORD_ID!,
      AUTH_DISCORD_SECRET: envSchemas.AUTH_DISCORD_SECRET!,
      BETTER_AUTH_SECRET: envSchemas.BETTER_AUTH_SECRET!,
      NODE_ENV: z.enum(["development", "production"]).optional(),
    },
    experimental__runtimeEnv: {},
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
