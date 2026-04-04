/**
 * npm-style progress bar that stays pinned at the bottom of the terminal.
 * Log lines from consola (or anything writing to stdout/stderr) render above it.
 */

const isTTY = process.stderr.isTTY;

let expectedTotal = 0;
let completed = 0;
let stats = { newEntries: 0, unchanged: 0, changed: 0, ai: 0 };
let active = false;

// Store originals before patching
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

function columns(): number {
  return process.stderr.columns || 80;
}

function renderBar(): string {
  const pct = expectedTotal > 0 ? completed / expectedTotal : 0;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  const counters = `${completed}/${expectedTotal}  new:${stats.newEntries} unchanged:${stats.unchanged} changed:${stats.changed} ai:${stats.ai}`;
  const suffix = ` ${pctStr} ${counters}`;
  // Bar fills remaining space. ANSI codes don't take visual width.
  const barWidth = Math.max(10, columns() - suffix.length);
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return `\x1b[36m${bar}\x1b[0m${suffix}`;
}

function clearLine() {
  // Move to column 0, clear entire line
  originalStderrWrite("\x1b[G\x1b[2K");
}

function drawBar() {
  if (!active || !isTTY) return;
  clearLine();
  originalStderrWrite(renderBar());
}

/** Intercept writes to clear bar, emit content, then redraw */
function patchStream(
  target: NodeJS.WriteStream,
  originalWrite: typeof process.stdout.write,
) {
  // biome-ignore lint/suspicious/noExplicitAny: patching low-level write
  (target as any).write = (
    chunk: Uint8Array | string,
    // biome-ignore lint/suspicious/noExplicitAny: matching Node's overloaded write signature
    ...args: any[]
  ): boolean => {
    if (!active || !isTTY) {
      return originalWrite(chunk, ...args);
    }
    // Clear the bar, print the log content, then redraw bar on a fresh line
    clearLine();
    const result = originalWrite(chunk, ...args);
    const str = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
    // Redraw bar after complete lines
    if (str.endsWith("\n")) {
      drawBar();
    }
    return result;
  };
}

function unpatchStream(
  target: NodeJS.WriteStream,
  originalWrite: typeof process.stdout.write,
) {
  // biome-ignore lint/suspicious/noExplicitAny: restoring low-level write
  (target as any).write = originalWrite;
}

function start() {
  if (active || !isTTY) return;
  active = true;
  patchStream(process.stdout, originalStdoutWrite);
  patchStream(process.stderr, originalStderrWrite);
  drawBar();
}

export function addExpectedTotal(total: number): void {
  expectedTotal += total;
  if (!active && expectedTotal > 0) start();
  else drawBar();
}

export function tickProgress(update: Partial<typeof stats>): void {
  completed++;
  stats.newEntries += update.newEntries ?? 0;
  stats.unchanged += update.unchanged ?? 0;
  stats.changed += update.changed ?? 0;
  stats.ai += update.ai ?? 0;
  if (!active && expectedTotal > 0) start();
  else drawBar();
}

export function tickAI(): void {
  stats.ai++;
  drawBar();
}

export function stopProgress(): void {
  if (!active) return;
  clearLine();
  active = false;
  unpatchStream(process.stdout, originalStdoutWrite);
  unpatchStream(process.stderr, originalStderrWrite);
  // Print final summary line using unpatched write
  const pct = expectedTotal > 0 ? Math.round((completed / expectedTotal) * 100) : 100;
  originalStderrWrite(
    `\x1b[32mDone\x1b[0m (${completed}/${expectedTotal}, ${pct}%) new:${stats.newEntries} unchanged:${stats.unchanged} changed:${stats.changed} ai:${stats.ai}\n`,
  );
}

export function resetProgress(): void {
  if (active) {
    clearLine();
    active = false;
    unpatchStream(process.stdout, originalStdoutWrite);
    unpatchStream(process.stderr, originalStderrWrite);
  }
  expectedTotal = 0;
  completed = 0;
  stats = { newEntries: 0, unchanged: 0, changed: 0, ai: 0 };
}
