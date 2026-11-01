import type { RouterOutputs } from "~/utils/api";

type RegionalMeasure = NonNullable<
  RouterOutputs["civic"]["getCaliforniaRegionalMeasures"]
>["measures"][number];
export function regionalMeasureRoute(
  measure: RegionalMeasure,
  electionDate: string,
) {
  return {
    pathname: "/measure-detail" as const,
    params: {
      referendumTitle: `Measure ${measure.designation}`,
      measureScope: measure.counties.join(", "),
      electionDate,
      summary: measure.ballotQuestion,
      referendumUrl: measure.fullTextUrl,
      analysisUrl: measure.analysisUrl,
      argumentForUrl: measure.argumentForUrl,
      argumentAgainstUrl: measure.argumentAgainstUrl,
      citations: JSON.stringify([
        {
          field: "summary",
          sourceName: "Public Transit Revenue Measure District resolution",
          sourceUrl: measure.fullTextUrl,
          tier: "county_registrar",
          official: true,
        },
      ]),
    },
  };
}
