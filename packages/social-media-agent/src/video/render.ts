import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { CaptionCue } from "./captions";
import { formatSrt, parseSrt, splitCaptionCues } from "./captions";
import {
  extractAudio,
  probeMedia,
  renderWithFfmpeg,
  requireMediaTools,
} from "./ffmpeg";
import { createGraphicOverlays } from "./graphics";
import {
  loadVideoProject,
  resolveCutaways,
  resolveProjectPath,
} from "./project";
import { transcribeAudioWithGemini } from "./transcribe";

export interface VideoRenderResult {
  output: string;
  captions: string;
  qa: string;
  duration: number;
  cutawayCount: number;
}

async function loadCaptions(options: {
  projectDirectory: string;
  captions?: string;
  presenter: string;
  script?: string;
  duration: number;
  workDirectory: string;
}): Promise<CaptionCue[]> {
  if (options.captions) {
    const path = resolveProjectPath(options.projectDirectory, options.captions);
    return parseSrt(await readFile(path, "utf8"));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No captions file was provided and GEMINI_API_KEY is not configured. Add an SRT file to project.json or configure Gemini for automatic transcription.",
    );
  }

  const audioPath = join(options.workDirectory, "presenter.mp3");
  await extractAudio(options.presenter, audioPath);
  const script = options.script
    ? await readFile(
        resolveProjectPath(options.projectDirectory, options.script),
        "utf8",
      )
    : undefined;

  return transcribeAudioWithGemini({
    audioPath,
    apiKey,
    duration: options.duration,
    script,
  });
}

export async function renderMarketingVideo(
  projectDirectoryInput: string,
): Promise<VideoRenderResult> {
  const projectDirectory = resolve(projectDirectoryInput);
  await requireMediaTools();
  const project = await loadVideoProject(projectDirectory);
  const presenter = resolveProjectPath(projectDirectory, project.presenter);
  const presenterInfo = await probeMedia(presenter);
  if (!presenterInfo.hasAudio) {
    throw new Error("The presenter video must contain the spoken audio track.");
  }

  const workDirectory = await mkdtemp(join(tmpdir(), "billion-video-"));
  try {
    const rawCues = await loadCaptions({
      projectDirectory,
      captions: project.captions,
      presenter,
      script: project.script,
      duration: presenterInfo.duration,
      workDirectory,
    });
    if (rawCues.length === 0) {
      throw new Error("The captions file contains no timed caption cues.");
    }
    const cues = splitCaptionCues(rawCues, 6).filter(
      (cue) => cue.start < presenterInfo.duration,
    );
    const cutaways = resolveCutaways(
      projectDirectory,
      project.cutaways ?? [],
      cues,
      presenterInfo.duration,
    );
    for (const cutaway of cutaways) await access(cutaway.source);

    const output = resolveProjectPath(
      projectDirectory,
      project.output ?? "output/final.mp4",
    );
    const outputDirectory = resolve(output, "..");
    await mkdir(outputDirectory, { recursive: true });
    const captionsPath = join(outputDirectory, "captions.srt");
    await writeFile(captionsPath, formatSrt(cues));

    const graphics = await createGraphicOverlays({
      directory: join(workDirectory, "graphics"),
      cues,
      hook: project.hook,
      cta: project.cta,
      ctaSubtext: project.ctaSubtext,
      duration: presenterInfo.duration,
    });

    await renderWithFfmpeg({
      presenter,
      cutaways,
      graphics,
      output,
      duration: presenterInfo.duration,
    });

    const rendered = await probeMedia(output);
    const passed =
      rendered.width === 1080 &&
      rendered.height === 1920 &&
      rendered.videoCodec === "h264" &&
      rendered.audioCodec === "aac" &&
      Math.abs((rendered.fps ?? 0) - 30) < 0.01 &&
      rendered.audioSampleRate === 48000 &&
      rendered.hasAudio;
    const qaPath = join(outputDirectory, "qa.json");
    await writeFile(
      qaPath,
      `${JSON.stringify(
        {
          passed,
          rendered,
          target: {
            width: 1080,
            height: 1920,
            videoCodec: "h264",
            audioCodec: "aac",
            fps: 30,
            audioLoudness: "-16 LUFS integrated, -1.5 dB true peak",
          },
          cutaways: cutaways.map((cutaway) => ({
            source: cutaway.source,
            rights: cutaway.rights,
            sourceUrl: cutaway.sourceUrl,
            start: cutaway.start,
            end: cutaway.end,
          })),
          warnings: [
            ...(rendered.duration > 45
              ? ["Video is longer than the campaign's 45-second default."]
              : []),
            ...(rendered.duration > 90
              ? ["Video is too long for the current boosted-Reel limit."]
              : []),
          ],
        },
        null,
        2,
      )}\n`,
    );

    if (!passed) {
      throw new Error(`Rendered video failed technical QA. See ${qaPath}`);
    }

    return {
      output,
      captions: captionsPath,
      qa: qaPath,
      duration: rendered.duration,
      cutawayCount: cutaways.length,
    };
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

export async function initializeVideoProject(
  projectDirectoryInput: string,
): Promise<string> {
  const projectDirectory = resolve(projectDirectoryInput);
  const manifestPath = join(projectDirectory, "project.json");
  await mkdir(join(projectDirectory, "input"), { recursive: true });
  await mkdir(join(projectDirectory, "assets"), { recursive: true });
  await mkdir(join(projectDirectory, "output"), { recursive: true });

  try {
    await access(manifestPath);
    throw new Error(`Refusing to overwrite existing ${manifestPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) {
      throw error;
    }
  }

  const manifest = {
    presenter: "input/presenter.mov",
    captions: "input/captions.srt",
    script: "script.md",
    output: "output/final.mp4",
    hook: "What this bill changes for you",
    cta: "Read the bill, sources, and both sides",
    ctaSubtext: "Open Billion",
    cutaways: [
      {
        source: "input/app-screen-recording.mov",
        rights: "owned",
        after: "here is what the bill does",
        duration: 4,
        sourceStart: 0,
      },
      {
        source: "assets/approved-visual.jpg",
        rights: "licensed",
        sourceUrl: "https://replace-with-the-license-or-source-url.example",
        after: "the biggest change",
        duration: 3,
      },
    ],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    join(projectDirectory, "script.md"),
    "# Script\n\nReplace this with the exact approved script before recording.\n",
  );
  return manifestPath;
}
