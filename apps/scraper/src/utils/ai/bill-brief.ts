/**
 * Bill Brief generation — turns a bill into the structured document defined in
 * `@acme/validators`, replacing the markdown wall of text as the primary read.
 *
 * The pipeline is deliberately three steps, only one of which costs a token:
 *
 *   1. Structure (LLM). One schema-validated call grounded in the official text
 *      plus, when we have it, the existing long-form article — that article has
 *      already done the careful nonpartisan analysis, so this pass is mostly a
 *      restructuring job rather than a fresh reading.
 *   2. Verify quotes (deterministic). Every quote is checked against the full
 *      source text. Unverified quotes are dropped, not shipped — a brief may
 *      say less than the model wrote, but it never attributes words to a bill
 *      that the bill does not contain.
 *   3. Lint framing (deterministic). Loaded political phrasing in the model's
 *      own prose triggers one regeneration with the offending phrases named.
 *      Quotes are exempt: a source is allowed to be partisan, we are not.
 */
import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  Output,
  RetryError,
} from "ai";
import { z } from "zod";

import type {
  BillBrief,
  BillBriefRecord,
  BillLifecycleAction,
  BriefLegalStatus,
} from "@acme/validators";
import {
  BILL_BRIEF_VERSION,
  BillBriefSchema,
  BriefAffectedSchema,
  BriefChangeKindSchema,
  BriefChangeSchema,
  BriefContextCitationSchema,
  BriefContextPointSchema,
  BriefContextSchema,
  BriefDeepDiveSchema,
  BriefDirectionSchema,
  BriefFactSchema,
  BriefQuoteSchema,
  BriefReaderIntroSchema,
  BriefReadingSchema,
  BriefTermSchema,
  deriveBillLifecycle,
} from "@acme/validators";

import type { DualLensSource } from "./text-generation.js";
import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { getGeneratedModelVersion, getStructuredLlm } from "./provider.js";
import {
  AIRateLimitError,
  rateLimitHit,
  researchBillContext,
  setRateLimitHit,
  SOURCE_WINDOW,
} from "./text-generation.js";

const logger = createLogger("ai-brief");

// Shared with the research and lens steps — see SOURCE_WINDOW's own comment for
// why they must not diverge.

/** Attempts at structuring before giving up (each is one LLM call). */
const MAX_ATTEMPTS = 2;

/* ------------------------------------------------------------------ *
 * The generated-output layer.
 *
 * Everything below exists to absorb the ways a provider's JSON differs from the
 * canonical schema without being *wrong*: absent optionals arriving as null,
 * and fields arriving in a neighbouring shape. Each is normalised here and then
 * validated against `BillBriefSchema` before verification and caching, so
 * storage stays strict while generation tolerates transport noise.
 *
 * The rule these share: a recoverable envelope must never cost a brief. Length
 * caps and floors already discarded ~15% of everything generated before they
 * became prompt guidance; these are the same defect wearing different clothes.
 * ------------------------------------------------------------------ */

/**
 * A quote is `{text, locator}`, but the model intermittently sends the bare
 * string instead — the exact inverse of what it does to `unknowns` below. 68
 * failures came from this one shape, making it the largest remaining class
 * after the length caps went. The quote text is the part that matters and it is
 * verified against the source either way, so the missing envelope costs
 * nothing; only a locator we never had is lost.
 */
export const GeneratedBriefQuoteSchema = z.union([
  z.string().transform((text) => ({ text })),
  BriefQuoteSchema.extend({
    locator: z.string().trim().nullish(),
  }),
]);
/**
 * `unknowns` is a list of plain strings, but the model intermittently wraps
 * each one as `{"text": "..."}` — the shape every *other* list in the brief
 * uses. The content is correct; only the envelope is wrong, and rejecting the
 * whole brief over it lost H.R. 1722 and S. 4766 outright. Unwrap it here,
 * alongside the null-for-absent convention handled below.
 */
const GeneratedUnknownSchema = z
  .union([z.string(), z.object({ text: z.string() })])
  .transform((value) => (typeof value === "string" ? value : value.text));

// Every list cap is dropped here and re-applied by `truncateOverlongLists`
// before canonical validation. Enforcing them at generation time rejects the
// whole brief over one surplus item; enforcing them after lets the surplus item
// be the only thing lost.
const GeneratedBillBriefSchema = BillBriefSchema.extend({
  headline: BillBriefSchema.shape.headline.unwrap(),
  unknowns: z.array(GeneratedUnknownSchema).min(1),
  // `direction` is read loosely so an unrecognised value reaches
  // `coerceAffectedDirections` instead of rejecting the document.
  affected: z
    .array(
      BriefAffectedSchema.omit({ direction: true }).extend({
        direction: z.string(),
      }),
    )
    .min(1),
  terms: z.array(BriefTermSchema),
  reading: z.array(BriefReadingSchema),
  facts: z.array(
    BriefFactSchema.extend({
      note: z.string().trim().nullish(),
      quote: GeneratedBriefQuoteSchema.nullish(),
    }),
  ),
  changes: z
    .array(
      // `kind` is accepted as a free string here and narrowed to the enum by
      // `dropUnrecognisedChangeKinds` below. Validating it inline would reject
      // the whole brief over one invented verb: H.Res. 1174 returned
      // "clarifies" for its fourth change and lost the three valid ones with
      // it. Deliberately not auto-mapped onto the nearest legal value — `kind`
      // is a mechanical claim about what a bill does, and guessing which of the
      // eight the model meant risks mislabelling the provision.
      BriefChangeSchema.omit({ kind: true }).extend({
        kind: z.string(),
        reader: BriefReaderIntroSchema.extend({
          quote: GeneratedBriefQuoteSchema.nullish(),
        }),
        quote: GeneratedBriefQuoteSchema.nullish(),
      }),
    )
    .min(1),
  // `citations` loses its `min(1)` here so an uncited point survives generation
  // and can be dropped individually by `dropUncitedContextPoints`.
  whyNotBefore: BriefContextSchema.extend({
    points: z.array(
      BriefContextPointSchema.extend({
        citations: z.array(BriefContextCitationSchema),
      }),
    ),
  }).nullish(),
  deepDive: BriefDeepDiveSchema.nullish(),
});

