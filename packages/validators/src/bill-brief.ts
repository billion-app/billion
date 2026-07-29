/**
 * Bill Brief — the structured replacement for the markdown "wall of text"
 * article.
 *
 * The old pipeline emitted one long markdown blob with four `##` sections. It
 * read like a policy memo: correct, sourced, and almost nobody finished it.
 * A brief keeps every editorial guarantee (nonpartisan framing, no invented
 * facts, provenance back to the original text) but stores the analysis as
 * *typed pieces* instead of prose, so the client can render each piece as the
 * UI element it actually is — stat tiles, before/after rows, affected-group
 * cards, a collapsed glossary — and the reader can stop at any depth.
 *
 * Editorial rules encoded in the types rather than trusted to a prompt:
 *
 *  - `kind` on a change is a *mechanical* verb (creates/repeals/funds/…), never
 *    an evaluative one. A brief cannot say a change is good or bad; it can only
 *    say what the change does.
 *  - `before`/`after` forces the model to state current law separately from the
 *    proposed change, which is where accessible summaries usually blur.
 *  - `quote` carries verbatim source text plus a locator, so every claim can be
 *    traced into the bill. Quotes are verified against the source before
 *    storage — see `verifyBriefQuotes` in the scraper.
 *  - `unknowns` is a required escape valve: the model is expected to name what
 *    the text does not settle instead of filling the gap.
 *  - `direction` on an affected group tops out at "mixed"/"unclear", so the
 *    model can decline to score a group rather than manufacturing symmetry.
 *
 * Argument-level "both sides" framing deliberately lives elsewhere, in the
 * existing cited dual-lens (`ContentLens`). A brief describes the mechanism;
 * the lens carries the debate.
 *
 * Length, by contrast, is *guidance and not a constraint*. Target lengths live
 * in each field's `.describe()` — which is what reaches the model — rather than
 * in a `.max()`. A hard cap rejected the entire brief when one card title ran
 * four characters long, and since a schema failure is thrown before any of the
 * retry hints are computed, the retry re-sent an identical prompt and failed
 * identically; ~15% of briefs were lost that way. An overlong string degrades
 * one card, so it is strictly better to store it than to discard a verified,
 * fully-cited brief. The `.min()` floors are kept: they catch a field that is
 * empty or truncated rather than one that is merely wordy.
 */
import { z } from "zod";

/** Bump when the shape or generation contract requires cached rows to refresh. */
export const BILL_BRIEF_VERSION = 7;

/**
 * What a provision mechanically does. Deliberately descriptive: a reader can
 * disagree with a "restricts" and still agree it is a restriction. Adding an
 * evaluative member here (e.g. "improves") would break the guarantee.
 */
export const BriefChangeKindSchema = z.enum([
  "creates",
  "repeals",
  "expands",
  "restricts",
  "requires",
  "waives",
  "funds",
  "transfers",
]);
export type BriefChangeKind = z.infer<typeof BriefChangeKindSchema>;

/** Human label for a change kind, for badges. */
export const CHANGE_KIND_LABEL: Record<BriefChangeKind, string> = {
  creates: "Creates",
  repeals: "Repeals",
  expands: "Expands",
  restricts: "Restricts",
  requires: "Requires",
  waives: "Waives",
  funds: "Funds",
  transfers: "Transfers",
};

/**
 * A verbatim excerpt from the source document. `text` must appear in the
 * source — the generator drops quotes that fail verification rather than
 * shipping a plausible-looking paraphrase in quotation marks.
 *
 * `text` deliberately carries no length floor. `isQuoteGrounded` already
 * rejects anything under 20 normalized characters as an accidental match, and
 * `verifyBriefQuotes` then strips just that quote and keeps the claim. A schema
 * floor duplicated that check one layer too early, where the only available
 * outcome was rejecting the entire brief: an 11-character `"shall waive"` cost
 * a complete, fully-cited brief for H.R. 9833.
 */
export const BriefQuoteSchema = z.object({
  text: z
    .string()
    .trim()
    .describe(
      "A verbatim, unedited span copied from the source text, ideally under 1200 characters. Never paraphrase, reorder, or fix grammar inside a quote — quote a shorter span rather than trimming words out of a long one.",
    ),
  locator: z
    .string()
    .trim()
    .optional()
    .describe(
      'Where the quote appears, as written in the document — e.g. "Sec. 4(b)(2)" or "Title II", normally well under 120 characters. Omit if the source has no usable label.',
    ),
});
export type BriefQuote = z.infer<typeof BriefQuoteSchema>;

/**
 * One tile in the scannable header row: a number, date, or scope the reader
 * would want before deciding whether to keep reading.
 */
