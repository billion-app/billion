export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/);

  if (!match) {
    throw new Error(`Invalid SRT timestamp: ${value}`);
  }

  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds) / 1000
  );
}

export function parseSrt(input: string): CaptionCue[] {
  const blocks = input
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean);

  const cues = blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));

    if (timingIndex === -1) {
      throw new Error(`Caption block ${index + 1} has no timing line.`);
    }

    const timing = lines[timingIndex]!.match(
      /^(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/,
    );

    if (!timing) {
      throw new Error(`Caption block ${index + 1} has invalid timing.`);
    }

    const start = parseTimestamp(timing[1]!);
    const end = parseTimestamp(timing[2]!);
    const text = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      throw new Error(`Caption block ${index + 1} has no text.`);
    }
    if (end <= start) {
      throw new Error(`Caption block ${index + 1} ends before it starts.`);
    }

    return { start, end, text };
  });

  return cues.sort((a, b) => a.start - b.start);
}

export function splitCaptionCues(
  cues: CaptionCue[],
  maxWords = 6,
): CaptionCue[] {
  return cues.flatMap((cue) => {
    const words = cue.text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return cue;

    const duration = cue.end - cue.start;
    const chunks: CaptionCue[] = [];

    for (let offset = 0; offset < words.length; offset += maxWords) {
      const chunk = words.slice(offset, offset + maxWords);
      const start = cue.start + duration * (offset / words.length);
      const end =
        cue.start + duration * ((offset + chunk.length) / words.length);
      chunks.push({ start, end, text: chunk.join(" ") });
    }

    return chunks;
  });
}

function formatTimestamp(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
}

export function formatSrt(cues: CaptionCue[]): string {
  return `${cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}`,
    )
    .join("\n\n")}\n`;
}

interface TimedWord {
  normalized: string;
  start: number;
  end: number;
}

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function timedWords(cues: CaptionCue[]): TimedWord[] {
  return cues.flatMap((cue) => {
    const words = cue.text.split(/\s+/).filter(Boolean);
    const duration = cue.end - cue.start;
    return words.map((word, index) => ({
      normalized: normalizeWord(word),
      start: cue.start + duration * (index / words.length),
      end: cue.start + duration * ((index + 1) / words.length),
    }));
  });
}

export function findPhraseTime(
  cues: CaptionCue[],
  phrase: string,
): { start: number; end: number } | undefined {
  const words = timedWords(cues);
  const needle = phrase.split(/\s+/).map(normalizeWord).filter(Boolean);

  if (needle.length === 0) return undefined;

  for (let index = 0; index <= words.length - needle.length; index++) {
    const matches = needle.every(
      (word, offset) => words[index + offset]?.normalized === word,
    );
    if (matches) {
      return {
        start: words[index]!.start,
        end: words[index + needle.length - 1]!.end,
      };
    }
  }

  return undefined;
}
