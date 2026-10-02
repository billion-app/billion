/** A verbatim excerpt, never a generated summary. Full text stays unchanged. */
export function candidateStatementExcerpt(statement: string, limit = 360) {
  if (statement.length <= limit) return { text: statement, truncated: false };
  const prefix = statement.slice(0, limit);
  const sentences = [...prefix.matchAll(/[.!?](?=\s|$)/g)];
  const end = sentences.at(-1)?.index;
  const boundary = end !== undefined ? end + 1 : prefix.lastIndexOf(" ");
  const text = statement.slice(0, boundary > 0 ? boundary : limit);
  return { text: end !== undefined ? text : `${text}…`, truncated: true };
}
