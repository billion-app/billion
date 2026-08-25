import { createHash } from "node:crypto";
import { generateText } from "ai";
import { z } from "zod";

import { trackLLMUsage } from "../costs.js";
import { getTextLlm } from "./provider.js";

export const CONTENT_IMAGE_STYLE_VERSION = "illustrated-fantasy-v2";

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

const WRITTEN_MATERIAL =
  /\b(?:banner|caption|document|headline|label|letter|logo|numeral|poster|reading|screen|sign|text|title|watermark|word|written)\b/i;

export function contentVisualPlanningPrompt(
  source: ContentVisualSource,
): string {
  return `Plan one memorable editorial illustration for this civic story.

TITLE
${source.title}

SUMMARY
${source.description || "No summary is available."}

Translate the policy into a scene, not a poster. Name at least three concrete, recognizable objects or activities that come directly from this story. Keep those literal details prominent. Abstract policy may add a playful surreal metaphor, symbolic scale, or an uncanny juxtaposition, but fantasy must support the topic rather than replace it.

Do not fall back to generic fantasy scenery such as crystal caverns, foggy labyrinths, glowing portals, or vague beams of light unless the story is literally about those things. A viewer who has not read the title should still be able to identify the real-world subject from the objects and actions in the illustration.

Write only what an illustrator should draw. Never repeat or paraphrase the title as display copy. Do not include documents, screens, signs, captions, labels, letters, numerals, logos, flags, watermarks, or any other readable material. Avoid podiums, handshakes, conference rooms, and generic people smiling at the camera.`;
}

export function renderContentImagePrompt(plan: ContentVisualPlan): string {
  const scene = plan.scene
    .replace(/["'“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!scene) throw new Error("Content image visual plan has no scene");
  if (WRITTEN_MATERIAL.test(scene)) {
    throw new Error("Content image visual plan includes written material");
  }

  return `NO WORDS OR TYPOGRAPHY ANYWHERE IN THE IMAGE. Full-bleed imaginative editorial illustration with the playful, information-dense, slightly surreal character of early generative artwork. Scene: ${scene}. Build one coherent composition with a strong focal point and several story-specific details across foreground, subject, and background. Use bold color, expressive characters, visual metaphor, symbolic scale, witty or uncanny juxtapositions, cinematic light, and tactile painterly texture. Make it visually rich and immediately connected to the civic issue, never corporate stock photography or a magazine cover. Avoid storefronts, billboards, banners, paperwork, books, screens, and every other surface that would normally carry writing. Architecture and objects must be blank and unmarked. Every part of the frame must be pictorial. No letters, words, numerals, captions, signs, labels, documents, screens, logos, borders, UI, or watermark.`;
}

export function versionContentImageHash(contentHash: string): string {
  return createHash("md5")
    .update(`${CONTENT_IMAGE_STYLE_VERSION}:${contentHash}`)
    .digest("hex");
}

export async function planContentVisual(
  source: ContentVisualSource,
): Promise<ContentVisualPlan> {
  const { text, usage } = await generateText({
    model: getTextLlm(),
    prompt: `${contentVisualPlanningPrompt(source)}\n\nReturn ONLY the scene description. No JSON, heading, quotation marks, or explanation.`,
  });
  trackLLMUsage(usage.inputTokens, usage.outputTokens);
  return ContentVisualPlanSchema.parse({ scene: text.trim() });
}
