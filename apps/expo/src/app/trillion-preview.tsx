import { useLocalSearchParams } from "expo-router";

import { publicTrillionGraphSchema } from "@acme/validators";

import { TrillionScreen } from "~/components/trillion/TrillionScreen";

// Development only: the quote-verified pilot graphs, without the API or the
// guide-freshness gate. The conditional require keeps them out of release bundles.
const pilots = __DEV__
  ? {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      "40": require("~/components/trillion/development/prop40-pilot.json") as unknown,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      "42": require("~/components/trillion/development/prop42-generated.json") as unknown,
    }
  : {};

export default function TrillionPreview() {
  const { number = "40", view } = useLocalSearchParams<{
    number?: string;
    view?: string;
  }>();
  const value = (pilots as Record<string, unknown>)[number];
  if (!value) return null;
  return (
    <TrillionScreen
      graph={publicTrillionGraphSchema.parse(value)}
      view={view === "map" ? "map" : "list"}
    />
  );
}
