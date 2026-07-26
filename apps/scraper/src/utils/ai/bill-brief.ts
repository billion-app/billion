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
import { APICallError, generateText, Output, RetryError } from "ai";

import type {
  BillBrief,
  BillBriefRecord,
  BriefLegalStatus,
} from "@acme/validators";
import { BILL_BRIEF_VERSION, BillBriefSchema } from "@acme/validators";

import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { getTextLlm } from "./provider.js";
import { AIRateLimitError, rateLimitHit, setRateLimitHit } from "./text-generation.js";

const logger = createLogger("ai-brief");

/**
 * How much of the bill the model reads. Bills routinely run past a provider's
 * context window; verification still runs against the *whole* text, so a quote
 * pulled from anywhere in the document validates even though the model only
 * saw the opening. Larger than the 3–4k windows used elsewhere because a brief
 * has to find concrete provisions, not just a gist.
 */
const SOURCE_WINDOW = 24_000;

/** Attempts at structuring before giving up (each is one LLM call). */
const MAX_ATTEMPTS = 2;

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
  // Very short fragments match by accident; the schema floor is 20 chars, but
  // normalization can shrink a quote further.
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
      changes: brief.changes.map(check),
    },
    verified,
    dropped,
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
    brief.hook,
    ...brief.facts.flatMap((f) => [f.label, f.value, f.note ?? ""]),
    ...brief.changes.flatMap((c) => [c.title, c.before, c.after]),
    ...brief.affected.flatMap((a) => [a.group, a.effect]),
    ...brief.unknowns,
    ...brief.terms.flatMap((t) => [t.term, t.plain]),
    ...brief.sections.flatMap((s) => [s.heading, s.body]),
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
): BriefLegalStatus {
  const s = (status ?? "").toLowerCase();
  return /became law|public law|signed by president|enacted|became public law/.test(
    s,
  )
    ? "enacted"
    : "proposed";
}

