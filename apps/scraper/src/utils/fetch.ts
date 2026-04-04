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
        signal: controller.signal,
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

        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      throw new Error(`HTTP ${res.status}: ${url}`);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
      }
      if (attempt < maxRetries && (err?.code === "ECONNRESET" || err?.code === "ECONNREFUSED")) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Failed after ${maxRetries + 1} attempts: ${url}`);
}
