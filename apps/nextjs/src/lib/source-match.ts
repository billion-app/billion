/**
 * Where a brief's quote sits in the original text.
 *
 * The pipeline keeps a quote only if it matches the source after
 * normalization (`normalizeForQuoteMatch` in
 * `apps/scraper/src/utils/ai/bill-brief.ts`): curly quotes straightened,
 * words hyphenated across line breaks rejoined, case and punctuation
 * ignored, whitespace collapsed. So an exact `indexOf` misses quotes the
 * pipeline verified — any that crossed a line break, for a start. This
 * applies the same normalization and maps the match back onto the original
 * characters, so the highlight covers the source text exactly as published.
 *
 * A miss is still possible (the source can be re-scraped after the brief was
 * written). Then the reader sees the cited passage, labelled as cited rather
 * than matched, above the full text — never a dead end.
 */
export interface QuoteLocation {
  found: boolean;
  before: string;
  match: string;
  after: string;
}

export function findQuote(text: string, quote: string): QuoteLocation {
  const range = exactRange(text, quote) ?? normalizedRange(text, quote);
  if (!range) return { found: false, before: "", match: quote, after: text };
  const [start, end] = range;
  return {
    found: true,
    before: text.slice(0, start),
    match: text.slice(start, end),
    after: text.slice(end),
  };
}

function exactRange(text: string, quote: string): [number, number] | null {
  const exact = text.indexOf(quote);
  const index =
    exact >= 0
      ? exact
      : text.toLocaleLowerCase().indexOf(quote.toLocaleLowerCase());
  return index >= 0 ? [index, index + quote.length] : null;
}

/**
 * The pipeline's normalization, one output character at a time, remembering
 * which source character each came from.
 */
function normalize(text: string): { chars: string; origin: number[] } {
  let chars = "";
  const origin: number[] = [];
  let pendingSpace = -1;

  for (let i = 0; i < text.length; i++) {
    let ch = text.charAt(i);

    // "trans-\n  portation" → "transportation": drop the hyphen and the break.
    if (/[-‐-―]/.test(ch)) {
      const rest = /^[-‐-―]\s*\n\s*/.exec(text.slice(i));
      if (rest) {
        i += rest[0].length - 1;
        continue;
      }
    }

    ch = ch.replace(/[‘’ʼ]/, "'").replace(/[“”]/, '"').toLowerCase();
    if (/[a-z0-9]/.test(ch)) {
      if (pendingSpace >= 0 && chars.length > 0) {
        chars += " ";
        origin.push(pendingSpace);
      }
      pendingSpace = -1;
      chars += ch;
      origin.push(i);
    } else if (pendingSpace < 0) {
      // Any run of non-alphanumerics becomes one space.
      pendingSpace = i;
    }
  }
  return { chars, origin };
}

function normalizedRange(text: string, quote: string): [number, number] | null {
  const needle = normalize(quote).chars;
  if (!needle) return null;
  const haystack = normalize(text);
  const at = haystack.chars.indexOf(needle);
  if (at < 0) return null;
  const start = haystack.origin[at];
  const last = haystack.origin[at + needle.length - 1];
  if (start === undefined || last === undefined) return null;
  return [start, last + 1];
}
