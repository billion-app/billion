import { readFile } from "node:fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";

import type { CaptionCue } from "./captions";

interface TranscriptPayload {
  segments?: Array<{ start?: number; end?: number; text?: string }>;
}

export async function transcribeAudioWithGemini(options: {
  audioPath: string;
  apiKey: string;
  duration: number;
  script?: string;
}): Promise<CaptionCue[]> {
  const audio = await readFile(options.audioPath);
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const scriptContext = options.script
    ? `The presenter intended to follow this script. Use it to correct names and wording, but transcribe what was actually spoken:\n${options.script}`
    : "No reference script is available.";
  const prompt = `
Transcribe this short presenter recording for burned-in social video captions.
Return strict JSON only in this shape:
{"segments":[{"start":0.0,"end":1.8,"text":"Spoken words"}]}

Requirements:
- start and end are seconds from the beginning of the audio.
- Keep segments chronological and non-overlapping.
- Each segment should contain one natural phrase, normally 3-8 words.
- Preserve proper nouns, bill numbers, dates, and dollar amounts accurately.
- Do not add words that were not spoken.
- The recording duration is ${options.duration.toFixed(2)} seconds.

${scriptContext}
  `.trim();

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: "audio/mpeg",
        data: audio.toString("base64"),
      },
    },
  ]);
  const payload = JSON.parse(result.response.text()) as TranscriptPayload;

  if (!Array.isArray(payload.segments) || payload.segments.length === 0) {
    throw new Error("Gemini returned no timed transcript segments.");
  }

  const cues = payload.segments.map((segment, index) => {
    const start = Number(segment.start);
    const end = Math.min(Number(segment.end), options.duration);
    const text = segment.text?.replace(/\s+/g, " ").trim();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start ||
      !text
    ) {
      throw new Error(
        `Gemini returned an invalid transcript segment at ${index}.`,
      );
    }
    return { start, end, text };
  });

  return cues.sort((a, b) => a.start - b.start);
}
