import { defineConfig } from "eslint/config";

import { baseConfig } from "@acme/eslint-config/base";
import { reactConfig } from "@acme/eslint-config/react";

export default defineConfig(
  {
    ignores: [".expo/**", "expo-plugins/**"],
  },
  baseConfig,
  reactConfig,
  {
    // node:test's it()/describe() return promises by design.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
);
