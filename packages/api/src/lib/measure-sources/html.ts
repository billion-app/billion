/**
 * Minimal HTML helpers for the measure scrapers.
 *
 * We deliberately avoid adding a DOM/cheerio dependency to @acme/api — the
 * source pages we scrape are server-rendered and the data we need can be
 * pulled out with targeted regexes. Everything here is defensive: a markup
 * change should yield empty output, never a throw.
 */

/** Strip tags, decode common entities, and collapse whitespace. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/**
 * Extract the inner content of the first element matching a tag + id/class.
 * Returns the raw inner HTML (caller can htmlToText it). Best-effort only.
 */
export function extractByAttr(
  html: string,
  attr: "id" | "class",
  value: string,
): string | null {
  // Matches <tag ... attr="...value..." ...> ... </tag>, non-greedy.
  const re = new RegExp(
    `<([a-z0-9]+)[^>]*\\b${attr}\\s*=\\s*["'][^"']*\\b${escapeRe(value)}\\b[^"']*["'][^>]*>([\\s\\S]*?)</\\1>`,
    "i",
  );
  const m = re.exec(html);
  return m?.[2] ?? null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
