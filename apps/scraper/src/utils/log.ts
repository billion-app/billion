function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export function log(scraper: string, message: string): void {
  console.log(`[${timestamp()}] [${scraper}] ${message}`);
}

export function logError(scraper: string, message: string, error?: unknown): void {
  console.error(`[${timestamp()}] [${scraper}] ERROR: ${message}`, error ?? "");
}

export function logWarn(scraper: string, message: string): void {
  console.warn(`[${timestamp()}] [${scraper}] WARN: ${message}`);
}
