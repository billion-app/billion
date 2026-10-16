/**
 * Machine translation of Billion-authored reader text.
 *
 * Only prose that Billion wrote is translated: titles, descriptions, the AI
 * explainer, and an allowlist of brief fields. Source text is never
 * translated. Verbatim quotes, locators, original documents, cited headlines,
 * publishers, and URLs stay as written, because a translated "quote" would no
 * longer be what the source says and "View source" finds quotes by matching
 * them against the original text.
 *
 * Translations are stored as a flat map from field path to translated string
 * and overlaid on the live English record at read time. Images, quotes, and
 * citations therefore always come from the current English record.
 */

import { createHash } from "node:crypto";
import { generateText, Output } from "ai";
import { z } from "zod/v4";

import { llm } from "./ai-provider";

export const TRANSLATION_LANGUAGES = ["es", "zh"] as const;
export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

const LANGUAGE_NAME: Record<TranslationLanguage, string> = {
  es: "Spanish (neutral Latin American)",
  zh: "Simplified Chinese (Mandarin)",
};

/** Bumped when the prompt or segmenting changes, so cached rows refresh. */
export const TRANSLATION_PROMPT_VERSION = "translate-v2";

type Path = (string | number)[];

/**
 * Brief fields Billion authored. `*` matches every array index. Anything not
 * listed (quotes, locators, urls, publishers, cited headlines, enums) is left
 * untouched.
 */
export const BILL_BRIEF_FIELDS = [
  "summary",
  "hook",
  "facts.*.label",
  "facts.*.value",
  "facts.*.note",
  "changes.*.title",
  "changes.*.before",
  "changes.*.after",
  "affected.*.group",
  "affected.*.takeaway",
  "affected.*.effect",
  "unknowns.*",
  "terms.*.term",
  "terms.*.plain",
  "whyNotBefore.summary",
  "whyNotBefore.points.*.text",
  "deepDive.title",
  "deepDive.dek",
  "deepDive.body",
  "reading.*.whyRead",
] as const;

export const COURT_BRIEF_FIELDS = [
  "takeaway.text",
  "action.text",
  "posture",
  "questions.*.text",
  "reasoning.*.text",
  "effects.*.text",
  "effects.*.group",
  "opinions.*.text",
  "unknowns.*",
  "terms.*.term",
  "terms.*.plain",
] as const;

export interface Segment {
  /** Dot path, e.g. `brief.changes.0.title`. */
  key: string;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walk(value: unknown, pattern: string[], path: Path, out: Segment[]) {
  if (pattern.length === 0) {
    if (typeof value === "string" && value.trim()) {
      out.push({ key: path.join("."), text: value });
    }
    return;
  }
  const [head, ...rest] = pattern;
  if (head === "*") {
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => walk(item, rest, [...path, index], out));
    return;
  }
  if (!isRecord(value) || head === undefined) return;
  walk(value[head], rest, [...path, head], out);
}

/** Collects translatable strings from `value`, keyed under `prefix`. */
export function collectSegments(
  value: unknown,
  fields: readonly string[],
  prefix: string,
): Segment[] {
  const out: Segment[] = [];
  for (const field of fields) walk(value, field.split("."), [prefix], out);
  return out;
}

/**
 * Returns a copy of `value` with every translated path under `prefix`
 * replaced. Paths that no longer exist (the English record changed shape)
 * are skipped rather than created.
 */
export function applySegments<T>(
  value: T,
  translations: Record<string, string>,
  prefix: string,
): T {
  if (value === null || value === undefined) return value;
  const copy = structuredClone(value);
  for (const [key, text] of Object.entries(translations)) {
    const [root, ...parts] = key.split(".");
    const last = parts.pop();
    if (root !== prefix || last === undefined) continue;
    let node: unknown = copy;
    for (const part of parts) {
      node = Array.isArray(node)
        ? node[Number(part)]
        : isRecord(node)
          ? node[part]
          : undefined;
    }
    if (Array.isArray(node)) {
      const index = Number(last);
      if (typeof node[index] === "string") node[index] = text;
    } else if (isRecord(node) && typeof node[last] === "string") {
      node[last] = text;
    }
  }
  return copy;
}

/** The English reader fields a translation is built from. */
export interface TranslationSource {
  title: string;
  description: string;
  /** Present only when the explainer is Billion-authored, never source text. */
  articleContent: string | null;
  brief: unknown;
  courtBrief: unknown;
}

export function readerTranslationSource(detail: {
  title: string;
  description: string;
  articleContent: string;
  originalContent: string;
  brief?: unknown;
  courtBrief?: unknown;
}): TranslationSource {
  return {
    title: detail.title,
    description: detail.description,
    articleContent:
      detail.articleContent !== detail.originalContent &&
      detail.articleContent !== "No content available"
        ? detail.articleContent
        : null,
    brief: detail.brief ?? null,
    courtBrief: detail.courtBrief ?? null,
  };
}

export function sourceSegments(source: TranslationSource): Segment[] {
  const segments: Segment[] = [
    { key: "title", text: source.title },
    { key: "description", text: source.description },
  ];
  if (source.articleContent) {
    segments.push({ key: "articleContent", text: source.articleContent });
  }
  segments.push(...collectSegments(source.brief, BILL_BRIEF_FIELDS, "brief"));
  segments.push(
    ...collectSegments(source.courtBrief, COURT_BRIEF_FIELDS, "courtBrief"),
  );
  return segments.filter((segment) => segment.text.trim());
}

