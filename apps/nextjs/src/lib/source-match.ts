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
 * which source character each came from. Straightening curly quotes is not
 * repeated here: quotes are punctuation, and every run of punctuation and
 * whitespace collapses to one space either way.
 */
function normalize(text: string): { chars: string; origin: number[] } {
  let chars = "";
  const origin: number[] = [];
  let pendingSpace = -1;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // "trans-\n  portation" → "transportation": drop the hyphen and the break.
    if (code === 45 || (code >= 0x2010 && code <= 0x2015)) {
      const rest = /^.\s*\n\s*/.exec(text.slice(i, i + 64));
      if (rest) {
        i += rest[0].length - 1;
        continue;
      }
    }

    // Lowercasing can turn one character into two ("İ" → "i̇"); map each
    // output character back to the same source index so offsets stay aligned.
    const lower = text.charAt(i).toLowerCase();
    let kept = false;
    for (const ch of lower) {
      const c = ch.charCodeAt(0);
      const alnum = (c >= 97 && c <= 122) || (c >= 48 && c <= 57);
      if (!alnum) continue;
      if (pendingSpace >= 0 && chars.length > 0) {
        chars += " ";
        origin.push(pendingSpace);
      }
      pendingSpace = -1;
      chars += ch;
      origin.push(i);
      kept = true;
    }
    // Any run of non-alphanumerics becomes one space.
    if (!kept && pendingSpace < 0) pendingSpace = i;
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