function buildBriefPrompt(args: {
  title: string;
  billNumber: string;
  url: string;
  legalStatus: BriefLegalStatus;
  sourceText: string;
  priorArticle?: string | null;
  loadedPhrases?: string[];
}): string {
  const {
    title,
    billNumber,
    url,
    legalStatus,
    sourceText,
    priorArticle,
    loadedPhrases,
  } = args;

  const tense =
    legalStatus === "enacted"
      ? `This bill is already law. Describe its provisions in the present tense ("requires", "authorizes").`
      : `This bill is a proposal that has NOT become law. Every effect must be conditional ("would require", "would authorize"). Never write that it "will" do something.`;

  const retryNote = loadedPhrases?.length
    ? `\n\nYour previous attempt used loaded political phrasing in your own voice: ${loadedPhrases
        .map((p) => `"${p}"`)
        .join(", ")}. Replace each with the underlying mechanism. Describe what the text does; let the reader judge it.\n`
    : "";

  return `You are a nonpartisan civic analyst writing a structured brief on a U.S. bill for a general audience. Your reader is a busy adult, not a policy professional. They will scan before they read, so every field must stand alone.

${tense}

Your job is to explain the policy, not to promote or attack it. Treat the title, acronym, findings, purpose clauses, and sponsor statements as claims about intent — not proof of results. Base every factual statement on the supplied source text.

Before filling in the fields, silently identify:
1. The concrete mechanisms: what authority, rule, funding, eligibility, deadline, review, oversight, enforcement, or safeguard is added, removed, weakened, expanded, or transferred.
2. Who gains discretion, money, rights, access, or speed.
3. Who could lose protection, oversight, recourse, funding, or control.
4. What the text does not establish.

Rules that decide whether this brief ships:

- **Mechanism over marketing.** Removing or waiving rules, reviews, reporting, or oversight is deregulation or reduced oversight. Say that. Do not hide it behind "cuts red tape", "modernizes", "streamlines", or "speeds up". Equally, do not attach a hostile label the text does not support.
- **Quotes are verbatim.** Every "quote" field must be an exact, unedited span copied character-for-character from the source text below. Do not paraphrase, splice, trim mid-word, or fix grammar. Quotes that do not appear in the source are removed automatically, so a paraphrase in quotation marks just loses you a citation.
- **No invented figures.** A number, date, or dollar amount goes in "facts" only if the source states it. Fewer facts is correct; a plausible-looking invented figure is not.
- **No manufactured symmetry.** If the text supports one consequence more strongly than another, say so. Use "mixed" or "unclear" for an affected group rather than balancing the list for its own sake.
- **Neutral vocabulary.** In your own voice, avoid words that carry a verdict — "common sense", "radical", "landmark", "reckless", "burdensome", "handout", "much-needed". Attribute goals with "aims to" or "supporters say" rather than asserting them.
- **Plain language.** Aim for an 8th-grade reading level in "hook", "changes", and "affected". Anything a general reader would have to look up belongs in "terms".

Field notes:
- "hook" is the single sentence a reader sees first. Lead with the most consequential concrete change, not the bill's name or stated goal.
- "changes" must contrast current law ("before") with the proposal ("after"). If the source does not establish current law, say that in "before" instead of guessing.
- "unknowns" is required. Name what the text leaves open — undefined terms, delegated decisions, unfunded pieces, effects the source does not establish.
- "sections" is for readers who want the long version: 1–3 sections of markdown prose, short paragraphs, no headings inside the body.${retryNote}

---
Bill: ${billNumber} — ${title}
Status: ${legalStatus === "enacted" ? "enacted" : "proposed, not yet law"}
Source URL: ${url}
${
  priorArticle
    ? `\nPrior nonpartisan analysis of this bill (already vetted for framing — reuse its judgments, but pull all quotes from the official text below):\n${priorArticle.slice(0, 6000)}\n`
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
  status?: string | null;
  priorArticle?: string | null;
}): Promise<Omit<BillBriefRecord, "generatedAt" | "modelVersion"> | null> {
  if (rateLimitHit) throw new AIRateLimitError();

  const legalStatus = deriveLegalStatus(args.status);
  let loadedPhrases: string[] | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { output, usage } = await generateText({
        model: getTextLlm(),
        output: Output.object({ schema: BillBriefSchema }),
        prompt: buildBriefPrompt({
          title: args.title,
          billNumber: args.billNumber,
          url: args.url,
          legalStatus,
          sourceText: args.fullText,
          priorArticle: args.priorArticle,
          loadedPhrases,
        }),
      });
      trackLLMUsage(usage.inputTokens, usage.outputTokens);

      const { brief, verified, dropped } = verifyBriefQuotes(
        output,
        args.fullText,
      );
      if (dropped > 0) {
        logger.warn(
          `Brief for ${args.billNumber}: dropped ${dropped} unverified quote(s), kept ${verified}`,
        );
      }

      const loaded = findLoadedLanguage(brief);
      // Retry once with the offending phrases named; on the final attempt keep
      // the brief anyway — a slightly colored word is a smaller failure than
      // shipping no brief at all, and the warning surfaces it in the logs.
      if (loaded.length > 0 && attempt < MAX_ATTEMPTS) {
        logger.warn(
          `Brief for ${args.billNumber}: loaded language ${loaded.join(", ")} — regenerating`,
        );
        loadedPhrases = loaded;
        continue;
      }
      if (loaded.length > 0) {
        logger.warn(
          `Brief for ${args.billNumber}: keeping brief with loaded language ${loaded.join(", ")}`,
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
      };
    } catch (error) {
      if (isRateLimitError(error)) {
        setRateLimitHit(true);
        throw new AIRateLimitError();
      }
      logger.warn(
        `Brief structuring failed on attempt ${attempt} for ${args.billNumber}`,
        error,
      );
      if (attempt === MAX_ATTEMPTS) return null;
    }
  }
  return null;
}
