import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const defaultRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export function loadRepoEnv(rootDirectory = defaultRoot) {
  return config({
    path: [
      resolve(rootDirectory, ".env.local"),
      resolve(rootDirectory, ".env"),
    ],
    override: false,
    quiet: true,
  });
}
