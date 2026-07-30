import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";

export default defineConfig(
  {
    ignores: ["baseline.ts", "dist/**", "seed-entry.ts", "seed.ts"],
  },
  baseConfig,
);