export const BriefFactSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2)
    .describe(
      'What the figure is — e.g. "Authorized funding", "Deadline". Keep it under 48 characters; it is a tile label, not a sentence.',
    ),
  value: z
    .string()
    .trim()
    .min(1)
    .describe(
      'The figure itself, formatted for a tile — e.g. "$1.2B", "Jan 1, 2027", "38 states". Keep it under 60 characters.',
    ),
  note: z
    .string()
    .trim()
    .optional()
    .describe(
      "One short clause of context, under 90 characters. Omit rather than padding.",
    ),
  quote: BriefQuoteSchema.optional().describe(
    "The source span the figure was read from.",
  ),
});
export type BriefFact = z.infer<typeof BriefFactSchema>;

/**
 * A single concrete policy change, stated as current law → proposed law.
 *
 * A change deliberately carries no image field. It briefly had one: an enum of
 * four JPGs bundled in the client, which existed for seeded demo rows and was
 * never meant to reach production. The generator picked one for only 21 of 601
 * changes and was wrong most of those times — "public transit" illustrated a
 * censorship-circumvention working group — because the real subject of a bill
 * is almost never one of four stock scenes. Per-change artwork should be
 * generated from the change itself; until it is, no image is correct.
 */
export const BriefChangeSchema = z.object({
  kind: BriefChangeKindSchema.describe(
    "The mechanical action. Pick the verb the text supports, not the one the sponsor prefers.",
  ),
  title: z
    .string()
    .trim()
    .min(8)
    .describe(
      "Everyday-language name for this change, kept under 70 characters so it fits one card heading. Describe what a person would recognize, not the legislative mechanism; for example, 'Ten years of road money for states', not 'Formula funding authorization'. If it will not fit, narrow the change rather than lengthening the name.",
    ),
  before: z
    .string()
    .trim()
    .min(10)
    .describe(
      "What happens today, using words a general reader already knows, in under 240 characters. Translate legislative and agency terminology rather than shortening it. If the source does not establish current law, say so plainly. At most two short **bold** spans may mark the phrases a scanner should retain.",
    ),
  after: z
    .string()
    .trim()
    .min(10)
    .describe(
      "What would happen under this measure, in concrete everyday language, in under 240 characters. Explain who acts, what they do, and what changes; avoid unexplained terms such as authorization, appropriation, discretionary grant, allocation formula, and funding horizon. If one provision does too much to fit, split it into a separate change rather than writing a longer sentence. Preserve legal status. At most two short **bold** spans may mark the phrases a scanner should retain.",
    ),
  quote: BriefQuoteSchema.optional().describe(
    "The exact provision this change is drawn from. Include it whenever the source contains a direct supporting span; evaluate every change rather than citing only the first card.",
  ),
});
export type BriefChange = z.infer<typeof BriefChangeSchema>;

/**
 * Who is on the receiving end. `direction` describes the flow of money, power,
 * access, or obligation — not whether that flow is desirable.
 */
export const BriefAffectedSchema = z.object({
  group: z
    .string()
    .trim()
    .min(3)
    .describe(
      'A specific group — "Medicare Part D enrollees", not "the American people". Keep it under 80 characters.',
    ),
  takeaway: z
    .string()
    .trim()
    .min(24)
    .describe(
      "A complete, standalone sentence summarizing the concrete effect for this group, in under 240 characters. It must name the subject and action, make sense without surrounding text, and never be a noun phrase or dangling clause. Mark one short, concrete phrase with **double asterisks**.",
    ),
  effect: z
    .string()
    .trim()
    .min(12)
    .describe(
      "Context explaining what concretely changes for this group, in one or two coherent sentences under 400 characters. One short **bold** span may mark the concrete consequence a scanner should retain, but the UI does not use that span as a headline.",
    ),
  direction: z
    .enum(["gains", "loses", "mixed", "unclear"])
    .describe(
      "Whether this group gains or loses money, access, discretion, protection, or obligations. Use 'mixed' when both happen and 'unclear' when the text does not settle it — never guess to balance the list.",
    ),
});
export type BriefAffected = z.infer<typeof BriefAffectedSchema>;

/** A term the reader would otherwise have to look up. */
export const BriefTermSchema = z.object({
  term: z
    .string()
    .trim()
    .min(2)
    .describe("The term as a reader would meet it, under 60 characters."),
  plain: z
    .string()
    .trim()
    .min(15)
    .describe(
      "A one-sentence definition in everyday words, under 250 characters. Mark the practical meaning the reader should retain with one short **bold** span.",
    ),
});
export type BriefTerm = z.infer<typeof BriefTermSchema>;

