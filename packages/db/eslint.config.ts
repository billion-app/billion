import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**", "migrate-images.ts", "migrate-images-to-storage.ts"],
  },
  baseConfig,
);
