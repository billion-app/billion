import type { PublicTrillionGraph } from "@acme/validators";
import { publicTrillionGraphSchema } from "@acme/validators";

// Development only: the quote-verified pilot graphs, without the API or the
// guide-freshness gate. The conditional require keeps them out of release bundles.
const pilots: Record<string, unknown> = __DEV__
  ? {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      "40": require("./prop40-pilot.json") as unknown,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      "41": require("./prop41-generated.json") as unknown,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      "42": require("./prop42-generated.json") as unknown,
    }
  : {};

/** A bundled pilot debate for a measure, in development builds only. */
export function developmentDebate(
  number: string | undefined,
): PublicTrillionGraph | undefined {
  const value = number ? pilots[number] : undefined;
  return value ? publicTrillionGraphSchema.parse(value) : undefined;
}
