export interface SourcePassage {
  found: boolean;
  before: string;
  match: string;
  after: string;
}

export function courtSourceQuote(quote: {
  text: string;
  documentId: string;
  locator: string | null;
}) {
  return {
    text: quote.text,
    documentId: quote.documentId,
    locator: quote.locator ?? undefined,
  };
}

/**
 * Find a cited passage without crossing between separately published court
 * documents. Court source adapters concatenate PDFs behind `Source:` markers;
 * a repeated sentence must resolve inside the document that supplied it.
 */
export function findSourcePassage(
  content: string,
  quote: string,
  documentId?: string,
): SourcePassage {
  const scope: [number, number] | null = documentId
    ? documentRange(content, documentId)
    : [0, content.length];
  if (!scope) return missingPassage(content, quote);

  const [start, end] = scope;
  const document = content.slice(start, end);
  const exact = document.indexOf(quote);
  const localIndex =
    exact >= 0
      ? exact
      : document.toLocaleLowerCase().indexOf(quote.toLocaleLowerCase());
  if (localIndex < 0) return missingPassage(content, quote);

  const index = start + localIndex;
  return {
    found: true,
    before: content.slice(0, index),
    match: content.slice(index, index + quote.length),
    after: content.slice(index + quote.length),
  };
}

function documentRange(
  content: string,
  documentId: string,
): [number, number] | null {
  const id = /^document-(\d+)$/.exec(documentId);
  if (!id) return null;
  const index = Number(id[1]) - 1;
  if (!Number.isSafeInteger(index) || index < 0) return null;

  const markers = [...content.matchAll(/^Source: https?:\/\/\S+\s*\n/gm)];
  if (!markers.length) return index === 0 ? [0, content.length] : null;
  const marker = markers[index];
  if (!marker) return null;
  return [
    marker.index + marker[0].length,
    markers[index + 1]?.index ?? content.length,
  ];
}

function missingPassage(content: string, quote: string): SourcePassage {
  return { found: false, before: "", match: quote, after: content };
}
