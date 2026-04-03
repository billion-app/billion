export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  timeoutMs?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 30_000, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (res.ok) return res;

      const isRetriable = res.status === 429 || res.status >= 500;
      if (isRetriable && attempt < maxRetries) {
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
