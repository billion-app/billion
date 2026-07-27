import { APICallError, generateText, Output, RetryError } from "ai";

import type {
  GovernmentActionBrief,
  GovernmentActionBriefRecord,
} from "@acme/validators";
import {
  GOVERNMENT_ACTION_BRIEF_VERSION,
  GovernmentActionBriefSchema,
} from "@acme/validators";

import { trackLLMUsage } from "../costs.js";
import { createLogger } from "../log.js";
import { verifyCourtCaseBriefQuotes } from "./court-case-brief.js";
import { getTextLlm } from "./provider.js";
import {
  AIRateLimitError,
  rateLimitHit,
  setRateLimitHit,
} from "./text-generation.js";

const logger = createLogger("government-action-brief");
const SOURCE_WINDOW = 24_000;

function isRateLimitError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 429;
  if (error instanceof RetryError) return isRateLimitError(error.lastError);
  return (
    error instanceof Error &&
    /429|rate limit|resource_exhausted|quota/i.test(error.message)
  );
}

export function isCeremonialGovernmentContent(
  title: string,
  documentType: string,
): boolean {
  return (
    /proclamation/i.test(documentType) &&
    /\b(?:day|week|month|anniversary|commemor\w*|honor\w*|recogniz\w*|celebrat\w*)\b/i.test(
      title,
    )
  );
}

export function isGovernmentActionDocumentType(documentType: string): boolean {
  return /^(?:executive order|memorandum|(?:presidential )?proclamation)$/i.test(
    documentType.trim(),
  );
}

function buildCeremonialBrief(args: {
  title: string;
  documentType: string;
  description?: string | null;
}): GovernmentActionBrief {
  const subject = args.description?.trim() || args.title;
  return {
    badge: "PROCLAMATION",
    hook: `${subject} This is **a ceremonial recognition and public call to awareness**; it does not by itself create a new law, spending program, or requirement for the public.`,
    facts: [
      { label: "Document", value: args.documentType },
      { label: "Legal effect", value: "No new mandate" },
    ],
    terms: [],
    sections: [
      {
        title: "What it recognizes",
        items: [
          {
            text: `The proclamation uses the presidency's public platform to **recognize ${args.title.replace(/^Proclamation (?:on|for) /i, "")}** and encourage awareness or voluntary action.`,
          },
        ],
      },
      {
        title: "What it does not do",
        items: [
          {
            text: "The designation does **not appropriate money, rewrite regulations, or require anyone to participate** unless the official text separately orders a concrete action.",
          },
        ],
      },
    ],
    unknowns: [],
  };
}

function buildPrompt(args: {
  title: string;
  documentType: string;
  description?: string | null;
  fullText: string;
  priorArticle?: string | null;
}): string {
  return `You are a nonpartisan civic analyst writing a structured brief about a
presidential ${args.documentType}. Write for an average citizen using short,
coherent sentences and familiar words. Define unavoidable government terms.
Mark two or three short key phrases in the hook and one important phrase in
every other prose item with **double asterisks**. Never bold a whole sentence.

Distinguish an instruction to federal agencies from a law passed by Congress.
Do not say the document directly requires companies, states, or members of the
public to act unless its legal mechanism actually does so. Separate goals from
binding directions, and separate an announced spending priority from money
Congress has approved.

Use sections appropriate to this document, normally:
- "What the President directed"
- "How it takes effect"
- "Who it reaches"
- "What it does not do" when readers could confuse it with legislation

Every example must explain the causal link: name the concrete directive, who
must carry it out, and what a person or organization would experience. Do not
manufacture an effect, controversy, motive, or funding source.

Every quote must be an exact unedited span from the official source below.
Include fewer facts or quotes rather than inventing them. Put only genuinely
unresolved implementation details in "unknowns".

Document: ${args.documentType} — ${args.title}
Description: ${args.description ?? "not provided"}
${
  args.priorArticle
    ? `Existing analysis (use for context, but quote only the official source):\n${args.priorArticle.slice(0, 6000)}\n`
    : ""
}
Official source:
${args.fullText.slice(0, SOURCE_WINDOW)}`;
}

export async function generateGovernmentActionBrief(args: {
  title: string;
  documentType: string;
  description?: string | null;
  fullText: string;
  priorArticle?: string | null;
}): Promise<Omit<
  GovernmentActionBriefRecord,
  "generatedAt" | "modelVersion"
> | null> {
  const ceremonial = isCeremonialGovernmentContent(
    args.title,
    args.documentType,
  );
  if (ceremonial) {
    return {
      ...buildCeremonialBrief(args),
      kind: "government_action",
      presentation: "ceremonial",
      version: GOVERNMENT_ACTION_BRIEF_VERSION,
      verifiedQuotes: 0,
    };
  }
  if (rateLimitHit) throw new AIRateLimitError();

  try {
    const { output, usage } = await generateText({
      model: getTextLlm(),
      output: Output.object({ schema: GovernmentActionBriefSchema }),
      prompt: buildPrompt(args),
    });
    trackLLMUsage(usage.inputTokens, usage.outputTokens);
    const verified = verifyCourtCaseBriefQuotes(output, args.fullText);
    if (verified.dropped > 0) {
      logger.warn(
        `Government brief for "${args.title}": dropped ${verified.dropped} unverified quote(s)`,
      );
    }
    return {
      ...verified.brief,
      kind: "government_action",
      presentation: "executive_action",
      version: GOVERNMENT_ACTION_BRIEF_VERSION,
      verifiedQuotes: verified.verified,
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      setRateLimitHit(true);
      throw new AIRateLimitError();
    }
    logger.warn(
      `Government brief generation failed for "${args.title}"`,
      error,
    );
    return null;
  }
}
