import type { ContentItem } from "./content";
import type { DecisionRow } from "./local-government";

export type SavedRow =
  | { kind: "content"; id: string; content: ContentItem }
  | { kind: "local"; id: string; decision: DecisionRow }
  | { kind: "unavailable"; id: string };

export function hydrateSavedRows(
  ids: readonly string[],
  content: readonly ContentItem[],
  decisions: readonly DecisionRow[],
): SavedRow[] {
  const contentById = new Map(content.map((item) => [item.id, item]));
  const decisionsById = new Map(decisions.map((item) => [item.id, item]));
  return ids.map((id) => {
    const item = contentById.get(id);
    if (item) return { kind: "content", id, content: item };
    const decision = decisionsById.get(id);
    return decision
      ? { kind: "local", id, decision }
      : { kind: "unavailable", id };
  });
}
