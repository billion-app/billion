const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[39m`;

function timestamp(): string {
  return dim(new Date().toISOString().slice(11, 19));
}

function formatScope(scope: string): string {
  return cyan(`[${scope}]`);
}

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, err?: unknown) => void;
  success: (message: string) => void;
  step: (message: string) => void;
  dim: (message: string) => void;
}

export function createLogger(scope: string): Logger {
  const prefix = () => `${timestamp()} ${formatScope(scope)}`;

  return {
    info(message: string) {
      console.log(`${prefix()} ${message}`);
    },
    warn(message: string) {
      console.warn(`${prefix()} ${yellow("WARN")} ${message}`);
    },
    error(message: string, err?: unknown) {
      console.error(`${prefix()} ${red("ERR")}  ${message}`);
      if (err) {
        const detail =
          err instanceof Error ? err.message : String(err);
        console.error(`${prefix()} ${red("ERR")}  ${dim(detail)}`);
      }
    },
    success(message: string) {
      console.log(`${prefix()} ${green("OK")}   ${message}`);
    },
    step(message: string) {
      console.log(`${prefix()} ${magenta(">>>")}  ${message}`);
    },
    dim(message: string) {
      console.log(`${prefix()} ${dim(message)}`);
    },
  };
}

// Convenience for top-level / unscoped logging
export const log = createLogger("scraper");

export function printHeader(title: string) {
  const line = bold("━".repeat(44));
  console.log(`\n${line}`);
  console.log(bold(`  ${title}`));
  console.log(line);
}

export function printKeyValue(key: string, value: string | number) {
  console.log(`  ${dim(key.padEnd(24))} ${value}`);
}

export function printFooter() {
  console.log(bold("━".repeat(44)) + "\n");
}