/**
 * Sections a brief can lose and still be a brief.
 *
 * `hook`, `changes`, `affected` and `unknowns` are the document; the rest are
 * enrichments. Splitting them this way is what lets one malformed citation cost
 * an expandable panel instead of everything.
 *
 * `facts`, `terms` and `reading` are required *keys* whose arrays may be empty,
 * so they are emptied rather than deleted; `whyNotBefore` and `deepDive` are
 * genuinely optional and are removed.
 */
const LOSABLE_SECTIONS = {
  facts: "empty",
  terms: "empty",
  reading: "empty",
  whyNotBefore: "delete",
  deepDive: "delete",
} as const;

/**
 * Validate against the canonical schema, and if only a losable section is at
 * fault, drop that section and keep the brief.
 *
 * Every targeted normaliser above was written after production lost a brief to
 * one specific shape — a bare-string quote, an invented verb, a fourth unknown,
 * an uncited point. Eight of them now, each found the same way. They are worth
 * having, because each preserves *more* than this does: a repaired quote keeps
 * its citation, where this would drop the whole section.
 *
 * But writing one per shape means the corpus finds the next gap before I do,
 * and with thousands of bills unprocessed there is no reason to think the list
 * is finished. This is the backstop underneath them: whatever the model does to
 * an enrichment section, the reader still gets the analysis. Only a failure in
 * the brief's required content can now cost the brief.
 */
export function parseBriefWithSectionRecovery(
  value: unknown,
  billNumber: string,
): BillBrief {
  const first = BillBriefSchema.safeParse(value);
  if (first.success) return first.data;

  const broken = new Set(
    first.error.issues
      .map((issue) => String(issue.path[0]))
      .filter((section): section is keyof typeof LOSABLE_SECTIONS =>
        Object.hasOwn(LOSABLE_SECTIONS, section),
      ),
  );

  // Nothing losable is at fault, so the failure is in the brief itself.
  if (broken.size === 0) throw first.error;

  const repaired = { ...(value as Record<string, unknown>) };
  for (const section of broken) {
    if (LOSABLE_SECTIONS[section] === "empty") repaired[section] = [];
    else delete repaired[section];
  }

  const second = BillBriefSchema.safeParse(repaired);
  // The retry can still fail on required content that the first pass reported
  // alongside the losable sections; that failure is the real one.
  if (!second.success) throw second.error;

  logger.warn(
    `Brief for ${billNumber}: dropped unparseable section(s) ` +
      `(${[...broken].join(", ")}) rather than the whole brief`,
  );
  return second.data;
}

/**
 * Fall back to `unclear` when an affected group's direction is not one of the
 * four allowed values.
 *
 * Sibling of `dropUnrecognisedChangeKinds`, and the two are handled differently
 * on purpose. `direction` has a designated "we do not know" member: the schema
 * tells the model to use `unclear` when the text does not settle it. Mapping an
 * unrecognised value onto it is therefore honest rather than a guess — we
 * genuinely do not know what was meant, which is precisely what `unclear`
 * asserts. `kind` has no such member; all eight are positive claims about
 * mechanism, so there is nothing truthful to fall back to and the change is
 * dropped instead.
 *
 * H.R. 1352 returned `"clear"` — an `unclear` with the negation dropped — and
 * lost a complete brief over one of its three affected groups.
 */
export function coerceAffectedDirections(
  value: unknown,
  billNumber: string,
): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.affected)) return value;

  const allowed = new Set<string>(BriefDirectionSchema.options);
  const coerced: string[] = [];

  const affected = record.affected.map((group) => {
    if (!group || typeof group !== "object") return group;
    const direction = (group as { direction?: unknown }).direction;
    if (typeof direction === "string" && allowed.has(direction)) return group;
    coerced.push(String(direction));
    return { ...(group as Record<string, unknown>), direction: "unclear" };
  });

  if (coerced.length === 0) return value;
  logger.warn(
    `Brief for ${billNumber}: ${coerced.length} affected direction(s) were ` +
      `unrecognised (${coerced.join(", ")}); recorded as "unclear"`,
  );
  return { ...record, affected };
}

/**
 * Drop historical-context points that arrived with no citations, and the whole
 * section if that leaves nothing.
 *
 * `verifyBriefContext` already does exactly this — it drops uncited points and
 * removes `whyNotBefore` entirely when fewer than two distinct sources survive.
 * But it runs *after* `BillBriefSchema.parse`, and the canonical schema requires
 * `citations.min(1)`, so an uncited point never reaches the layer built to
 * handle it. H.R. 8244 lost a complete brief that way.
 *
 * Same shape of mistake as the quote floor removed in af16f65: a rule enforced
 * one layer too early, where the only available outcome is rejecting everything.
 * `whyNotBefore` is optional, so losing it costs a section the reader may not
 * have opened; losing the brief costs all of it.
 */
export function dropUncitedContextPoints(
  value: unknown,
  billNumber: string,
): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const context = record.whyNotBefore;
  if (!context || typeof context !== "object") return value;

  const points = (context as { points?: unknown }).points;
  if (!Array.isArray(points)) return value;

  const kept = points.filter((point) => {
    const citations =
      point && typeof point === "object"
        ? (point as { citations?: unknown }).citations
        : undefined;
    return Array.isArray(citations) && citations.length > 0;
  });

  if (kept.length === points.length) return value;

  if (kept.length === 0) {
    logger.warn(
      `Brief for ${billNumber}: dropped whyNotBefore — every point arrived uncited`,
    );
    const { whyNotBefore: _dropped, ...rest } = record;
    return rest;
  }

  logger.warn(
    `Brief for ${billNumber}: dropped ${points.length - kept.length} uncited ` +
      `whyNotBefore point(s); kept ${kept.length}`,
  );
  return { ...record, whyNotBefore: { ...context, points: kept } };
}

/**
 * How many items each list in a brief may hold, mirroring the `.max()` calls in
 * `BillBriefSchema`.
 *
 * Duplicated deliberately rather than introspected out of the zod schema, which
 * is not a stable API. Drift is safe in the only direction it matters: if a cap
 * here is looser than the canonical one, the brief is rejected exactly as it is
 * today, so a stale entry costs a log line and never bad data.
 */
const LIST_CAPS: Record<string, number> = {
  facts: 4,
  changes: 5,
  affected: 4,
  unknowns: 3,
  terms: 5,
  reading: 4,
};

