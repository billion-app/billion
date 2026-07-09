import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export function readEnvFile(path: string): Record<string, string> {
  return existsSync(path) ? parse(readFileSync(path, "utf8")) : {};
}

export function upsertEnvValue(text: string, key: string, value: string) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.trimEnd()}\n${line}\n`;
}

export function writeEnvValues(path: string, values: Record<string, string>) {
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    text = upsertEnvValue(text, key, value);
  }
  writeFileSync(path, text, "utf8");
}
