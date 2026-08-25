import "server-only";

/**
 * Brand fonts for `ImageResponse`.
 *
 * Satori has no font stack: a face is either supplied as bytes or the text is
 * drawn in its single bundled sans. Billion's identity is its serif headline,
 * so the generated share images fetch the real face — but a link preview is
 * worth more than a typeface, and every caller falls back to the bundled font
 * rather than failing to render a card.
 */

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

/**
 * Google serves woff2 to anything modern, and Satori cannot read woff2. A
 * desktop UA old enough to predate it is served plain woff instead, which
 * Satori does read.
 */
const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.116 Safari/537.36";

/**
 * Survives between renders on a warm instance so a burst of link previews
 * makes one trip to Google rather than one per image. Failures are not cached:
 * a blip must not leave an instance permanently drawing the fallback font.
 */
const cache = new Map<string, ArrayBuffer>();

async function loadGoogleFont(
  family: string,
  weight: 400 | 700,
): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}`;
    const response = await fetch(cssUrl, {
      headers: { "User-Agent": LEGACY_UA },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;

    const source = /src:\s*url\((https:\/\/[^)]+)\)/.exec(
      await response.text(),
    );
    if (!source?.[1]) return null;

    const font = await fetch(source[1], { signal: AbortSignal.timeout(4000) });
    if (!font.ok) return null;

    const data = await font.arrayBuffer();
    cache.set(key, data);
    return data;
  } catch {
    // A share image with the wrong font still previews the link. One without
    // any image does not.
    return null;
  }
}

/**
 * The two faces the share cards ask for: the display serif for headlines and
 * the UI sans for everything else. Returns only what loaded.
 */
export async function brandFonts(): Promise<OgFont[]> {
  const [serif, sansRegular, sansBold] = await Promise.all([
    loadGoogleFont("IBM Plex Serif", 700),
    loadGoogleFont("Albert Sans", 400),
    loadGoogleFont("Albert Sans", 700),
  ]);

  return [
    serif && { name: "IBM Plex Serif", data: serif, weight: 700 as const },
    sansRegular && {
      name: "Albert Sans",
      data: sansRegular,
      weight: 400 as const,
    },
    sansBold && { name: "Albert Sans", data: sansBold, weight: 700 as const },
  ]
    .filter((font) => font !== null)
    .map((font) => ({ ...font, style: "normal" as const }));
}