export function hashSegments(segments: Segment[]): string {
  return createHash("sha256")
    .update(TRANSLATION_PROMPT_VERSION)
    .update(JSON.stringify(segments))
    .digest("hex");
}

/** Client overlays also contain source quotes and metadata from this revision. */
export function hashReaderSource(source: TranslationSource): string {
  return createHash("sha256")
    .update(TRANSLATION_PROMPT_VERSION)
    .update(JSON.stringify(source))
    .digest("hex");
}

/** Long markdown is split on blank lines so each request stays small. */
const MAX_PIECE_CHARS = 2500;
const MAX_BATCH_CHARS = 6000;

interface Piece {
  key: string;
  text: string;
}

export function splitIntoPieces(segments: Segment[]): Piece[] {
  return segments.flatMap((segment) => {
    if (segment.text.length <= MAX_PIECE_CHARS) return [segment];
    const pieces: Piece[] = [];
    let current = "";
    for (const paragraph of segment.text.split(/\n{2,}/)) {
      if (current && current.length + paragraph.length > MAX_PIECE_CHARS) {
        pieces.push({ key: segment.key, text: current });
        current = "";
      }
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    if (current) pieces.push({ key: segment.key, text: current });
    return pieces;
  });
}

export function batchPieces(pieces: Piece[]): Piece[][] {
  const batches: Piece[][] = [];
  let batch: Piece[] = [];
  let size = 0;
  for (const piece of pieces) {
    if (batch.length > 0 && size + piece.text.length > MAX_BATCH_CHARS) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(piece);
    size += piece.text.length;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

/** Translates an ordered list of strings; must return the same length. */
export type TranslateBatch = (
  texts: string[],
  language: TranslationLanguage,
) => Promise<string[]>;

export async function translateSegments(
  segments: Segment[],
  language: TranslationLanguage,
  translateBatch: TranslateBatch,
): Promise<Record<string, string>> {
  // Never send source passages to the model. Reject output that loses or
  // duplicates a placeholder rather than publishing an altered quotation.
  const protectedText = new Map<string, { key: string; text: string }>();
  let prefix = "BILLION_KEEP_";
  while (segments.some(({ text }) => text.includes(prefix))) prefix += "X";
  const protectedSegments = segments.map(({ key, text }) => ({
    key,
    text: text.replace(
      /```[\s\S]*?```|^[ \t]{0,3}>[^\n]*(?:\n(?![ \t]*\n)[^\n]*)*|!?\[[^\]\n]*\]\([^\n]*?\)|!?\[[^\]\n]*\]\[[^\]\n]*\]|https?:\/\/[^\s<>]+|“[^”]+”|"[^"]+"|‘[^’]+’|(?<!\w)'[^']+'(?!\w)/gm,
      (original) => {
        const token = `${prefix}${protectedText.size}_END`;
        protectedText.set(token, { key, text: original });
        return token;
      },
    ),
  }));
  const pieces = splitIntoPieces(protectedSegments);
  const translatedPieces: Piece[] = [];
  for (const batch of batchPieces(pieces)) {
    const texts = batch.map((piece) => piece.text);
    const result = await translateBatch(texts, language);
    if (result.length !== texts.length) {
      throw new Error(
        `Translation returned ${result.length} items for ${texts.length}`,
      );
    }
    if (result.some((text) => !text.trim())) {
      throw new Error("Translation returned an empty passage");
    }
    batch.forEach((piece, index) =>
      translatedPieces.push({ key: piece.key, text: result[index] ?? "" }),
    );
  }
  const out: Record<string, string> = {};
  for (const piece of translatedPieces) {
    out[piece.key] =
      piece.key in out ? `${out[piece.key]}\n\n${piece.text}` : piece.text;
  }
  for (const [token, original] of protectedText) {
    const occurrences = Object.values(out).reduce(
      (count, text) => count + text.split(token).length - 1,
      0,
    );
    if (occurrences !== 1 || !out[original.key]?.includes(token))
      throw new Error("Translation altered protected text");
    for (const [key, text] of Object.entries(out)) {
      out[key] = text.replace(token, () => original.text);
    }
  }
  return out;
}

const batchSchema = z.object({ translations: z.array(z.string()) });

export function modelVersion(): string | null {
  if (!llm) return null;
  const id = typeof llm === "string" ? llm : llm.modelId;
  return `${TRANSLATION_PROMPT_VERSION}:${id}`.slice(0, 80);
}

/** The production translator, backed by the shared civic `llm`. */
export const llmTranslateBatch: TranslateBatch = async (texts, language) => {
  if (!llm) throw new Error("no AI provider configured");
  const { output } = await generateText({
    model: llm,
    temperature: 0.2,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(90_000),
    output: Output.object({ schema: batchSchema }),
    prompt: `Translate each string in the JSON array below from English into ${LANGUAGE_NAME[language]} for a nonpartisan civic news app.

Rules:
- Return {"translations": [...]} with exactly ${texts.length} strings, in the same order.
- Translate meaning faithfully and neutrally. Do not add, remove, soften, or explain anything.
- Keep markdown exactly: headings, lists, links, and **bold** markers stay around the matching translated words.
- Copy every BILLION_KEEP_..._END placeholder exactly once, unchanged, in its original position. These stand for source passages and citations, which must not be translated.
- Keep URLs, bill numbers, section numbers, dollar amounts, dates, and proper names of people and organizations as written.
- Keep U.S. legal terms accurate; when a term has no standard equivalent, translate it and leave the English in parentheses once.

${JSON.stringify(texts)}`,
  });
  return output.translations;
};
