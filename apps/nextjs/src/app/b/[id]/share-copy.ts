/**
 * Everything the share surfaces need to decide *what* to say about a record.
 *
 * Kept free of database and framework imports so the page, the two generated
 * images, and the tests can all read from one place — and so the wording and
 * URL rules can be exercised without a running Postgres.
 */

/** The subset of a content record the share surfaces actually read. */
export interface ShareableContent {
  id: string;
  type: string;
  title: string;
  description: string;
  billNumber?: string;
  imageUri?: string;
  thumbnailUrl?: string;
  /** Bills carry a structured brief; nothing else does yet. */
  brief?: unknown;
}

/* ---------- urls ---------- */

/** Trailing UUID of a `/b/…` segment, with or without a leading title slug. */
const TRAILING_UUID =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * The content id inside a URL segment.
 *
 * Links are shared as `/b/<slug>-<uuid>` so the URL says what it opens, but the
 * app mints bare `/b/<uuid>` links and an old link keeps whatever slug it was
 * shared with — including one from a title that has since been corrected. The
 * id is the only part that has to be right, so it is the only part that is
 * read.
 */
export function contentIdFromSegment(segment: string): string | null {
  return TRAILING_UUID.exec(segment)?.[1]?.toLowerCase() ?? null;
}

/** The canonical `<slug>-<uuid>` segment for a piece of content. */
export function shareSegment(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
  return slug ? `${slug}-${id}` : id;
}

/* ---------- presentation ---------- */

export interface TypePresentation {
  /** Badge text. */
  label: string;
  /** What kind of record this is, for the reader who arrived cold. */
  kind: string;
  /** Content-type accent, matching the app's `contentType` palette. */
  color: string;
}

/** Also the fallback: an unrecognised type is a briefing, not a crash. */
const GENERAL: TypePresentation = {
  label: "NEWS",
  kind: "Briefing",
  color: "#8A8FA0",
};

const TYPES: Record<string, TypePresentation | undefined> = {
  bill: { label: "BILL", kind: "Legislation", color: "#4A7CFF" },
  government_content: {
    label: "ORDER",
    kind: "Executive action",
    color: "#6366F1",
  },
  court_case: { label: "CASE", kind: "Court case", color: "#0891B2" },
  general: GENERAL,
};

export function presentType(type: string): TypePresentation {
  return TYPES[type] ?? GENERAL;
}

/** The header image the app would show, if there is one. */
export function headerImage(content: ShareableContent): string | undefined {
  return content.imageUri ?? content.thumbnailUrl;
}

/* ---------- copy ---------- */

/**
 * Strips the `**bold**` spans briefs use for scan emphasis.
 *
 * Brief prose is written for a renderer that understands those markers. Meta
 * descriptions, OG cards, and story images have no way to draw them, and
 * leaving the asterisks in shows the reader our markup.
 */
export function plainText(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

/**
 * `value` shortened to `limit` characters, cut on a word boundary.
 *
 * Falls back to a hard cut when the last space is near the start, so a single
 * very long token cannot collapse the result to almost nothing.
 */
export function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}

/**
 * The one sentence this record is worth sharing for.
 *
 * A bill's brief opens with a purpose-written standalone summary, which beats
 * the scraped description every time. Everything else falls back to the
 * description the app itself shows.
 */
export function shareSummary(content: ShareableContent): string {
  const brief = content.brief;
  const summary =
    brief && typeof brief === "object" && "summary" in brief
      ? (brief.summary as string | undefined)
      : undefined;

  return plainText(summary ?? content.description);
}
