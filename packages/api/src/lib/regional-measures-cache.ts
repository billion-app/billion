import { z } from "zod";

import { CA_GENERAL_ELECTION_DATE } from "./official-guide-cache";

export const CA_REGIONAL_MEASURES_ENDPOINT = "ca-regional-measures-v1";
export const RTM_COUNTIES = [
  "Alameda",
  "Contra Costa",
  "San Francisco",
  "San Mateo",
  "Santa Clara",
] as const;
export const regionalSourceUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["mtc.ca.gov", "smcacre.gov", "files.santaclaracounty.gov"].includes(
        url.hostname,
      )
    );
  });
const text = z.string().trim().min(1).max(200_000);
export const regionalMeasureSchema = z.object({
  id: z.literal("ca-ptrmd-2026-11-03-rtm"),
  designation: z.literal("RTM"),
  title: text,
  districtName: z.literal("Public Transit Revenue Measure District"),
  counties: z.tuple([
    z.literal("Alameda"),
    z.literal("Contra Costa"),
    z.literal("San Francisco"),
    z.literal("San Mateo"),
    z.literal("Santa Clara"),
  ]),
  sourceName: text,
  sourceUrl: regionalSourceUrl,
  officialOverview: text,
  ballotQuestion: text,
  fullText: text,
  fullTextUrl: regionalSourceUrl,
  analysisUrl: regionalSourceUrl,
  argumentForUrl: regionalSourceUrl,
  argumentAgainstUrl: regionalSourceUrl,
});
export const regionalMeasuresPayloadSchema = z.object({
  electionDate: z.literal(CA_GENERAL_ELECTION_DATE),
  fetchedAt: z.string().datetime(),
  complete: z.literal(true),
  measures: z.array(regionalMeasureSchema).length(1),
});
export type RegionalMeasure = z.infer<typeof regionalMeasureSchema>;
export type RegionalMeasuresPayload = z.infer<
  typeof regionalMeasuresPayloadSchema
>;
export function regionalMeasuresCacheParams(electionDate: string) {
  return JSON.stringify({ electionDate });
}
export function currentRegionalMeasures(
  value: unknown,
): RegionalMeasuresPayload | null {
  const parsed = regionalMeasuresPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
