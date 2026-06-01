/**
 * Shared, defensive HTTP fetch for the measure scrapers.
 *
 * Every fetch is best-effort: network failures, timeouts, WAF blocks, or
 * non-200 responses yield `null`, never a throw. A realistic browser
 * User-Agent is used because some sources (e.g. Ballotpedia behind a CloudFront
 * WAF) reject bot/default UAs with a 403/202 challenge.
 */

const FETCH_TIMEOUT_MS = 12_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchText(
  url: string,
  init?: { accept?: string; ua?: string },
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: init?.accept ?? "text/html",
        "User-Agent": init?.ua ?? BROWSER_UA,
      },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  ua?: string,
): Promise<T | null> {
  const body = await fetchText(url, { accept: "application/json", ua });
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
