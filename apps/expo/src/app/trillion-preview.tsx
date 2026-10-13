import { useLocalSearchParams } from "expo-router";

import { developmentDebate } from "~/components/trillion/development/pilots";
import { TrillionScreen } from "~/components/trillion/TrillionScreen";

/** Development only: a bundled pilot debate, without the API. */
export default function TrillionPreview() {
  const { number = "40", view } = useLocalSearchParams<{
    number?: string;
    view?: string;
  }>();
  const graph = developmentDebate(number);
  if (!graph) return null;
  return (
    <TrillionScreen graph={graph} view={view === "map" ? "map" : "list"} />
  );
}
