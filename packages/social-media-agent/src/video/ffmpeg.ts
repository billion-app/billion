import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

import type { GraphicOverlay } from "./graphics";
import type { ResolvedCutaway } from "./project";

const execFileAsync = promisify(execFile);

export interface MediaInfo {
  duration: number;
  hasAudio: boolean;
  width?: number;
  height?: number;
  fps?: number;
  audioSampleRate?: number;
  videoCodec?: string;
  audioCodec?: string;
}

export async function requireMediaTools(): Promise<void> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    await execFileAsync("ffprobe", ["-version"]);
  } catch {
    throw new Error(
      "FFmpeg and ffprobe are required. On macOS run: brew install ffmpeg",
    );
  }
}

export async function probeMedia(path: string): Promise<MediaInfo> {
  await access(path);
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate",
      "-of",
      "json",
      path,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const result = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      sample_rate?: string;
    }>;
  };
  const video = result.streams?.find((stream) => stream.codec_type === "video");
  const audio = result.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(result.format?.duration);
  const [fpsNumerator, fpsDenominator] = (video?.avg_frame_rate ?? "0/1")
    .split("/")
    .map(Number);

  if (!video || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`No usable video stream found in ${path}`);
  }

  return {
    duration,
    hasAudio: Boolean(audio),
    width: video.width,
    height: video.height,
    fps:
      fpsNumerator && fpsDenominator
        ? fpsNumerator / fpsDenominator
        : undefined,
    audioSampleRate: audio?.sample_rate ? Number(audio.sample_rate) : undefined,
    videoCodec: video.codec_name,
    audioCodec: audio?.codec_name,
  };
}

function n(value: number): string {
  return value.toFixed(3);
}

export async function extractAudio(
  videoPath: string,
  audioPath: string,
): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      audioPath,
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
}

export async function renderWithFfmpeg(options: {
  presenter: string;
  cutaways: ResolvedCutaway[];
  graphics: GraphicOverlay[];
  output: string;
  duration: number;
}): Promise<void> {
  await mkdir(dirname(options.output), { recursive: true });

  const args = ["-hide_banner", "-y", "-i", options.presenter];
  for (const cutaway of options.cutaways) {
    if (cutaway.isImage) {
      args.push("-loop", "1", "-framerate", "30");
    } else {
      args.push("-stream_loop", "-1");
    }
    args.push("-i", cutaway.source);
  }
  for (const graphic of options.graphics) {
    args.push("-loop", "1", "-framerate", "30", "-i", graphic.path);
  }

  const filters: string[] = [
    "[0:v]fps=30,split=2[bgraw][fgraw]",
    "[bgraw]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=36[bg]",
    "[fgraw]scale=1080:1920:force_original_aspect_ratio=decrease[fg]",
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[stage0]",
  ];

  let stage = "stage0";
  let inputIndex = 1;
  for (const [index, cutaway] of options.cutaways.entries()) {
    const duration = cutaway.end - cutaway.start;
    filters.push(
      `[${inputIndex}:v]trim=start=${n(cutaway.sourceStart)}:duration=${n(duration)},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setpts=PTS+${n(cutaway.start)}/TB[cutaway${index}]`,
      `[${stage}][cutaway${index}]overlay=eof_action=pass:repeatlast=0[stage${index + 1}]`,
    );
    stage = `stage${index + 1}`;
    inputIndex++;
  }

  for (const [index, graphic] of options.graphics.entries()) {
    const nextStage = `graphicstage${index}`;
    filters.push(
      `[${inputIndex}:v]format=rgba[graphic${index}]`,
      `[${stage}][graphic${index}]overlay=eof_action=pass:repeatlast=0:enable='between(t,${n(graphic.start)},${n(graphic.end)})'[${nextStage}]`,
    );
    stage = nextStage;
    inputIndex++;
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${stage}]`,
    "-map",
    "0:a:0",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-maxrate",
    "20M",
    "-bufsize",
    "40M",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-t",
    n(options.duration),
    options.output,
  );

  await execFileAsync("ffmpeg", args, { maxBuffer: 100 * 1024 * 1024 });
}
