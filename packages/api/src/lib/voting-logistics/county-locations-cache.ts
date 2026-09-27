import { z } from "zod/v4";

export const COUNTY_LOCATIONS_ENDPOINT = "official-county-locations:v1";
export const SANTA_CRUZ_JURISDICTION =
  "ocd-division/country:us/state:ca/county:santa_cruz";
const text = z.string().min(1).max(3000);
const sourceUrl = z
  .string()
  .url()
  .refine((value) => {
    const u = new URL(value);
    return (
      u.origin === "https://votescount.santacruzcountyca.gov" &&
      !u.username &&
      !u.password &&
      u.pathname.endsWith("/VoteCenterDropBoxLocations.aspx")
    );
  });
export const countyLocationsSchema = z.object({
  electionDate: z.iso.date(),
  jurisdiction: z.literal(SANTA_CRUZ_JURISDICTION),
  sourceUrl,
  sourceName: z.literal("Santa Cruz County Elections"),
  fetchedAt: z.iso.datetime(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  coverage: z.literal("published_vote_centers_only"),
  locations: z
    .array(
      z.object({
        name: text,
        line1: text,
        city: text,
        state: z.literal("CA"),
        earlyVoting: z.boolean(),
        schedule: text,
        notes: z.string().max(3000),
        sourceUrl,
      }),
    )
    .min(1)
    .max(100),
});
export type CountyLocations = z.infer<typeof countyLocationsSchema>;
export function countyLocationsCacheParams(
  electionDate: string,
  jurisdiction: string,
): string {
  return JSON.stringify({ electionDate, jurisdiction });
}
