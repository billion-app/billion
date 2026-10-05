/** Definitions belong to the supplied content, never a global inferred dictionary. */
export interface InlineDefinition {
  term: string;
  plain: string;
}
export interface DefinedTextPart {
  text: string;
  definition?: InlineDefinition;
  emphasized: boolean;
}

/** Preserve every character while combining literal terms and exact editorial emphasis. */
export function splitDefinedText(
  text: string,
  terms: readonly InlineDefinition[] = [],
  emphasis: readonly string[] = [],
): DefinedTextPart[] {
  const ranges: {
    start: number;
    end: number;
    definition?: InlineDefinition;
  }[] = [];
  const usable = terms
    .filter((t) => t.term.trim() && t.plain.trim())
    .sort((a, b) => b.term.length - a.term.length);
  if (usable.length) {
    const pattern = new RegExp(
      usable
        .map((t) => t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|"),
      "giu",
    );
    const word = /[\p{L}\p{N}_]/u;
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (
        word.test(text.slice(0, start).at(-1) ?? "") ||
        word.test(text.slice(end).at(0) ?? "")
      )
        continue;
      ranges.push({
        start,
        end,
        definition: usable.find(
          (t) => t.term.toLowerCase() === match[0].toLowerCase(),
        ),
      });
    }
  }
  const bold: { start: number; end: number }[] = [];
  for (const phrase of emphasis.filter((p) => p.length)) {
    let start = text.indexOf(phrase);
    while (start >= 0) {
      bold.push({ start, end: start + phrase.length });
      start = text.indexOf(phrase, start + phrase.length);
    }
  }
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...ranges.flatMap((r) => [r.start, r.end]),
      ...bold.flatMap((r) => [r.start, r.end]),
    ]),
  ].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1] ?? text.length;
    return {
      text: text.slice(start, end),
      definition: ranges.find((r) => r.start <= start && r.end >= end)
        ?.definition,
      emphasized: bold.some((r) => r.start <= start && r.end >= end),
    };
  });
}