/** A real article the research loop found and opened before recommending it. */
export const BriefReadingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(8)
    .describe("The article's real headline, normally under 140 characters."),
  publisher: z
    .string()
    .trim()
    .min(2)
    .describe("The publication's name, normally under 70 characters."),
  url: z.url(),
  whyRead: z
    .string()
    .trim()
    .min(20)
    .describe(
      "One plain-language sentence, under 180 characters, explaining what this article helps the reader understand. Mark its specific added value with one short **bold** span.",
    ),
});
export type BriefReading = z.infer<typeof BriefReadingSchema>;

/** One opened research source attached directly to a historical-context claim. */
export const BriefContextCitationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(8)
    .describe("The source's real headline, normally under 140 characters."),
  publisher: z
    .string()
    .trim()
    .min(2)
    .describe("The publication's name, normally under 70 characters."),
  url: z.url(),
});
export type BriefContextCitation = z.infer<typeof BriefContextCitationSchema>;

/** A plain-language claim about why this policy has not already happened. */
export const BriefContextPointSchema = z.object({
  text: z
    .string()
    .trim()
    .min(40)
    .describe(
      "A coherent, neutral explanation of one documented barrier, tradeoff, or earlier attempt, in under 420 characters. Do not speculate about motives. Mark one or two short, factual phrases with **double asterisks**.",
    ),
  citations: z
    .array(BriefContextCitationSchema)
    .min(1)
    .max(3)
    .describe(
      "Opened research pages that directly support this point. Copy each verified URL exactly.",
    ),
});
export type BriefContextPoint = z.infer<typeof BriefContextPointSchema>;

/** Optional, cited historical context shown as an expandable detail. */
export const BriefContextSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(40)
    .describe(
      "A one- or two-sentence preview, under 250 characters, of the main reason this proposal was not already adopted. Mark one short statement of the central barrier with **double asterisks**.",
    ),
  points: z
    .array(BriefContextPointSchema)
    .min(1)
    .max(4)
    .describe(
      "Documented earlier attempts, disagreements, constraints, or changed circumstances. The section is omitted unless at least two opened sources support it.",
    ),
});
export type BriefContext = z.infer<typeof BriefContextSchema>;

/** Billion's optional long-form explainer for readers who choose more depth. */
export const BriefDeepDiveSchema = z.object({
  title: z
    .string()
    .trim()
    .min(8)
    .describe("The explainer's headline, under 90 characters."),
  dek: z
    .string()
    .trim()
    .min(30)
    .describe(
      "A plain-language preview of what the reader will learn, under 250 characters. Mark its central question or insight with one short **bold** span.",
    ),
  body: z
    .string()
    .trim()
    .min(350)
    .describe(
      "A readable markdown article, normally under 5000 characters, with short paragraphs, useful subheads, selective bolding, and bullets only where they clarify a list. It may focus on one important question rather than repeat the whole bill brief.",
    ),
});
export type BriefDeepDive = z.infer<typeof BriefDeepDiveSchema>;

/**
 * The model-authored portion of a brief. Everything derivable without an LLM
 * (legal status, timestamps, model version) is added by the pipeline and lives
 * on `BillBriefRecordSchema` instead, so the model is never asked for a fact we
 * already know.
 */
export const BillBriefSchema = z.object({
  hook: z
    .string()
    .trim()
    .min(60)
    .describe(
      "A coherent 2–3 sentence 'What this means for you' paragraph, under 600 characters. Explain the bill's most consequential concrete changes and the most important limitation or uncertainty in plain language. It must stand alone, not read like a list of facts, and preserve proposed-versus-enacted status. Mark two or three short, concrete phrases with **double asterisks** so scanners can retain the key changes; never bold a whole sentence.",
    ),
  facts: z
    .array(BriefFactSchema)
    .max(4)
    .describe(
      "Up to four scannable figures. Include only what the source states; an empty list is better than an invented number.",
    ),
  changes: z
    .array(BriefChangeSchema)
    .min(1)
    .max(5)
    .describe(
      "The most consequential provisions, most significant first. Include changes that remove reviews, oversight, reporting, or eligibility — do not fold them into a positive-sounding summary.",
    ),
  affected: z
    .array(BriefAffectedSchema)
    .min(1)
    .max(4)
    .describe("Specific groups on the receiving end of those changes."),
  unknowns: z
    .array(
      z
        .string()
        .trim()
        .min(15)
        .describe(
          "One open question, stated plainly in under 250 characters. Mark the unresolved decision or consequence with one short **bold** span.",
        ),
    )
    .min(1)
    .max(3)
    .describe(
      "What the text does not settle: unfunded pieces, undefined terms, delegated decisions, effects the source does not establish.",
    ),
  terms: z
    .array(BriefTermSchema)
    .max(5)
    .describe("Jargon a general reader would stumble on."),
  whyNotBefore: BriefContextSchema.optional().describe(
    "Optional cited historical context answering why this policy was not already implemented. Use only the supplied opened research sources; omit it when the research does not establish a clear answer.",
  ),
  deepDive: BriefDeepDiveSchema.optional().describe(
    "One optional Billion explainer for a reader who wants more depth. Focus on the most important unresolved concept or consequence instead of repeating the entire brief.",
  ),
  reading: z
    .array(BriefReadingSchema)
    .max(4)
    .describe(
      "Optional outside articles discovered and opened by the research loop. Recommend only sources from the supplied verified reading list and copy each URL exactly.",
    ),
});
export type BillBrief = z.infer<typeof BillBriefSchema>;

