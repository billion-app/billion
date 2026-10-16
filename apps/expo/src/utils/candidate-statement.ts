/** A verbatim opening excerpt; word boundaries never depend on font size or viewport. */
export function candidateStatementExcerpt(statement: string) {
  const text = statement.trim();
  const words = Array.from(text.matchAll(/\S+/g));
  const end = words[29];
  if (words.length <= 30 || !end) return { text, truncated: false };
  return { text: text.slice(0, end.index + end[0].length), truncated: true };
}