/**
 * Trim lists the model over-filled.
 *
 * `fcf4e4e` moved every *character* cap into prompt guidance but left array
 * cardinality alone, on the reasoning that list length is structural — it
 * shapes the UI — rather than stylistic. That distinction does not survive
 * contact with the failure it causes: S. 4238 returned four `unknowns` against
 * a maximum of three and lost a complete brief over the fourth one.
 *
 * Truncation is safe here in a way that `kind` was not. These are independent
 * list entries, the field descriptions already say "up to N", and the model
 * orders them most significant first, so the items dropped are the ones it
 * ranked last. Nothing has to be guessed.
 */
export function truncateOverlongLists(
  value: unknown,
  billNumber: string,
): unknown {
  if (!value || typeof value !== "object") return value;
  const record = { ...(value as Record<string, unknown>) };
  const trimmed: string[] = [];

  for (const [key, cap] of Object.entries(LIST_CAPS)) {
    const list = record[key];
    if (!Array.isArray(list) || list.length <= cap) continue;
    trimmed.push(`${key} ${list.length}→${cap}`);
    record[key] = list.slice(0, cap);
  }

  if (trimmed.length === 0) return value;
  logger.warn(
    `Brief for ${billNumber}: trimmed over-long list(s) (${trimmed.join(", ")})`,
  );
  return record;
}

/**
 * Remove changes whose `kind` is not one of the eight mechanical verbs.
 *
 * Follows the same rule as `verifyBriefQuotes`: drop the part that cannot be
 * trusted and keep the rest, because deleting the surrounding analysis is the
 * larger loss. A brief that lists four provisions instead of five is still
 * useful and still true; one that fails to exist is neither.
 *
 * If every change is dropped the caller's `BillBriefSchema.parse` fails on the
 * `min(1)`, which is the right outcome — a brief with nothing in "What would
 * change" has no reason to be stored.
 */
export function dropUnrecognisedChangeKinds(
  value: unknown,
  billNumber: string,
): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.changes)) return value;

  const allowed = new Set<string>(BriefChangeKindSchema.options);
  const kept: unknown[] = [];
  const dropped: string[] = [];

  for (const change of record.changes) {
    const kind =
      change && typeof change === "object"
        ? (change as { kind?: unknown }).kind
        : undefined;
    if (typeof kind === "string" && allowed.has(kind)) {
      kept.push(change);
      continue;
    }
    dropped.push(String(kind));
  }

  if (dropped.length === 0) return value;
  logger.warn(
    `Brief for ${billNumber}: dropped ${dropped.length} change(s) with an ` +
      `unrecognised kind (${dropped.join(", ")}); kept ${kept.length}`,
  );
  return { ...record, changes: kept };
}

function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== null)
      .map(([key, child]) => [key, withoutNulls(child)]),
  );
}

/**
 * `NoObjectGeneratedError` carries the raw completion and the underlying Zod
 * issues, but its `message` is the useless constant "response did not match
 * schema". Surface which field actually failed, otherwise a schema-shaped
 * failure is indistinguishable from a truncated one in the logs.
 */
function describeStructuringFailure(error: unknown): string {
  if (!NoObjectGeneratedError.isInstance(error)) return String(error);
  const issues =
    error.cause instanceof z.ZodError
      ? error.cause.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")
      : String(error.cause);
  return `${error.message} | issues: ${issues} | rawChars: ${error.text?.length ?? 0}`;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota")
  );
}

/* ------------------------------------------------------------------ *
 * Step 2 — quote verification
 * ------------------------------------------------------------------ */

/**
 * Collapse the cosmetic differences between a quote and its source: casing,
 * smart quotes and dashes, hyphenation across line breaks, and the erratic
 * whitespace of scraped legislative text. Punctuation is dropped entirely
 * because bill text arrives with inconsistent spacing around it.
 *
 * This is deliberately lenient about *formatting* and strict about *words*:
 * dropping or reordering a word still fails, which is the failure mode that
 * matters.
 */
export function normalizeForQuoteMatch(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/-\s*\n\s*/g, "") // de-hyphenate across wrapped lines
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whether a quote appears verbatim (modulo formatting) in the source. */
export function isQuoteGrounded(quote: string, normalizedSource: string) {
  const needle = normalizeForQuoteMatch(quote);
  // Very short fragments match by accident. This is the only length check on a
  // quote — the schema deliberately has no floor, so that a too-short quote is
  // dropped here rather than rejecting the whole brief.
  if (needle.length < 20) return false;
  return normalizedSource.includes(needle);
}

export interface QuoteVerification {
  brief: BillBrief;
  /** Quotes that matched the source and were kept. */
  verified: number;
  /** Quotes that did not match and were stripped from the brief. */
  dropped: number;
}

/**
 * Strip every quote that does not appear in `sourceText`. The surrounding
 * claim is kept — losing a citation makes a point weaker, but deleting the
 * point would let a bad quote silently remove real analysis.
 */
export function verifyBriefQuotes(
  brief: BillBrief,
  sourceText: string,
): QuoteVerification {
  const normalizedSource = normalizeForQuoteMatch(sourceText);
  let verified = 0;
  let dropped = 0;

  const check = <T extends { quote?: { text: string; locator?: string } }>(
    item: T,
  ): T => {
    if (!item.quote) return item;
    if (isQuoteGrounded(item.quote.text, normalizedSource)) {
      verified++;
      return item;
    }
    dropped++;
    const { quote: _dropped, ...rest } = item;
    return rest as T;
  };

  return {
    brief: {
      ...brief,
      facts: brief.facts.map(check),
      changes: brief.changes.map((change) => ({
        ...check(change),
        ...(change.reader ? { reader: check(change.reader) } : {}),
      })),
    },
    verified,
    dropped,
  };
}

function comparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

/**
 * A model may summarize a researched page, but it may not create the link.
 * Keep only URLs surfaced by the agentic search loop and replace cosmetic URL
 * variations with the exact researched URL.
 */
export function verifyBriefReading(
  brief: BillBrief,
  sources: readonly DualLensSource[],
): BillBrief {
  const verified = new Map(
    sources.map((source) => [comparableUrl(source.url), source.url]),
  );
  return {
    ...brief,
    reading: brief.reading.flatMap((item) => {
      const url = verified.get(comparableUrl(item.url));
      return url ? [{ ...item, url }] : [];
    }),
  };
}

