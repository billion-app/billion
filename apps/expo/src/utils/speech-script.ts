/**
 * What "Listen" reads: the visible article as plain sentences, split into
 * chunks the device speech engine accepts. Pure so it can be tested without a
 * native module; playback lives in `~/hooks/useArticleSpeech`.
 *
 * Only prose is read. Markdown syntax, URLs, and image tags would be spoken
 * literally, so they are removed. Verbatim source quotes inside a brief are
 * skipped; "Original text" mode reads the source itself.
 */

/** Android rejects input past ~4000 characters; stay well under it. */
export const MAX_CHUNK_CHARS = 1500;

interface BillBriefLike {
  summary?: string;
  hook?: string;
  changes?: { title?: string; before?: string; after?: string }[];
  affected?: { group?: string; takeaway?: string }[];
  unknowns?: string[];
}

interface CourtPointLike {
  text?: string;
}

interface CourtBriefLike {
  takeaway?: CourtPointLike;
  action?: CourtPointLike;
  posture?: string;
  effects?: CourtPointLike[];
  unknowns?: string[];
}

export interface SpeechSource {
  title: string;
  description?: string;
  brief?: BillBriefLike | null;
  courtBrief?: CourtBriefLike | null;
  /** Markdown or plain body used when there is no brief, or in source mode. */
  body?: string | null;
}

export function stripMarkdown(text: string): string {
  return (
    text
      // Code fences and inline code
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      // Images, then links (keep the link text)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Bare URLs and HTML tags
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/<[^>]+>/g, " ")
      // Line-start syntax: headings, quotes, list markers, rules
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
      .replace(/^\s*(?:[-*_]\s*){3,}$/gm, "")
      // Emphasis markers
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
  );
}

/** Ends a fragment with sentence punctuation so the engine pauses. */
function sentence(text: string | undefined): string | null {
  if (!text) return null;
  const clean = stripMarkdown(text).replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return /[.!?。！？…:]$/.test(clean) ? clean : `${clean}.`;
}

export function buildSpeechParagraphs(source: SpeechSource): string[] {
  const paragraphs: (string | null)[] = [
    sentence(source.title),
    sentence(source.description),
  ];

  if (source.brief) {
    const brief = source.brief;
    paragraphs.push(sentence(brief.summary), sentence(brief.hook));
    for (const change of brief.changes ?? []) {
      paragraphs.push(
        [change.title, change.before, change.after]
          .map(sentence)
          .filter(Boolean)
          .join(" ") || null,
      );
    }
    for (const group of brief.affected ?? []) {
      paragraphs.push(
        [group.group, group.takeaway].map(sentence).filter(Boolean).join(" ") ||
          null,
      );
    }
    for (const unknown of brief.unknowns ?? []) {
      paragraphs.push(sentence(unknown));
    }
  } else if (source.courtBrief) {
    const court = source.courtBrief;
    paragraphs.push(
      sentence(court.takeaway?.text),
      sentence(court.action?.text),
      sentence(court.posture),
      ...(court.effects ?? []).map((effect) => sentence(effect.text)),
      ...(court.unknowns ?? []).map(sentence),
    );
  } else if (source.body) {
    paragraphs.push(...source.body.split(/\n{2,}/).map(sentence));
  }

  return paragraphs.filter((p): p is string => !!p);
}

/** Splits on sentence ends, including CJK full-width punctuation. */
function sentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?。！？])\s*/).filter(Boolean);
}

/**
 * Packs paragraphs into chunks under `max` characters. Paragraph breaks are
 * preferred; a long paragraph splits on sentences, and a run-on sentence on
 * whitespace (or anywhere, for unspaced scripts like Chinese).
 */
export function chunkForSpeech(
  paragraphs: string[],
  max = MAX_CHUNK_CHARS,
): string[] {
  const pieces = paragraphs.flatMap((paragraph) =>
    paragraph.length <= max
      ? [paragraph]
      : sentences(paragraph).flatMap((s) => hardSplit(s, max)),
  );
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > max) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current} ${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

function hardSplit(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const space = rest.lastIndexOf(" ", max);
    const cut = space > max / 2 ? space : max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function buildSpeechChunks(source: SpeechSource): string[] {
  return chunkForSpeech(buildSpeechParagraphs(source));
}
