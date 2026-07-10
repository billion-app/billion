import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import type { CaptionCue } from "./captions";

export interface GraphicOverlay {
  path: string;
  start: number;
  end: number;
}

const WIDTH = 1080;
const HEIGHT = 1920;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function svgDocument(body: string): Buffer {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${body}
    </svg>
  `);
}

async function writeSvgPng(path: string, body: string): Promise<void> {
  await sharp(svgDocument(body)).png().toFile(path);
}

function centeredText(
  lines: string[],
  firstBaseline: number,
  fontSize: number,
  lineHeight: number,
  family: string,
  weight: number,
): string {
  return lines
    .map(
      (line, index) => `
        <text x="540" y="${firstBaseline + index * lineHeight}" text-anchor="middle"
          fill="#FFFFFF" font-family="${family}" font-size="${fontSize}" font-weight="${weight}">
          ${escapeXml(line)}
        </text>`,
    )
    .join("");
}

export async function createGraphicOverlays(options: {
  directory: string;
  cues: CaptionCue[];
  hook: string;
  cta?: string;
  ctaSubtext?: string;
  duration: number;
}): Promise<GraphicOverlay[]> {
  await mkdir(options.directory, { recursive: true });
  const overlays: GraphicOverlay[] = [];

  const logoPath = join(options.directory, "brand.png");
  await writeSvgPng(
    logoPath,
    `<rect x="54" y="62" width="218" height="68" rx="34" fill="#0E1530" fill-opacity="0.86" stroke="#FFFFFF" stroke-opacity="0.18"/>
     <circle cx="91" cy="96" r="11" fill="#4A7CFF"/>
     <text x="117" y="108" fill="#FFFFFF" font-family="Helvetica Neue, Arial, sans-serif" font-size="34" font-weight="700">BILLION</text>`,
  );
  overlays.push({ path: logoPath, start: 0, end: options.duration });

  const hookLines = wrapText(options.hook, 27).slice(0, 3);
  const hookHeight = 120 + hookLines.length * 72;
  const hookPath = join(options.directory, "hook.png");
  await writeSvgPng(
    hookPath,
    `<rect x="58" y="166" width="964" height="${hookHeight}" rx="34" fill="#0E1530" fill-opacity="0.92" stroke="#FFFFFF" stroke-opacity="0.16"/>
     <text x="540" y="220" text-anchor="middle" fill="#8A8FA0" font-family="Helvetica Neue, Arial, sans-serif" font-size="25" font-weight="700">THE PLAIN-ENGLISH VERSION</text>
     ${centeredText(hookLines, 292, 57, 70, "Georgia, serif", 700)}`,
  );
  overlays.push({
    path: hookPath,
    start: 0,
    end: Math.min(options.duration, 3.2),
  });

  for (const [index, cue] of options.cues.entries()) {
    const lines = wrapText(cue.text, 28).slice(0, 2);
    const cardHeight = lines.length === 1 ? 132 : 202;
    const cardY = 1325;
    const path = join(
      options.directory,
      `caption-${String(index + 1).padStart(3, "0")}.png`,
    );
    await writeSvgPng(
      path,
      `<rect x="70" y="${cardY}" width="940" height="${cardHeight}" rx="30" fill="#0E1530" fill-opacity="0.9" stroke="#FFFFFF" stroke-opacity="0.16"/>
       ${centeredText(lines, cardY + 84, 58, 70, "Helvetica Neue, Arial, sans-serif", 700)}`,
    );
    overlays.push({ path, start: cue.start, end: cue.end });
  }

  if (options.cta) {
    const ctaPath = join(options.directory, "cta.png");
    const ctaLines = wrapText(options.cta, 26).slice(0, 3);
    const subtext = options.ctaSubtext ?? "Get the full context in Billion";
    await writeSvgPng(
      ctaPath,
      `<rect width="1080" height="1920" fill="#0E1530"/>
       <circle cx="540" cy="620" r="38" fill="#4A7CFF"/>
       <text x="540" y="720" text-anchor="middle" fill="#8A8FA0" font-family="Helvetica Neue, Arial, sans-serif" font-size="29" font-weight="700">DON&apos;T STOP AT THE HEADLINE</text>
       ${centeredText(ctaLines, 842, 70, 86, "Georgia, serif", 700)}
       <rect x="160" y="1165" width="760" height="112" rx="56" fill="#FFFFFF"/>
       <text x="540" y="1237" text-anchor="middle" fill="#000000" font-family="Helvetica Neue, Arial, sans-serif" font-size="37" font-weight="700">${escapeXml(subtext)}</text>`,
    );
    overlays.push({
      path: ctaPath,
      start: Math.max(0, options.duration - 2.8),
      end: options.duration,
    });
  }

  return overlays;
}
