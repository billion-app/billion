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
 * Turns the Markdown stored for articles into readable unformatted prose.
 * This intentionally keeps link labels and image alt text while dropping the
 * syntax that only a Markdown renderer understands.
 */
export function markdownToPlainText(value: string): string {
  return value
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, "$1.\n")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Backwards-compatible name for unformatted share copy. */
export function plainText(value: string): string {
  return markdownToPlainText(value);
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
  return plainText(rawShareSummary(content));
}

function rawShareSummary(content: ShareableContent): string {
  const brief = content.brief;
  const summary =
    brief && typeof brief === "object" && "summary" in brief
      ? (brief.summary as string | undefined)
      : undefined;

  return summary ?? content.description;
}

export interface ShareSummaryPart {
  text: string;
  emphasized: boolean;
}

/**
 * Share copy with the brief author's `**key phrase**` emphasis preserved.
 * Other Markdown is still removed, and truncation operates on visible text so
 * formatting markers never consume the card's character budget or leak out.
 */
export function shareSummaryParts(
  content: ShareableContent,
  limit: number,
): ShareSummaryPart[] {
  const emphasized: string[] = [];
  const tokenized = rawShareSummary(content).replace(
    /\*\*(.+?)\*\*/g,
    (_match, phrase: string) => {
      const index = emphasized.push(plainText(phrase)) - 1;
      return `\uE000${index}\uE001`;
    },
  );
  const normalized = plainText(tokenized);
  const parts: ShareSummaryPart[] = [];
  const token = /\uE000(\d+)\uE001/g;
  let cursor = 0;

  for (const match of normalized.matchAll(token)) {
    const index = match.index;
    if (index > cursor) {
      parts.push({ text: normalized.slice(cursor, index), emphasized: false });
    }
    parts.push({
      text: emphasized[Number(match[1])] ?? "",
      emphasized: true,
    });
    cursor = index + match[0].length;
  }
  if (cursor < normalized.length) {
    parts.push({ text: normalized.slice(cursor), emphasized: false });
  }

  const visible = parts.map((part) => part.text).join("");
  const shortened = truncate(visible, limit);
  const wasTruncated = shortened.endsWith("…");
  let remaining = wasTruncated ? shortened.length - 1 : shortened.length;
  const result: ShareSummaryPart[] = [];

  for (const part of parts) {
    if (remaining <= 0) break;
    const text = part.text.slice(0, remaining);
    if (text) result.push({ ...part, text });
    remaining -= text.length;
  }
  if (wasTruncated) result.push({ text: "…", emphasized: false });

  return result;
}
