import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const defaultScreenshotsDir = resolve(packageRoot, "screenshots");
export const defaultInstagramPostsDir = resolve(packageRoot, "instagram-posts");

export function resolvePackagePath(value: string, fallback: string): string {
  return isAbsolute(value) ? value : resolve(packageRoot, value || fallback);
}
