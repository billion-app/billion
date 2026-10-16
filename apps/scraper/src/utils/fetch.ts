import { createLogger } from "./log.js";

const logger = createLogger("fetch");

export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  timeoutMs?: number;
}

// Per-host backoff: when a host returns 429/503, all subsequent requests
// to that host wait before firing. Starts at 0 (no delay), ramps up on
// rate-limit responses, decays back to 0 on success.
const hostBackoff = new Map<string, number>();

function getHost(url: string): string {
  return new URL(url).host;
}

async function applyBackoff(host: string): Promise<void> {
  const delay = hostBackoff.get(host);
  if (delay && delay > 0) {
    logger.info(`Backing off ${host} for ${(delay / 1000).toFixed(1)}s`);
    await new Promise((r) => setTimeout(r, delay));
  }
}

function increaseBackoff(host: string): void {
  const current = hostBackoff.get(host) ?? 0;
  hostBackoff.set(host, Math.max(current * 2, 1000));
}

function decreaseBackoff(host: string): void {
  const current = hostBackoff.get(host);
  if (!current) return;
  const next = Math.floor(current / 2);
  if (next < 250) {
    hostBackoff.delete(host);
  } else {
    hostBackoff.set(host, next);
  }
}

const RETRIABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function networkErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const { code, cause } = error as { code?: unknown; cause?: unknown };
    if (typeof code === "string" && RETRIABLE_NETWORK_CODES.has(code))
      return code;
    error = cause;
  }
  return undefined;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 30_000, ...fetchOptions } = options;
  const host = getHost(url);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await applyBackoff(host);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: fetchOptions.signal
          ? AbortSignal.any([controller.signal, fetchOptions.signal])
          : controller.signal,
      });

      if (res.ok) {
        decreaseBackoff(host);
        return res;
      }

      const isRetriable = res.status === 429 || res.status >= 500;
      if (isRetriable && attempt < maxRetries) {
        increaseBackoff(host);

        let delayMs = 1000 * Math.pow(2, attempt);

        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const seconds = Number(retryAfter);
          if (!Number.isNaN(seconds)) {
            delayMs = Math.max(delayMs, seconds * 1000);
          } else {
            const retryDate = Date.parse(retryAfter);
            if (!Number.isNaN(retryDate)) {
              const diff = retryDate - Date.now();
              if (diff > 0) delayMs = Math.max(delayMs, diff);
            }
          }
        }

        logger.warn(
          `HTTP ${res.status} from ${host}, retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw new Error(`HTTP ${res.status}: ${url}`);
    } catch (err: unknown) {
      if (fetchOptions.signal?.aborted) throw err;
      if (controller.signal.aborted) {
        if (attempt < maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt);
          logger.warn(
            `Timeout for ${host}, retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
      }
      const code = networkErrorCode(err);
      if (attempt < maxRetries && code) {
        const delayMs = 1000 * Math.pow(2, attempt);
        logger.warn(
          `${code} from ${host}, retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Failed after ${maxRetries + 1} attempts: ${url}`);
}
