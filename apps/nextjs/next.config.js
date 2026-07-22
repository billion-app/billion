import nextEnv from "@next/env";
import { withPostHogConfig } from "@posthog/nextjs-config";
import { createJiti } from "jiti";

const { loadEnvConfig } = nextEnv;
const jiti = createJiti(import.meta.url);

// Next only auto-loads env files from the app directory. Load the monorepo root
// so every workspace can continue sharing the repository-level .env file.
loadEnvConfig(
  new URL("../..", import.meta.url).pathname,
  process.env.NODE_ENV === "development",
  undefined,
  true,
);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/auth",
    "@acme/db",
    "@acme/ui",
    "@acme/validators",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

const canUploadPostHogSourceMaps =
  Boolean(process.env.POSTHOG_API_KEY) &&
  Boolean(process.env.POSTHOG_PROJECT_ID);

export default canUploadPostHogSourceMaps
  ? withPostHogConfig(config, {
      personalApiKey: process.env.POSTHOG_API_KEY ?? "",
      projectId: process.env.POSTHOG_PROJECT_ID,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      sourcemaps: {
        enabled: true,
        releaseName: "billion-nextjs",
        releaseVersion:
          process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
        deleteAfterUpload: true,
      },
    })
  : config;
