/**
 * Progress bar for scraper runs using @clack/prompts.
 */

import { progress as clackProgress, type ProgressResult } from "@clack/prompts";

let bar: ProgressResult | null = null;
let expectedTotal = 0;
let completed = 0;
let stats = { newEntries: 0, unchanged: 0, changed: 0, ai: 0 };

function formatMessage(): string {
  return `new:${stats.newEntries} unchanged:${stats.unchanged} changed:${stats.changed} ai:${stats.ai}`;
}

function ensureBar(): ProgressResult {
  if (!bar) {
    bar = clackProgress({ max: expectedTotal });
    bar.start("Processing...");
  }
  return bar;
}

export function addExpectedTotal(total: number): void {
  expectedTotal += total;
}

export function tickProgress(update: Partial<typeof stats>): void {
  completed++;
  stats.newEntries += update.newEntries ?? 0;
  stats.unchanged += update.unchanged ?? 0;
  stats.changed += update.changed ?? 0;
  stats.ai += update.ai ?? 0;
  ensureBar().advance(1, formatMessage());
}

export function tickAI(): void {
  stats.ai++;
  bar?.message(formatMessage());
}

export function stopProgress(): void {
  if (bar) {
    bar.stop(`Done (${completed}/${expectedTotal}) ${formatMessage()}`);
    bar = null;
  }
}

export function resetProgress(): void {
  if (bar) {
    bar.stop();
    bar = null;
  }
  expectedTotal = 0;
  completed = 0;
  stats = { newEntries: 0, unchanged: 0, changed: 0, ai: 0 };
}