/**
 * Historical context may use only pages the research agent successfully
 * opened. Keep exact researched URLs, remove invented citations, and omit the
 * entire section unless at least two distinct sources remain.
 *
 * Both drop paths are logged. This is the filter that decides whether a reader
 * ever sees `whyNotBefore`, and it used to drop the section without a trace,
 * which made a legitimate editorial bar indistinguishable from a citation
 * matching bug: only ~11% of briefs carry the section, and nothing recorded
 * whether the rest were never written or written and then discarded here. The
 * counts name which one it was — `unverifiable` rising while the model keeps
 * emitting points means the URLs are real but absent from `sources`, not that
 * the history is unsupported.
 */
export function verifyBriefContext(
  brief: BillBrief,
  sources: readonly DualLensSource[],
  billNumber: string,
): BillBrief {
  if (!brief.whyNotBefore) return brief;

  const verified = new Map(
    sources.map((source) => [comparableUrl(source.url), source.url]),
  );
  const offered = brief.whyNotBefore.points;
  let unverifiable = 0;
  const points = offered.flatMap((point) => {
    const citations = point.citations.flatMap((citation) => {
      const url = verified.get(comparableUrl(citation.url));
      if (!url) unverifiable += 1;
      return url ? [{ ...citation, url }] : [];
    });
    return citations.length > 0 ? [{ ...point, citations }] : [];
  });
  const distinctSources = new Set(
    points.flatMap((point) => point.citations.map((citation) => citation.url)),
  );

  if (points.length === 0 || distinctSources.size < 2) {
    const reason =
      points.length === 0
        ? "every point lost all of its citations"
        : `only ${distinctSources.size} distinct verified source(s), needs 2`;
    logger.warn(
      `Brief for ${billNumber}: dropped whyNotBefore — ${reason} ` +
        `(${offered.length} point(s) offered, ${points.length} survived, ` +
        `${unverifiable} citation(s) not among ${sources.length} researched source(s))`,
    );
    const { whyNotBefore: _dropped, ...rest } = brief;
    return rest;
  }

  if (unverifiable > 0) {
    logger.warn(
      `Brief for ${billNumber}: kept whyNotBefore but dropped ${unverifiable} ` +
        `unverifiable citation(s); ${points.length}/${offered.length} point(s) survived`,
    );
  }

  return {
    ...brief,
    whyNotBefore: {
      summary: brief.whyNotBefore.summary,
      points,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Step 3 — framing lint
 * ------------------------------------------------------------------ */

/**
 * Phrasing that carries a verdict rather than a fact. These are the terms that
 * make an explainer read as an endorsement or an attack — most are borrowed
 * from press-release and attack-ad vocabulary on both sides. The article prompt
 * already warns against several ("cuts red tape", "streamlines"); this catches
 * the cases where the model warns itself and then does it anyway.
 *
 * Word-boundary matched, and never applied to quoted source text.
 */
const LOADED_PHRASES = [
  "common ?sense",
  "cuts? red tape",
  "red tape",
  "job[- ]killing",
  "job[- ]creating",
  "radical",
  "extreme",
  "extremist",
  "reckless",
  "dangerous",
  "landmark",
  "historic",
  "much[- ]needed",
  "long overdue",
  "war on",
  "handout",
  "giveaway",
  "power grab",
  "sensible",
  "burdensome",
  "bloated",
  "wasteful",
  "special interests",
  "slashes",
  "guts",
  "crackdown",
];

const LOADED_PATTERN = new RegExp(
  `\\b(?:${LOADED_PHRASES.join("|")})\\b`,
  "gi",
);

/**
 * Prose fields the model authored. Quotes are excluded on purpose: a bill or a
 * sponsor is free to call something "common sense", and reproducing that
 * verbatim is reporting, not editorializing.
 */
function authoredProse(brief: BillBrief): string[] {
  return [
    brief.headline ?? "",
    brief.summary,
    brief.hook,
    ...brief.facts.flatMap((f) => [f.label, f.value, f.note ?? ""]),
    ...brief.changes.flatMap((c) => [
      c.title,
      c.before,
      c.after,
      ...(c.reader
        ? [c.reader.summary, c.reader.question, c.reader.answer]
        : []),
    ]),
    ...brief.affected.flatMap((a) => [a.group, a.takeaway, a.effect]),
    ...brief.unknowns,
    ...brief.terms.flatMap((t) => [t.term, t.plain]),
    ...(brief.whyNotBefore
      ? [
          brief.whyNotBefore.summary,
          ...brief.whyNotBefore.points.map((point) => point.text),
        ]
      : []),
    ...(brief.deepDive
      ? [brief.deepDive.title, brief.deepDive.dek, brief.deepDive.body]
      : []),
    ...brief.reading.flatMap((item) => [
      item.title,
      item.publisher,
      item.whyRead,
    ]),
  ];
}

/** Loaded phrases used in the model's own voice, deduped and lowercased. */
export function findLoadedLanguage(brief: BillBrief): string[] {
  const hits = new Set<string>();
  for (const field of authoredProse(brief)) {
    for (const match of field.matchAll(LOADED_PATTERN)) {
      hits.add(match[0].toLowerCase());
    }
  }
  return [...hits];
}

/**
 * Policy terms that often survive a "plain language" rewrite while remaining
 * opaque to a general reader. A term may appear when the brief explicitly
 * defines it up front; otherwise the generator gets one retry with the exact
 * phrases named.
 */
const JARGON_RULES = [
  {
    label: "funding horizon",
    pattern: /\bfunding horizon\b/gi,
  },
  {
    label: "discretionary grant",
    pattern: /\bdiscretionary (?:federal )?grants?\b/gi,
    term: "discretionary grant",
  },
  {
    label: "reauthorization",
    pattern: /\breauthoriz(?:e|es|ed|ing|ation)\b/gi,
    term: "reauthorization",
  },
  {
    label: "appropriation",
    pattern: /\bappropriat(?:e|es|ed|ing|ion|ions)\b/gi,
    term: "appropriation",
  },
  {
    label: "authorization",
    pattern: /\bauthoriz(?:e|es|ed|ing|ation)\b/gi,
    term: "authorization",
  },
  {
    label: "formula funding",
    pattern: /\bformula funding\b/gi,
    term: "formula funding",
  },
  {
    label: "allocation formula",
    pattern: /\ballocation formula\b/gi,
    term: "allocation formula",
  },
  {
    label: "transit capital",
    pattern: /\btransit capital\b/gi,
    term: "transit capital",
  },
  {
    label: "affirmative consent",
    pattern: /\baffirmative consent\b/gi,
    term: "affirmative consent",
  },
  {
    label: "preemption",
    pattern: /\bpreempt(?:s|ed|ing|ion)?\b/gi,
    term: "preemption",
  },
  {
    label: "sector-specific",
    pattern: /\bsector-specific\b/gi,
    term: "sector-specific",
  },
  {
    label: "compliance costs",
    pattern: /\bcompliance (?:costs?|obligations?)\b/gi,
    term: "compliance",
  },
] as const;

function readerFacingProse(brief: BillBrief): string[] {
  return [
    brief.headline ?? "",
    brief.summary,
    brief.hook,
    ...brief.facts.flatMap((f) => [f.label, f.value, f.note ?? ""]),
    ...brief.changes.flatMap((c) => [
      c.title,
      c.before,
      c.after,
      ...(c.reader
        ? [c.reader.summary, c.reader.question, c.reader.answer]
        : []),
    ]),
    ...brief.affected.flatMap((a) => [a.group, a.takeaway, a.effect]),
    ...brief.unknowns,
    ...(brief.whyNotBefore
      ? [
          brief.whyNotBefore.summary,
          ...brief.whyNotBefore.points.map((point) => point.text),
        ]
      : []),
    ...(brief.deepDive
      ? [brief.deepDive.title, brief.deepDive.dek, brief.deepDive.body]
      : []),
    ...brief.reading.flatMap((item) => [
      item.title,
      item.publisher,
      item.whyRead,
    ]),
  ];
}

/** Untranslated policy jargon in reader-facing fields, deduped. */
export function findUnexplainedJargon(brief: BillBrief): string[] {
  const definedTerms = brief.terms.map((entry) => entry.term.toLowerCase());
  const hits = new Set<string>();

  for (const rule of JARGON_RULES) {
    if (
      "term" in rule &&
      definedTerms.some((term) => term.includes(rule.term))
    ) {
      continue;
    }
    for (const field of readerFacingProse(brief)) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(field)) {
        hits.add(rule.label);
        break;
      }
    }
  }

  return [...hits];
}

/** Excess emphasis is an editorial defect; plain text is valid. Source
 * quotations and long-form paragraphs are deliberately outside this check.
 */
export function findOveremphasis(brief: BillBrief): string[] {
  const fields: { label: string; value: string; allowed: number }[] = [
    { label: "headline", value: brief.headline ?? "", allowed: 0 },
    { label: "summary", value: brief.summary, allowed: 1 },
    { label: "hook", value: brief.hook, allowed: 2 },
    ...brief.changes.flatMap((item, index) => [
      { label: `changes[${index}].before`, value: item.before, allowed: 1 },
      { label: `changes[${index}].after`, value: item.after, allowed: 1 },
      ...(item.reader
        ? [
            {
              label: `changes[${index}].reader.summary`,
              value: item.reader.summary,
              allowed: 1,
            },
            {
              label: `changes[${index}].reader.question`,
              value: item.reader.question,
              allowed: 0,
            },
            {
              label: `changes[${index}].reader.answer`,
              value: item.reader.answer,
              allowed: 1,
            },
          ]
        : []),
    ]),
    ...brief.affected.flatMap((item, index) => [
      {
        label: `affected[${index}].takeaway`,
        value: item.takeaway,
        allowed: 1,
      },
      { label: `affected[${index}].effect`, value: item.effect, allowed: 1 },
    ]),
    ...brief.unknowns.map((value, index) => ({
      label: `unknowns[${index}]`,
      value,
      allowed: 1,
    })),
  ];
  return fields
    .filter(
      ({ value, allowed }) =>
        [...value.matchAll(/\*\*[^*\n]+\*\*/g)].length > allowed,
    )
    .map(({ label }) => label);
}

/* ------------------------------------------------------------------ *
 * Step 1 — structuring
 * ------------------------------------------------------------------ */

/**
 * Derive legal status from the scraped status string rather than asking the
 * model. This drives whether the UI frames changes as "would" or "does", so a
 * string match beats an inference we would have to trust.
 */
export function deriveLegalStatus(
  status: string | null | undefined,
  actions?: readonly BillLifecycleAction[] | null,
  billNumber?: string | null,
): BriefLegalStatus {
  return deriveBillLifecycle({
    billNumber,
    actions,
    latestAction: status,
  }).isEnacted
    ? "enacted"
    : "proposed";
}

function buildBriefPrompt(args: {
  title: string;
  billNumber: string;
  url: string;
  legalStatus: BriefLegalStatus;
  lifecycleLabel: string;
  hasCompletedVote: boolean;
  isResolution: boolean;
  sourceText: string;
  officialSummary?: string | null;
  priorArticle?: string | null;
  readingResearch?: string;
  readingSources?: DualLensSource[];
  loadedPhrases?: string[];
  jargonPhrases?: string[];
  overemphasis?: string[];
}): string {
  const {
    title,
    billNumber,
    url,
    legalStatus,
    lifecycleLabel,
    hasCompletedVote,
    isResolution,
    sourceText,
    officialSummary,
    priorArticle,
    readingResearch,
    readingSources,
    loadedPhrases,
    jargonPhrases,
    overemphasis,
  } = args;

  const tense =
    legalStatus === "enacted"
      ? `This bill is enacted law. Describe provisions in the present tense ("requires", "authorizes") only when the source supports that they are operative. Do not say the law is currently in force or applies now unless the source gives an effective date or implementation detail.`
      : `This bill is a proposal that has NOT become law. Every effect must be conditional ("would require", "would authorize"). Never write that it "will" do something.`;
  const lifecycle = `The official action record currently labels this measure "${lifecycleLabel}". ${
    hasCompletedVote
      ? "You may report that recorded chamber action as a completed fact, but policy effects remain conditional unless the measure is enacted."
      : "No completed chamber vote is recorded. Do not say Congress, the House, or the Senate voted to approve, block, or adopt the measure."
  }${isResolution ? " This is a resolution; adoption is not the same as becoming law." : ""}`;

  const retryNote = loadedPhrases?.length
    ? `\n\nYour previous attempt used loaded political phrasing in your own voice: ${loadedPhrases
        .map((p) => `"${p}"`)
        .join(
          ", ",
        )}. Replace each with the underlying mechanism. Describe what the text does; let the reader judge it.\n`
    : "";
  const jargonRetryNote = jargonPhrases?.length
    ? `\n\nYour previous attempt left policy jargon unexplained in reader-facing copy: ${jargonPhrases
        .map((phrase) => `"${phrase}"`)
        .join(
          ", ",
        )}. Rewrite each in familiar everyday words. If a technical term is truly essential, add it to "terms", define it simply, and still explain the practical meaning where it appears.\n`
    : "";
  const emphasisRetryNote = overemphasis?.length
    ? `\n\nYour previous attempt used too many bold spans in these fields: ${overemphasis
        .map((field) => `"${field}"`)
        .join(
          ", ",
        )}. Remove emphasis rather than distributing it across every sentence. Plain text is valid. Use at most one short bold span per field (two for hook), only when it materially helps scanning.\n`
    : "";

  return `You are a careful, nonpartisan editor writing for people who do not follow politics. Earn their attention with a specific everyday consequence, then explain it clearly. Assume no interest in a bill number, an agency acronym, or legislative procedure. The reader must understand each field on its own.

${tense}

${lifecycle}

Your job is to explain the policy, not to promote or attack it. Treat the title, acronym, findings, purpose clauses, and sponsor statements as claims about intent — not proof of results. Base every factual statement on the supplied source text.

Before filling in the fields, silently identify:
1. The concrete mechanisms: what authority, rule, funding, eligibility, deadline, review, oversight, enforcement, or safeguard is added, removed, weakened, expanded, or transferred.
2. Who gains discretion, money, rights, access, or speed.
3. Who could lose protection, oversight, recourse, funding, or control.
4. What the text does not establish.

Rules that decide whether this brief ships:

- **Mechanism over marketing.** Removing or waiving rules, reviews, reporting, or oversight is deregulation or reduced oversight. Say that. Do not hide it behind "cuts red tape", "modernizes", "streamlines", or "speeds up". Equally, do not attach a hostile label the text does not support.
- **Keep funding scope precise.** If the source makes federal funding conditional on conduct, describe the funding eligibility consequence and the covered recipients. Do not turn that condition into a blanket ban on the underlying activity or on all institutions unless the source says so.
- **Quotes are verbatim.** Every "quote" field must be an exact, unedited span copied character-for-character from the source text below. Do not paraphrase, splice, trim mid-word, or fix grammar. Quotes that do not appear in the source are removed automatically, so a paraphrase in quotation marks just loses you a citation.
- **No invented figures.** A number, date, or dollar amount goes in "facts" only if the source states it. Fewer facts is correct; a plausible-looking invented figure is not.
- **No manufactured symmetry.** If the text supports one consequence more strongly than another, say so. Use "mixed" or "unclear" for an affected group rather than balancing the list for its own sake.
- **Use only the allowed change kinds.** Every change "kind" must be exactly one of: "creates", "repeals", "expands", "restricts", "requires", "waives", "funds", or "transfers". Map synonyms such as "sets" or "establishes" to "creates", and "restructures" to the closest allowed mechanism.
- **Neutral vocabulary.** In your own voice, avoid words that carry a verdict — "common sense", "radical", "landmark", "reckless", "burdensome", "handout", "much-needed". Attribute goals with "aims to" or "supporters say" rather than asserting them.
- **Zero assumed knowledge.** The reader may know nothing about politics, government, energy markets or the program in the source. Begin with a familiar human action: who joins, pays, receives something, or faces a rule. Naming a program is not explaining it. On first mention, explain what it does in the visible summary. Replace terms such as "subscription", "capacity", "bill credit" and "appropriation" with everyday words, or immediately explain them in the same sentence. A glossary or extra tap must not be required to understand the takeaway. Preserve source meaning: a credit on an electricity bill does not establish net savings after fees, and capacity is not the electricity actually generated. Do not invent personal benefits or assume a program applies to everyone.
- **Design for the first encounter.** The headline gives one recognizable idea; the opening summary explains that idea rather than repeating the headline. One leading figure provides its exact value and what it measures. Explain that unit or unfamiliar concept in its short visible fact note. Put legal machinery and remaining figures in the fuller fields. Keep definitions short and preserve material conditions rather than adding a textbook introduction.
- **Plain language.** Aim for an 8th-grade reading level everywhere. Prefer familiar verbs and concrete descriptions: "Congress approves the money each year", not "subject to annual appropriations"; "several federal programs", not "discretionary federal grants"; "how long states can plan ahead", not "funding horizon". If a general reader might have to look a term up, either translate it or define it in "terms". Even when defined, explain its practical meaning where it appears.
- **Let the words carry the story.** Plain text is valid. Do not bold a phrase in every field or every paragraph. Use at most one short bold span in a short field (two in the hook), only when a figure or consequence would otherwise be hard to find. Never bold a whole sentence, heading, verdict, or verbatim quote.
- **Concise still means coherent.** Every visible field must make sense when read by itself. Never emit a noun phrase, dangling clause, missing subject, or sentence fragment merely to save words. Read each field independently before returning it.
- **Length limits are hard.** Keep the summary at 180 characters or fewer and the hook at 600; fact labels at 48, values at 60, and notes at 90; the article headline and change titles at 90 and each before/after at 240; affected-group names at 80, takeaways at 240, and effects at 400; unknowns and term definitions at 250; the "whyNotBefore" summary and each of its point texts at 250 and 420; the deep-dive title at 90 and its preview at 250. Count conservatively, including **bold** markers. Prefer a shorter complete sentence over extra detail. Omit an optional field instead of returning an overlong value.

Field notes:
- "headline" is the article's standalone headline, separate from provision titles. Name the specific program, service or action before any summary is read. An unfamiliar reader must be able to answer "Which program? What share of what?" from the headline alone. Never write "Half the program reserved for low-income households" without naming the program and the measured share. Prefer a familiar subject and action over a technical label: naming "renewable energy subscriptions" or "51% of capacity" is not enough if the reader does not know what either means. The headline can leave the exact number to the immediately visible takeaway or lead figure, provided it does not distort the claim. Explain the program and any unfamiliar measurement in those visible fields. Do not call a renewable energy program solar-only, call capacity a share of money or households, or replace an exact minimum with "half". No bill number, acronyms or bold markup. Prefer 6–12 familiar words, but retain the subject and material qualifier rather than making the headline short and meaningless.
- Before returning, read the headline and each provision title alone, without the bill number, image, deck or comparison. Rewrite any that need those other fields to identify their subject. Do not assert outcomes or timing the text does not establish.
- "summary" is the short opening sentence before the reader explores individual changes. State the single most important practical change or catch in one standalone sentence under 180 characters. Preserve legal status, do not spend words introducing the bill, and use bold only if it helps.
- "hook" is the optional extended opening for readers who ask for more context. Write one coherent paragraph of 2–3 short sentences. First explain the most consequential practical changes; then state the most important limitation, condition, or uncertainty. Connect the ideas naturally instead of listing figures. Preserve legal status ("would" for proposals), and do not imply every reader is personally affected. Let plain sentences do the work; at most two short bold spans may mark an essential figure or consequence.
- **Do not manufacture a twist.** An ordinary, clearly explained consequence is enough. Never force a title-versus-text reveal, unrelated rider, hidden catch, or motive. Identify a genuine mismatch only when the current operative source clearly supports it. Amended documents can contain deleted or superseded text: do not add old and new versions together. When lost formatting makes the status of a provision uncertain, omit that claim and name the uncertainty rather than building a hook around it.
- **Sound like a person explaining a specific thing.** Prefer a short subject and active verb. Avoid bureaucratic noun stacks such as "fast-pay process implementation", "funding eligibility modification", and "heat-plan requirement" when the actual action fits in ordinary words. Do not open with "This legislation", "The measure seeks to", or "Under the provisions of". Do not repeat the bill number in reader-facing headlines.
- **Headlines earn interest honestly.** Use a direct, declarative deep-dive headline, usually 5–10 words. State what would change in ordinary language. Do not use rhetorical questions, jokes, or conversational teasers. It must make sense to someone who has never heard of the agency. A question must not smuggle in an unproven claim. Avoid teasing "what you need to know", "what it means for you", "the surprising truth", or generic "would change—and what would stay the same" structures. Do not promise a benefit whose timing or implementation the bill leaves open.
- "changes" must contrast current law ("before") with the proposal ("after"). If the source does not establish current law, say that in "before" instead of guessing. Evaluate every change independently for a direct supporting quote; when the official text contains one, include it so every supported card has its own route back to the text. Never invent or stretch a quote merely to make the cards look consistent.
- Every change must also include "reader": a short "summary", a useful "question", and its complete "answer". This is the first encounter for someone with little interest in politics. The title and reader.summary must explain one recognizable human consequence without requiring the before/after comparison, glossary, bill number or agency name. Write the title as a short, direct headline, usually 4–8 familiar words. Prefer a specific action such as "Juries could consider related, less serious crimes" over "Another option for the jury" or "Lesser-related-offense instruction expansion". Name the program or service in each title rather than referring to "the program" or "the rule". Keep the source denominator and exact thresholds when using numbers. Avoid legal noun stacks such as "the court makes findings" in the summary; explain the real action instead.
- The reader.summary is normally 20–35 words in one or two short sentences. Keep essential scope, conditions and proposed/enacted tense visible. Do not imply the consequence affects everyone or is automatically a benefit. The reader.question is the next useful thing a person would ask; the reader.answer must actually answer it from the source. If you ask about three conditions, explain all three, including their limitations. Preserve the exact notice cut-off and any consent/good-cause exceptions. A judge checking requirements is not the same as having unrestricted discretion to approve. Before/after retain the fuller legal comparison; do not duplicate those paragraphs in reader.summary.
- reader.quote is optional and must directly support reader.answer, not merely concern the same provision. Include an exact supporting passage and its section locator when available. Never reuse changes.quote just to populate a Source control. An absence claim such as "the bill does not specify a price" may have no single supporting passage; omit reader.quote in that case. Say "whether customers would save" when savings are unknown, rather than "how much they would save". Verification only establishes that quoted words occur in the source, not that a quote proves an interpretation.
- Each affected-group "takeaway" is a concise effect summary; "effect" is the fuller explanation opened on demand. Write one complete standalone sentence that names the group or a clear pronoun and states what would happen. For example: "States would get a **longer window to plan multi-year projects**." Do not return fragments such as "a longer funding horizon" or "depends on final rules." Put qualifications and mechanism detail in "effect".
- "unknowns" is required. Name what the text leaves open — undefined terms, delegated decisions, unfunded pieces, effects the source does not establish. State the exact unresolved choice or consequence. Do not add emphasis as a routine formatting step.
- "terms" appears near the top of the article. Include only essential vocabulary that changes how the reader understands the mechanism, and define it in one short everyday sentence. Bold the practical meaning, not the term again.
- "whyNotBefore" is an optional expandable answer to "Why wasn't this implemented before?" Use it only when the research documents a real historical answer. Explain earlier attempts, disagreements, legal or budget constraints, implementation tradeoffs, or changed circumstances without speculating about motives. State the documented barrier or tradeoff directly. Every point needs at least one citation, the section needs at least two different opened sources overall, and every citation URL must exactly match a verified source below.
- "deepDive" is an optional long-form Billion explainer for readers who deliberately ask for more. It opens as its own article, so write natural markdown with short paragraphs, useful subheads, selective bolding, and bullets only when they clarify a list. Focus on one important question or consequence instead of repeating the entire structured brief. Use only the length the subject needs. Aim for 150–350 words; a short bill may need less. Do not expand a short source into a long article to fill a target.
- "reading" recommends outside articles. Use ONLY the verified research sources supplied below, copy their URLs exactly, and explain in one sentence what each adds. Bold the specific concept or evidence the source adds. Omit weak or irrelevant links.${retryNote}${jargonRetryNote}${emphasisRetryNote}

---
Bill: ${billNumber} — ${title}
Status: ${legalStatus === "enacted" ? "enacted" : "proposed, not yet law"}
Source URL: ${url}
${
  priorArticle
    ? `\nPrior nonpartisan analysis of this bill (already vetted for framing — reuse its judgments, but pull all quotes from the official text below):\n${priorArticle.slice(0, 6000)}\n`
    : ""
}
${
  readingResearch
    ? `\nResearch notes for historical context and optional deeper reading:\n${readingResearch.slice(0, 7000)}\n`
    : ""
}
${
  readingSources?.length
    ? `\nVerified opened sources ("whyNotBefore" citations and "reading" URLs must exactly match one of these):\n${readingSources
        .map((source) => `[${source.id}] ${source.title} — ${source.url}`)
        .join("\n")}\n`
    : '\nNo verified outside sources were found. Omit "whyNotBefore" and return an empty reading list.\n'
}
${
  officialSummary
    ? `\nOfficial CRS summary of the whole bill (nonpartisan, written by the Congressional Research Service). The official text below may be windowed and end mid-section, so treat this summary as authoritative for the bill's overall scope — including provisions the excerpt cuts off, such as penalties and effective dates. Do not report something as unspecified when this summary specifies it. Never quote from this summary: every "quote" must come verbatim from the official text below.\n${officialSummary.slice(0, 6000)}\n`
    : ""
}
Official text:
${sourceText.slice(0, SOURCE_WINDOW)}
---

Produce the structured brief now.`;
}

/**
 * Generate a verified, framing-linted brief for a bill.
 *
 * Returns null when structuring fails outright; throws `AIRateLimitError` so
 * the caller's existing rate-limit handling defers the whole item, matching
 * `generateDualLens`.
 */
export async function generateBillBrief(args: {
  title: string;
  billNumber: string;
  url: string;
  fullText: string;
  officialSummary?: string | null;
  status?: string | null;
  actions?: readonly BillLifecycleAction[] | null;
  priorArticle?: string | null;
}): Promise<Omit<BillBriefRecord, "generatedAt"> | null> {
  if (rateLimitHit) throw new AIRateLimitError();

  const lifecycle = deriveBillLifecycle({
    billNumber: args.billNumber,
    actions: args.actions,
    latestAction: args.status,
  });
  const legalStatus = lifecycle.isEnacted ? "enacted" : "proposed";
  const readingResearch = await researchBillContext(
    args.title,
    args.billNumber,
    args.fullText,
    args.url,
  );
  let loadedPhrases: string[] | undefined;
  let jargonPhrases: string[] | undefined;
  let overemphasis: string[] | undefined;
  let verifiedFallback: Omit<BillBriefRecord, "generatedAt"> | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const {
        output: generatedOutput,
        usage,
        providerMetadata,
      } = await generateText({
        model: getStructuredLlm(),
        output: Output.object({ schema: GeneratedBillBriefSchema }),
        prompt: buildBriefPrompt({
          title: args.title,
          billNumber: args.billNumber,
          url: args.url,
          legalStatus,
          lifecycleLabel: lifecycle.label,
          hasCompletedVote: lifecycle.hasCompletedVote,
          isResolution: lifecycle.isResolution,
          sourceText: args.fullText,
          officialSummary: args.officialSummary,
          priorArticle: args.priorArticle,
          readingResearch: readingResearch.notes,
          readingSources: readingResearch.sources,
          loadedPhrases,
          jargonPhrases,
          overemphasis,
        }),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);
      const modelVersion = getGeneratedModelVersion({ providerMetadata });

      const output = parseBriefWithSectionRecovery(
        truncateOverlongLists(
          dropUncitedContextPoints(
            coerceAffectedDirections(
              dropUnrecognisedChangeKinds(
                withoutNulls(generatedOutput),
                args.billNumber,
              ),
              args.billNumber,
            ),
            args.billNumber,
          ),
          args.billNumber,
        ),
        args.billNumber,
      );
      const quoteResult = verifyBriefQuotes(output, args.fullText);
      const briefWithReading = verifyBriefReading(
        quoteResult.brief,
        readingResearch.sources,
      );
      const brief = verifyBriefContext(
        briefWithReading,
        readingResearch.sources,
        args.billNumber,
      );
      const { verified, dropped } = quoteResult;
      if (dropped > 0) {
        logger.warn(
          `Brief for ${args.billNumber}: dropped ${dropped} unverified quote(s), kept ${verified}`,
        );
      }

      const loaded = findLoadedLanguage(brief);
      const jargon = findUnexplainedJargon(brief);
      const excessive = findOveremphasis(brief);
      // Retry once with the offending phrases named; on the final attempt keep
      // the brief anyway — a slightly colored word is a smaller failure than
      // shipping no brief at all, and the warning surfaces it in the logs.
      if (
        (loaded.length > 0 || jargon.length > 0 || excessive.length > 0) &&
        attempt < MAX_ATTEMPTS
      ) {
        verifiedFallback = {
          ...brief,
          version: BILL_BRIEF_VERSION,
          legalStatus,
          verifiedQuotes: verified,
          modelVersion,
        };
        logger.warn(
          `Brief for ${args.billNumber}: reader-facing copy needs revision (${[...loaded, ...jargon, ...excessive].join(", ")}) — regenerating`,
        );
        loadedPhrases = loaded;
        jargonPhrases = jargon;
        overemphasis = excessive;
        continue;
      }
      if (loaded.length > 0) {
        logger.warn(
          `Brief for ${args.billNumber}: keeping brief with loaded language ${loaded.join(", ")}`,
        );
      }
      if (jargon.length > 0) {
        logger.warn(
          `Brief for ${args.billNumber}: keeping brief with unexplained jargon ${jargon.join(", ")}`,
        );
      }
      if (excessive.length > 0) {
        logger.warn(
          `Brief for ${args.billNumber}: keeping brief with excess emphasis in ${excessive.join(", ")}`,
        );
      }

      logger.success(
        `Brief for ${args.billNumber}: ${brief.changes.length} change(s), ${verified} verified quote(s)`,
      );
      return {
        ...brief,
        version: BILL_BRIEF_VERSION,
        legalStatus,
        verifiedQuotes: verified,
        modelVersion,
      };
    } catch (error) {
      if (isRateLimitError(error)) {
        setRateLimitHit(true);
        throw new AIRateLimitError();
      }
      logger.warn(
        `Brief structuring failed on attempt ${attempt} for ${args.billNumber}`,
        describeStructuringFailure(error),
      );
      if (attempt === MAX_ATTEMPTS) {
        if (verifiedFallback) {
          logger.warn(
            `Brief for ${args.billNumber}: polishing retry failed; keeping the verified first draft`,
          );
          return verifiedFallback;
        }
        return null;
      }
    }
  }
  return null;
}
