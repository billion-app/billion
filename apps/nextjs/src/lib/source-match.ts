/**
 * Where a brief's quote sits in the original text.
 *
 * Quotes are verified against the source when the brief is generated, but
 * the stored text can be re-scraped afterwards, so a miss is possible. On a
 * miss the reader still sees the cited passage — labelled as cited rather
 * than matched — above the full text, never a dead end.
 */
export interface QuoteLocation {
  found: boolean;
  before: string;
  match: string;
  after: string;
}

export function findQuote(text: string, quote: string): QuoteLocation {
  const exact = text.indexOf(quote);
  const index =
    exact >= 0
      ? exact
      : text.toLocaleLowerCase().indexOf(quote.toLocaleLowerCase());
  if (index < 0) return { found: false, before: "", match: quote, after: text };
  return {
    found: true,
    before: text.slice(0, index),
    match: text.slice(index, index + quote.length),
    after: text.slice(index + quote.length),
  };
}
