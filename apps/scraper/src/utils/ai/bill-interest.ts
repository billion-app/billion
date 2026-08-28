import { generateText, Output } from "ai";
import { z } from "zod";

import { trackLLMUsage } from "../costs.js";
import { getStructuredLlm, getTextModelVersion } from "./provider.js";

export const BillInterestAssessmentSchema = z.object({
  interestScore: z.number().int().min(0).max(100),
  controversyScore: z.number().int().min(0).max(100),
  attentionScore: z.number().int().min(0).max(100),
  reason: z.string().trim().min(20),
});

export type BillInterestAssessment = z.infer<
  typeof BillInterestAssessmentSchema
>;

export interface BillInterestInput {
  billNumber: string;
  title: string;
  description?: string | null;
  summary?: string | null;
  status?: string | null;
  brief?: unknown;
  lens?: unknown;
}

function compactJson(value: unknown, limit: number): string {
  if (value === null || value === undefined) return "(none)";
  return JSON.stringify(value).slice(0, limit);
}

export function buildBillInterestPrompt(input: BillInterestInput): string {
  return `You are ranking legislation for a general-interest civic news feed.

Score this bill from 0 to 100 on three separate measures:

1. interestScore: How likely the bill is to matter to or surprise a broad public audience. Reward concrete effects, scale, novelty, understandable stakes, and realistic chances of changing policy. Do not reward sensational wording.
2. controversyScore: How much documented, substantive disagreement surrounds the bill. Reward close or party-split votes, organized opposition, conflicting rights or costs, and credible arguments on both sides. A politically charged subject is not enough by itself.
3. attentionScore: How much outside discussion the supplied research actually demonstrates. Reward several independent, relevant sources discussing this bill or its specific proposal. Do not infer press or public attention merely because the subject seems newsworthy. If the supplied material contains no outside coverage, keep this score at 20 or below.

Use only the supplied material. The popularity leaderboard uses real product saves elsewhere, so do not treat popularity as one of these scores. Give one plain-language reason under 240 characters naming the strongest evidence behind the scores.

Bill: ${input.billNumber}
Title: ${input.title}
Status: ${input.status ?? "unknown"}
Card description: ${input.description ?? "(none)"}
Official summary: ${(input.summary ?? "(none)").slice(0, 4_000)}
Structured brief and reading list: ${compactJson(input.brief, 12_000)}
Researched arguments and sources: ${compactJson(input.lens, 12_000)}`;
}

export async function generateBillInterest(
  input: BillInterestInput,
): Promise<BillInterestAssessment & { modelVersion: string }> {
  const result = await generateText({
    model: getStructuredLlm(),
    output: Output.object({ schema: BillInterestAssessmentSchema }),
    prompt: buildBillInterestPrompt(input),
  });
  trackLLMUsage(result.usage.inputTokens, result.usage.outputTokens);

  return {
    ...result.output,
    reason: result.output.reason.slice(0, 240),
    modelVersion: getTextModelVersion(),
  };
}