/**
 * Legal status is derived from the scraped bill status, never asked of the
 * model — it decides whether the UI says a measure "would" or "does" change
 * things, and getting it from a string match is both cheaper and correct.
 */
export const BriefLegalStatusSchema = z.enum(["proposed", "enacted"]);
export type BriefLegalStatus = z.infer<typeof BriefLegalStatusSchema>;

const BriefRecordMetadataSchema = {
  legalStatus: BriefLegalStatusSchema,
  /** Count of quotes that matched the source text verbatim, after verification. */
  verifiedQuotes: z.number().int().min(0),
  generatedAt: z.string(),
  modelVersion: z.string(),
};

/** A stored brief: model output plus pipeline-owned provenance. */
export const BillBriefRecordSchema = BillBriefSchema.extend({
  version: z.literal(BILL_BRIEF_VERSION),
  ...BriefRecordMetadataSchema,
});
export type BillBriefRecord = z.infer<typeof BillBriefRecordSchema>;

/** The rich brief shape before emphasis became a brief-wide contract. */
const BillBriefV6RecordSchema = BillBriefSchema.extend({
  version: z.literal(6),
  ...BriefRecordMetadataSchema,
});

/** The immediately preceding rich-brief shape, before cited history was added. */
const BillBriefV5RecordSchema = BillBriefSchema.extend({
  version: z.literal(5),
  ...BriefRecordMetadataSchema,
});

/**
 * The first shipped brief shape. It had optional long-form `sections`, no
 * affected-group takeaway, and no researched reading/history layer.
 */
const BillBriefV1RecordSchema = z.object({
  version: z.literal(1),
  hook: z.string().trim().min(24).max(420),
  facts: z.array(BriefFactSchema).max(4),
  changes: z.array(BriefChangeSchema).min(1).max(5),
  affected: z
    .array(
      z.object({
        group: z.string().trim().min(3).max(52),
        effect: z.string().trim().min(12).max(220),
        direction: z.enum(["gains", "loses", "mixed", "unclear"]),
      }),
    )
    .min(1)
    .max(4),
  unknowns: z.array(z.string().trim().min(15).max(220)).min(1).max(3),
  terms: z.array(BriefTermSchema).max(5),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(3).max(60),
        body: z.string().trim().min(120).max(2200),
      }),
    )
    .max(3),
  ...BriefRecordMetadataSchema,
});

function conciseTakeaway(effect: string): string {
  const firstSentence = /^.*?[.!?](?:\s|$)/.exec(effect)?.[0]?.trim();
  const candidate = firstSentence ?? effect;
  if (candidate.length <= 140) return candidate;
  return `${candidate.slice(0, 136).replace(/\s+\S*$/, "")}…`;
}

/**
 * Parse any brief shape the app has shipped and return the current client
 * shape. Normalizing at the API boundary keeps old cached rows renderable while
 * the scraper independently decides whether they should be regenerated.
 */
export function parseBillBriefRecord(value: unknown): BillBriefRecord | null {
  const current = BillBriefRecordSchema.safeParse(value);
  if (current.success) return current.data;

  const v6 = BillBriefV6RecordSchema.safeParse(value);
  if (v6.success) {
    return { ...v6.data, version: BILL_BRIEF_VERSION };
  }

  const v5 = BillBriefV5RecordSchema.safeParse(value);
  if (v5.success) {
    return { ...v5.data, version: BILL_BRIEF_VERSION };
  }

  const v1 = BillBriefV1RecordSchema.safeParse(value);
  if (!v1.success) return null;
  const { sections: _legacySections, ...legacy } = v1.data;
  return {
    ...legacy,
    version: BILL_BRIEF_VERSION,
    affected: legacy.affected.map((item) => ({
      ...item,
      takeaway: conciseTakeaway(item.effect),
    })),
    reading: [],
  };
}

/**
 * Whether a stored brief is renderable by the current client, including a
 * shape that can be normalized from an older shipped schema.
 */
export function isUsableBillBrief(value: unknown): boolean {
  return parseBillBriefRecord(value) !== null;
}

/** Whether the scraper can reuse a cached row without regenerating it. */
export function isCurrentBillBrief(value: unknown): boolean {
  return BillBriefRecordSchema.safeParse(value).success;
}
