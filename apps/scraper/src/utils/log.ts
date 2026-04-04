import { consola } from "consola";
import { box, colors } from "consola/utils";

// Configure the root logger with timestamps
consola.options.formatOptions.date = true;

export type Logger = typeof consola;

export function createLogger(tag: string): Logger {
  return consola.withTag(tag);
}

export { consola as log };

export function printHeader(title: string) {
  consola.log("");
  consola.log(colors.bold(`━━━ ${title} ${"━".repeat(Math.max(0, 38 - title.length))}`));
}

export function printKeyValue(key: string, value: string | number) {
  consola.log(`  ${colors.dim(key.padEnd(24))} ${value}`);
}

export function printFooter() {
  consola.log(colors.bold("━".repeat(44)));
}

export function printBox(title: string, content: string) {
  consola.log(box(content, { title, style: { borderColor: "cyan" } }));
}
