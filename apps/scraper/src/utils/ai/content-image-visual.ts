import { createHash } from "node:crypto";
import { generateText } from "ai";
import { z } from "zod";

import { trackLLMUsage } from "../costs.js";
import { getTextLlm } from "./provider.js";

export const CONTENT_IMAGE_STYLE_VERSION = "illustrated-fantasy-v2";

/** Retry old rejections after a provider change without invalidating accepted art. */
export function contentImageReviewStyleVersion(): string {
  return process.env.SCRAPER_IMAGE_PROVIDER === "codex"
    ? `${CONTENT_IMAGE_STYLE_VERSION}:codex:${process.env.SCRAPER_IMAGE_MODEL?.trim() || "gpt-image-2"}`
    : CONTENT_IMAGE_STYLE_VERSION;
}

export interface ContentVisualSource {
  title: string;
  description: string;
}

const ContentVisualPlanSchema = z.object({
  scene: z
    .string()
    .min(20)
    .max(700)
    .describe(
      "A purely visual scene description. It must not contain a title, caption, quotation, written sign, document text, UI, or instructions to render words.",
    ),
});

export type ContentVisualPlan = z.infer<typeof ContentVisualPlanSchema>;

type VisualPlanner = (
  source: ContentVisualSource,
  revisionFeedback?: string,
) => Promise<ContentVisualPlan>;

const WRITTEN_OBJECTS =
  "(?:banners?|captions?|documents?|headlines?|labels?|letters?|logos?|numerals?|posters?|reading|screens?|signs?|text|titles?|watermarks?|words?|written)";
const WRITTEN_MATERIAL = new RegExp(`\\b${WRITTEN_OBJECTS}\\b`, "i");
// Exclusions are safety instructions, not requests to draw the excluded objects.
const EXCLUDED_WRITING = new RegExp(
  `\\b(?:no|without)\\s+(?:(?:any|readable|written|visible)\\s+)*${WRITTEN_OBJECTS}\\b(?:\\s*(?:,|and|or)\\s*(?:(?:any|readable|written|visible)\\s+)*${WRITTEN_OBJECTS}\\b)*`,
  "gi",
);

/** Add policy specifics without copying source-page navigation into the prompt. */
export function governmentImageDescription(
  description: string,
  fullText: string | null,
): string {
  const summary = description.trim();
  if (!summary || !fullText) return summary;
  const policyStart = fullText.search(/\bSection\s+1\b/i);
  if (policyStart < 0) return summary;
  return `${summary.slice(0, 250)}\nOfficial source excerpt:\n${fullText.slice(policyStart, policyStart + 900)}`;
}

export function contentVisualPlanningPrompt(
  source: ContentVisualSource,
  revisionFeedback?: string,
): string {
  const feedback = revisionFeedback?.trim()
    ? `\n\nREVISION GUIDANCE\nThe previous generated image was rejected for this specific issue: ${revisionFeedback.trim().slice(0, 600)}. Correct that issue in the new scene while keeping the source summary as the factual boundary.`
    : "";
  return `Plan one restrained editorial illustration for this civic story.

TITLE
${source.title}

SUMMARY
${source.description || "No summary is available."}

Translate the policy into one literal, documentary-like scene, not a poster. Name at least three concrete, recognizable objects or activities that come directly from this story. Keep those details prominent and easy to identify. Make the thing the policy regulates, funds, or protects the main subject; do not make an incidental activity from the background or rationale the focal point. Use a clear, professional composition with restrained visual metaphor only when it clarifies the real subject.

Do not invent policy consequences, dramatic conflict, villains, victims, or generic fantasy scenery. A viewer who has not read the title should still be able to identify the real-world subject from the objects and actions in the illustration.

Write only what an illustrator should draw. Never repeat or paraphrase the title as display copy. Do not include documents, screens, signs, captions, labels, letters, numerals, logos, flags, watermarks, or any other readable material. Avoid podiums, handshakes, conference rooms, and generic people smiling at the camera.${feedback}`;
}

export function renderContentImagePrompt(plan: ContentVisualPlan): string {
  const scene = plan.scene
    .replace(/["'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!scene) throw new Error("Content image visual plan has no scene");
  if (WRITTEN_MATERIAL.test(scene.replace(EXCLUDED_WRITING, ""))) {
    throw new Error("Content image visual plan includes written material");
  }

  return `NO WORDS OR TYPOGRAPHY ANYWHERE IN THE IMAGE. Full-bleed professional editorial illustration for a serious news article. Scene: ${scene}. Use a restrained, literal composition with one clear subject, accurate real-world objects, natural proportions, calm lighting, and muted but legible color. Keep each whole key subject and story-specific detail within the central 40 percent of the image width and central 70 percent of its height, with ample breathing room so the 2:1 article-header crop and square browse-card crop remain clear when the app uses centered cover crops. Avoid caricature, sensationalism, invented consequences, partisan symbols, generic corporate stock scenes, fantasy scenery, and magazine-cover styling. Avoid storefronts, billboards, banners, paperwork, books, screens, and every other surface that would normally carry writing. Architecture and objects must be blank and unmarked. No letters, words, numerals, captions, signs, labels, documents, screens, logos, borders, UI, or watermark.`;
}

/**
 * Planning is probabilistic: even a strongly worded prompt occasionally asks
 * FLUX to draw a sign, screen, or document. Retry the cheap text-planning step
 * instead of failing the expensive image job before FLUX is ever called.
 */
export async function planRenderedContentImagePrompt(
  source: ContentVisualSource,
  planner: VisualPlanner = planContentVisual,
  maxAttempts = 3,
  revisionFeedback?: string,
): Promise<string> {
  let lastError: unknown;
  let feedback = revisionFeedback;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return renderContentImagePrompt(await planner(source, feedback));
    } catch (error) {
      lastError = error;
      feedback = [
        revisionFeedback,
        error instanceof Error ? error.message : String(error),
        "Describe only drawable objects and activities. Keep the scene under 700 characters.",
      ]
        .filter(Boolean)
        .join(". ");
    }
  }
  throw lastError;
}

export function versionContentImageHash(contentHash: string): string {
  return createHash("md5")
    .update(`${CONTENT_IMAGE_STYLE_VERSION}:${contentHash}`)
    .digest("hex");
}

export async function planContentVisual(
  source: ContentVisualSource,
  revisionFeedback?: string,
): Promise<ContentVisualPlan> {
  const { text, usage } = await generateText({
    model: getTextLlm(),
    prompt: `${contentVisualPlanningPrompt(source, revisionFeedback)}\n\nReturn ONLY the scene description. No JSON, heading, quotation marks, or explanation.`,
  });
  trackLLMUsage(usage.inputTokens, usage.outputTokens);
  return ContentVisualPlanSchema.parse({ scene: text.trim() });
}
