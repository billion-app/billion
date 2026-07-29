/**
 * Artwork for a single change in a bill brief's "What would change" list.
 *
 * Two decisions live here, in this order:
 *
 *   1. *Should* this change have a picture at all? Most legislative changes are
 *      procedural — a reporting deadline, a definition, a delegation of
 *      rulemaking — and photographing them produces the stock-image problem the
 *      bundled demo art had: a picture that looks informative while describing
 *      something the card does not say. The planner is expected to decline, and
 *      declining is recorded so the question is not re-asked every run.
 *   2. If so, of *what*? The prompt must describe a concrete, literal scene
 *      drawn from the change itself, not a metaphor for policy.
 *
 * Deliberately separate from `generateImage()`, which wraps every prompt in an
 * "imaginative, slightly surreal, avoid corporate stock photography"
 * instruction. Header art is illustrated; change cards are photographic. Those
 * are different jobs and must not share a prompt.
 *
 * Generation is local-FLUX-only, never BFL: this runs across the whole archive
 * and must not spend money per image.
 */
import { generateText, Output } from "ai";
import { z } from "zod";

import type { BillBrief } from "@acme/validators";

import type { GeneratedImage } from "./image-generation.js";
import { createLogger } from "../log.js";
import { convertToJpeg, generateLocalPhoto } from "./image-generation.js";
import { getStructuredLlm } from "./provider.js";

const logger = createLogger("change-visual");

/**
 * 16:9 to match the card, which renders at height 142 with `contentFit: cover`.
 * 576px covers a 3x screen with room to spare; 1280x720 measured ~50s per image
 * against ~35s here, which across the archive is hours, not minutes.
 */
export const CHANGE_IMAGE_WIDTH = 1024;
export const CHANGE_IMAGE_HEIGHT = 576;

const VisualPlanSchema = z.object({
  helpful: z
    .boolean()
    .describe(
      "True only if a literal photograph would show the reader something the text cannot. False for procedural, definitional, financial or administrative changes.",
    ),
  subject: z
    .string()
    .nullish()
    .describe(
      "When helpful: the concrete physical scene to photograph, in plain words. Null when not helpful.",
    ),
});

/**
 * Ask whether a photograph helps, and if so what it should show.
 *
 * The bar is deliberately high. A change earns a picture when it acts on
 * something with a physical existence a reader could recognise — a clinic, a
 * runway, a classroom, a rail crossing. It does not earn one for a change to
 * how a number is calculated, who must file a report, or what a term means,
 * however important that change is.
 */
export async function planChangeVisual(
  change: BillBrief["changes"][number],
): Promise<string | null> {
  const { output } = await generateText({
    model: getStructuredLlm(),
    output: Output.object({ schema: VisualPlanSchema }),
    prompt: `A news app shows this legislative change on a card. Decide whether a photograph belongs on that card.

CHANGE
kind: ${change.kind}
title: ${change.title}
now: ${change.before}
under this bill: ${change.after}

Say helpful=true ONLY if there is a concrete physical place, object, activity or setting at the centre of this change that a photograph could actually show, and seeing it would tell the reader something the words do not.

Say helpful=false — the common case — when the change is procedural, definitional, financial, jurisdictional or administrative. Reporting requirements, deadlines, funding authorisations, eligibility formulas, agency reorganisations, studies and definitions all get helpful=false. A photograph of an office, a meeting, a flag, a courthouse, paperwork, a handshake or a generic "government" scene is never informative; if that is the best available image, the answer is false.

When helpful=true, write "subject" as a literal description of the scene: the place and what is happening in it. Describe what a camera would see. Do not describe the policy, do not use metaphor, and do not include text, charts, logos or captions.`,
  });

  if (!output.helpful || !output.subject?.trim()) return null;
  return output.subject.trim();
}

/**
 * Render a planned subject as an editorial stock photograph.
 *
 * The wrapper asks for the register the removed demo art had — real, sober,
 * professionally lit documentary photography — while forbidding the stock-photo
 * failure modes that make an image feel fake.
 */
export async function generateChangeImage(
  subject: string,
): Promise<GeneratedImage | null> {
  const prompt = `Professional editorial stock photograph. ${subject}. Shot on a full-frame camera with natural light, realistic depth of field, documentary framing, muted natural colour, candid and unposed. It should look like a photograph accompanying a serious news article. No text, captions, labels, logos, watermarks, charts, diagrams or user interfaces. Not an illustration, not a rendering, not a collage. Avoid staged handshakes, people pointing at screens, actors smiling at the camera, and empty conference rooms.`;

  const image = await generateLocalPhoto(
    prompt,
    CHANGE_IMAGE_WIDTH,
    CHANGE_IMAGE_HEIGHT,
  );
  if (!image) return null;

  // FLUX returns PNG; the card only ever needs a photograph, and JPEG is ~5x
  // smaller for the same visible quality at this size.
  const jpeg = await convertToJpeg(image.data, 82);
  logger.success(
    `Change image: ${image.width}x${image.height}, ${Math.round(jpeg.length / 1024)}KB`,
  );
  return { ...image, data: jpeg, mimeType: "image/jpeg" };
}
