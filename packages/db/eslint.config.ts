import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";

export default defineConfig(
  {
    ignores: [
      "baseline.ts",
      "dist/**",
      "seed-entry.ts",
      "seed-review.ts",
      "seed.ts",
    ],
  },
  baseConfig,
);
