import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import type { CaptionCue } from "./captions";
import { findPhraseTime } from "./captions";

export interface VideoCutaway {
  source: string;
  rights: "owned" | "official-public-domain" | "licensed" | "ai-generated";
  sourceUrl?: string;
  start?: number;
  after?: string;
  end?: number;
  duration?: number;
  sourceStart?: number;
}

export interface VideoProject {
  presenter: string;
  captions?: string;
  script?: string;
  output?: string;
  hook: string;
  cta?: string;
  ctaSubtext?: string;
  cutaways?: VideoCutaway[];
}

export interface ResolvedCutaway {
  source: string;
  rights: VideoCutaway["rights"];
  sourceUrl?: string;
  start: number;
  end: number;
  sourceStart: number;
  isImage: boolean;
}

function requireString(
  value: unknown,
  field: string,
  optional = false,
): string | undefined {
  if (optional && value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `project.json field "${field}" must be a non-empty string.`,
    );
  }
  return value.trim();
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `project.json field "${field}" must be a non-negative number.`,
    );
  }
  return value;
}

export async function loadVideoProject(
  projectDirectory: string,
): Promise<VideoProject> {
  const manifestPath = resolve(projectDirectory, "project.json");
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
    string,
    unknown
  >;

  const cutaways = raw.cutaways;
  if (cutaways !== undefined && !Array.isArray(cutaways)) {
    throw new Error('project.json field "cutaways" must be an array.');
  }

  return {
    presenter: requireString(raw.presenter, "presenter")!,
    captions: requireString(raw.captions, "captions", true),
    script: requireString(raw.script, "script", true),
    output: requireString(raw.output, "output", true),
    hook: requireString(raw.hook, "hook")!,
    cta: requireString(raw.cta, "cta", true),
    ctaSubtext: requireString(raw.ctaSubtext, "ctaSubtext", true),
    cutaways: (cutaways ?? []).map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`cutaways[${index}] must be an object.`);
      }
      const cutaway = item as Record<string, unknown>;
      const rights = requireString(cutaway.rights, `cutaways[${index}].rights`);
      const validRights = [
        "owned",
        "official-public-domain",
        "licensed",
        "ai-generated",
      ] as const;
      if (!validRights.includes(rights as (typeof validRights)[number])) {
        throw new Error(
          `cutaways[${index}].rights must be one of: ${validRights.join(", ")}.`,
        );
      }
      const sourceUrl = requireString(
        cutaway.sourceUrl,
        `cutaways[${index}].sourceUrl`,
        true,
      );
      if (
        (rights === "licensed" || rights === "official-public-domain") &&
        !sourceUrl
      ) {
        throw new Error(
          `cutaways[${index}].sourceUrl is required for ${rights} media.`,
        );
      }
      const start = optionalNumber(cutaway.start, `cutaways[${index}].start`);
      const after = requireString(
        cutaway.after,
        `cutaways[${index}].after`,
        true,
      );

      if ((start === undefined) === (after === undefined)) {
        throw new Error(
          `cutaways[${index}] needs exactly one of "start" or "after".`,
        );
      }

      return {
        source: requireString(cutaway.source, `cutaways[${index}].source`)!,
        rights: rights as VideoCutaway["rights"],
        sourceUrl,
        start,
        after,
        end: optionalNumber(cutaway.end, `cutaways[${index}].end`),
        duration: optionalNumber(
          cutaway.duration,
          `cutaways[${index}].duration`,
        ),
        sourceStart: optionalNumber(
          cutaway.sourceStart,
          `cutaways[${index}].sourceStart`,
        ),
      };
    }),
  };
}

export function resolveProjectPath(
  projectDirectory: string,
  value: string,
): string {
  return resolve(projectDirectory, value);
}

export function resolveCutaways(
  projectDirectory: string,
  cutaways: VideoCutaway[],
  cues: CaptionCue[],
  videoDuration: number,
): ResolvedCutaway[] {
  return cutaways.map((cutaway, index) => {
    const phraseMatch = cutaway.after
      ? findPhraseTime(cues, cutaway.after)
      : undefined;

    if (cutaway.after && !phraseMatch) {
      throw new Error(
        `Could not find cutaways[${index}].after phrase "${cutaway.after}" in the captions.`,
      );
    }

    const start = cutaway.start ?? phraseMatch!.start;
    const end = Math.min(
      cutaway.end ?? start + (cutaway.duration ?? 3.5),
      videoDuration,
    );

    if (end <= start) {
      throw new Error(`cutaways[${index}] must end after it starts.`);
    }

    const source = resolveProjectPath(projectDirectory, cutaway.source);
    return {
      source,
      rights: cutaway.rights,
      sourceUrl: cutaway.sourceUrl,
      start,
      end,
      sourceStart: cutaway.sourceStart ?? 0,
      isImage: [".png", ".jpg", ".jpeg", ".webp"].includes(
        extname(source).toLocaleLowerCase(),
      ),
    };
  });
}
