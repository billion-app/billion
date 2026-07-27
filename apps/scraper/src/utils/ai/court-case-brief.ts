import { APICallError, generateText, Output, RetryError } from "ai";

import type {
  CourtCaseBrief,
  CourtCaseBriefRecord,
  NarrativeBriefItem,
} from "@acme/validators";
import {
  COURT_CASE_BRIEF_VERSION,
  CourtCaseBriefSchema,
} from "@acme/validators";

import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { normalizeForQuoteMatch } from "./bill-brief.js";
import { getTextLlm } from "./provider.js";
import {
  AIRateLimitError,
  rateLimitHit,
  setRateLimitHit,
} from "./text-generation.js";

const logger = createLogger("court-case-brief");
const SOURCE_WINDOW = 24_000;

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);
  return (
    error instanceof Error &&
    /429|rate limit|resource_exhausted|quota/i.test(error.message)
  );
}

export function verifyCourtCaseBriefQuotes(
  brief: CourtCaseBrief,
  sourceText: string,
): { brief: CourtCaseBrief; verified: number; dropped: number } {
  const source = normalizeForQuoteMatch(sourceText);
  let verified = 0;
  let dropped = 0;

  const verifyItem = (item: NarrativeBriefItem): NarrativeBriefItem => {
    if (!item.quote) return item;
    const quote = normalizeForQuoteMatch(item.quote.text);
    if (quote.length >= 20 && source.includes(quote)) {
      verified++;
      return item;
    }
    dropped++;
    const { quote: _quote, ...rest } = item;
    return rest;
  };

  return {
    brief: {
      ...brief,
      sections: brief.sections.map((section) => ({
        ...section,
        items: section.items.map(verifyItem),
      })),
    },
    verified,
    dropped,
  };
}

function buildPrompt(args: {
  title: string;
  court: string;
  caseNumber: string;
  status?: string | null;
  fullText: string;
  priorArticle?: string | null;
}): string {
  return `You are a nonpartisan legal explainer writing a structured court-case
brief for an average citizen. Use short, coherent sentences and familiar words.
Define unavoidable legal terms. Mark two or three short phrases in the hook,
and one important phrase in every other prose item, with **double asterisks**.
Never bold a whole sentence.

Preserve the case's posture. If it is pending, describe possible outcomes with
"could" and do not claim the court has decided. If it is decided, distinguish
the holding from arguments made by either side.

Use sections suited to this particular record, normally:
- "The question before the court"
- "How the case got here" or "What earlier law says"
- "What each outcome would change" for a pending case, or "What the court decided"
- "Who the decision reaches"

Explain the causal link in every example. Do not merely name an existing law or
precedent; state exactly how the ruling could preserve, expand, narrow, or
replace it. Do not manufacture a controversy, motive, fact, or likely outcome.

Every quote must be an exact unedited span from the official source below.
Include fewer facts or quotes rather than inventing them. Put only genuinely
unresolved questions in "unknowns".

Case: ${args.caseNumber} — ${args.title}
Court: ${args.court}
Status: ${args.status ?? "not provided"}
${
  args.priorArticle
    ? `Existing analysis (use for context, but quote only the official source):\n${args.priorArticle.slice(0, 6000)}\n`
    : ""
}
Official source:
${args.fullText.slice(0, SOURCE_WINDOW)}`;
}

export async function generateCourtCaseBrief(args: {
  title: string;
  court: string;
  caseNumber: string;
  status?: string | null;
  fullText: string;
  priorArticle?: string | null;
}): Promise<Omit<CourtCaseBriefRecord, "generatedAt" | "modelVersion"> | null> {
  if (rateLimitHit) throw new AIRateLimitError();

  try {
    const { output, usage } = await generateText({
      model: getTextLlm(),
      output: Output.object({ schema: CourtCaseBriefSchema }),
      prompt: buildPrompt(args),
    });
    trackLLMUsage(usage.inputTokens, usage.outputTokens);

    const verified = verifyCourtCaseBriefQuotes(output, args.fullText);
    if (verified.dropped > 0) {
      logger.warn(
        `Court brief for ${args.caseNumber}: dropped ${verified.dropped} unverified quote(s)`,
      );
    }
    return {
      ...verified.brief,
      kind: "court_case",
      presentation: "court_case",
      version: COURT_CASE_BRIEF_VERSION,
      verifiedQuotes: verified.verified,
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      setRateLimitHit(true);
      throw new AIRateLimitError();
    }
    logger.warn(`Court brief generation failed for ${args.caseNumber}`, error);
    return null;
  }
}
