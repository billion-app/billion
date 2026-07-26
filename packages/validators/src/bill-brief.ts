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
 */
import { z } from "zod";

/** Bump when the shape changes in a way stored rows cannot satisfy. */
export const BILL_BRIEF_VERSION = 1;

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
 */
export const BriefQuoteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(20)
    .max(400)
    .describe(
      "A verbatim, unedited span copied from the source text. Never paraphrase, reorder, or fix grammar inside a quote.",
    ),
  locator: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe(
      'Where the quote appears, as written in the document — e.g. "Sec. 4(b)(2)" or "Title II". Omit if the source has no usable label.',
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
    .max(28)
    .describe('What the figure is — e.g. "Authorized funding", "Deadline".'),
  value: z
    .string()
    .trim()
    .min(1)
    .max(28)
    .describe(
      'The figure itself, formatted for a tile — e.g. "$1.2B", "Jan 1, 2027", "38 states".',
    ),
  note: z
    .string()
    .trim()
    .max(90)
    .optional()
    .describe("One short clause of context. Omit rather than padding."),
  quote: BriefQuoteSchema.optional().describe(
    "The source span the figure was read from.",
  ),
});
export type BriefFact = z.infer<typeof BriefFactSchema>;

/** A single concrete policy change, stated as current law → proposed law. */
export const BriefChangeSchema = z.object({
  kind: BriefChangeKindSchema.describe(
    "The mechanical action. Pick the verb the text supports, not the one the sponsor prefers.",
  ),
  title: z
    .string()
    .trim()
    .min(8)
    .max(70)
    .describe("Plain-language name for this change, no jargon."),
  before: z
    .string()
    .trim()
    .min(10)
    .max(240)
    .describe(
      "What the situation is today, under current law or practice. If the source does not establish current law, say so plainly here.",
    ),
  after: z
    .string()
    .trim()
    .min(10)
    .max(240)
    .describe(
      "What the situation becomes under this measure. Preserve legal status: a proposal 'would' change things.",
    ),
  quote: BriefQuoteSchema.optional().describe(
    "The provision this change is drawn from.",
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
    .max(52)
    .describe(
      'A specific group — "Medicare Part D enrollees", not "the American people".',
    ),
  effect: z
    .string()
    .trim()
    .min(12)
    .max(220)
    .describe("What concretely changes for them, in one or two sentences."),
  direction: z
    .enum(["gains", "loses", "mixed", "unclear"])
    .describe(
      "Whether this group gains or loses money, access, discretion, protection, or obligations. Use 'mixed' when both happen and 'unclear' when the text does not settle it — never guess to balance the list.",
    ),
});
export type BriefAffected = z.infer<typeof BriefAffectedSchema>;

/** A term the reader would otherwise have to look up. */
export const BriefTermSchema = z.object({
  term: z.string().trim().min(2).max(60),
  plain: z
    .string()
    .trim()
    .min(15)
    .max(220)
    .describe("A one-sentence definition in everyday words."),
});
export type BriefTerm = z.infer<typeof BriefTermSchema>;

/** An optional prose section for readers who want the long version. */
export const BriefSectionSchema = z.object({
  heading: z.string().trim().min(3).max(60),
  body: z
    .string()
    .trim()
    .min(120)
    .max(2200)
    .describe(
      "Markdown prose. Short paragraphs, no headings — the heading is the field above.",
    ),
});
export type BriefSection = z.infer<typeof BriefSectionSchema>;

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
    .min(24)
    .max(200)
    .describe(
      "One sentence naming the most consequential concrete change. Lead with what the measure does, not what it is called or hopes to achieve. Attribute goals ('aims to', 'supporters say') rather than asserting them.",
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
        .max(220)
        .describe("One open question, stated plainly."),
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
  sections: z
    .array(BriefSectionSchema)
    .max(3)
    .describe(
      "Optional long-form sections for readers who want depth, e.g. how it works, background, implementation questions.",
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

/** A stored brief: model output plus pipeline-owned provenance. */
export const BillBriefRecordSchema = BillBriefSchema.extend({
  version: z.literal(BILL_BRIEF_VERSION),
  legalStatus: BriefLegalStatusSchema,
  /** Count of quotes that matched the source text verbatim, after verification. */
  verifiedQuotes: z.number().int().min(0),
  generatedAt: z.string(),
  modelVersion: z.string(),
});
export type BillBriefRecord = z.infer<typeof BillBriefRecordSchema>;

/**
 * Whether a stored brief is still renderable. Used to decide if a cached row
 * can be reused or has to be regenerated, mirroring `isUsableDualLens`.
 */
export function isUsableBillBrief(value: unknown): boolean {
  return BillBriefRecordSchema.safeParse(value).success;
}
