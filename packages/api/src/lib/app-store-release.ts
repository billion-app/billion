import { z } from "zod/v4";

const APP_ID = 6761675243;
const APP_STORE_URL = "https://apps.apple.com/us/app/billion-news/id6761675243";
const version = z.string().regex(/^\d{1,5}(?:\.\d{1,5}){0,2}$/);
const lookupSchema = z.object({
  results: z.array(
    z.object({
      trackId: z.number(),
      bundleId: z.string(),
      version,
      minimumOsVersion: version,
    }),
  ),
});

/** Only public releases of our app qualify; TestFlight builds aren't listed. */
export async function fetchAppStoreRelease(fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher(
      `https://itunes.apple.com/lookup?id=${APP_ID}&country=us`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return null;
    const parsed = lookupSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const app = parsed.data.results.find(
      (result) =>
        result.trackId === APP_ID &&
        result.bundleId === "app.billion-news.billion",
    );
    return app
      ? {
          version: app.version,
          minimumOsVersion: app.minimumOsVersion,
          url: APP_STORE_URL,
        }
      : null;
  } catch {
    // An unavailable store must never interrupt reading or invent an update.
    return null;
  }
}

let cached:
  | Promise<Awaited<ReturnType<typeof fetchAppStoreRelease>>>
  | undefined;
let expiresAt = 0;

export function getAppStoreRelease() {
  if (!cached || Date.now() >= expiresAt) {
    expiresAt = Date.now() + 60 * 60 * 1000;
    cached = fetchAppStoreRelease().then((release) => {
      if (!release) expiresAt = Date.now() + 5 * 60 * 1000;
      return release;
    });
  }
  return cached;
}
