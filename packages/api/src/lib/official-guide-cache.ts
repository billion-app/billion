import { z } from "zod";

import { TRILLION_PRECEDENT_HOSTS } from "@acme/validators";

export const CA_OFFICIAL_GUIDE_ENDPOINT = "ca-official-guide-v1";
export const CA_OFFICIAL_GUIDE_ADDRESS_HASH = "__global__";
export const CA_OFFICIAL_GUIDE_SOURCE =
  "California Secretary of State Official Voter Information Guide";
export const CA_GENERAL_ELECTION_DATE = "2026-11-03";
const text = z.string().min(1).max(30_000);
/** Official titles run long; this bounds the formatted copy, markers included. */
export const DISPLAY_TITLE_MAX = 400;
const GUIDE_HOSTS = ["voterguide.sos.ca.gov", "vig.cdn.sos.ca.gov"];
const httpsUrl = (hosts: readonly string[]) =>
  z
    .string()
    .url()
    .refine((value) => {
      const parsed = new URL(value);
      return (
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        !parsed.port &&
        hosts.includes(parsed.hostname)
      );
    });
const url = httpsUrl(GUIDE_HOSTS);
const argument = z.object({ text, sourceName: text, sourceUrl: url });
export const officialGuidePayloadSchema = z.object({
  electionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jurisdiction: z.literal("CA"),
  complete: z.boolean(),
  fetchedAt: z.string().datetime(),
  sourceUrl: url,
  measures: z
    .array(
      z.object({
        number: z.string().regex(/^\d+[A-Z]?$/),
        title: text,
        /**
         * The official title in sentence case with one `**key phrase**`,
         * minus its legal label. The scraper rejects any formatting that
         * changes the official words; it is not part of the guide hash.
         */
        displayTitle: z.string().min(1).max(DISPLAY_TITLE_MAX).optional(),
        /** Prompt version that formatted `displayTitle`; reuse requires a match. */
        displayTitlePrompt: z.string().max(40).optional(),
        sourceUrl: url,
        officialSummary: text.optional(),
        voteMeaningYes: text.optional(),
        voteMeaningNo: text.optional(),
        fiscalImpact: text.optional(),
        proArguments: z.array(argument).max(1).optional(),
        conArguments: z.array(argument).max(1).optional(),
        fullTextUrl: url.optional(),
      }),
    )
    .max(100),
  relationshipSources: z
    .array(
      z.object({
        // Trillion graphs also cite past documents, whose freshness the guide job tracks.
        url: httpsUrl([...GUIDE_HOSTS, ...TRILLION_PRECEDENT_HOSTS]),
        hash: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(200)
    .optional(),
  candidates: z
    .array(
      z.object({
        name: text,
        party: z.string().max(80).optional(),
        officeSlug: z.enum([
          "governor",
          "lt-governor",
          "sos",
          "controller",
          "treasurer",
          "attorney-general",
          "insurance-commissioner",
          "superintendent",
        ]),
        officeName: text.optional(),
        officeDuties: z.array(text).max(10).optional(),
        statement: text,
        sourceUrl: url,
        photoUrl: url.optional(),
      }),
    )
    .max(200),
});
export type OfficialGuidePayload = z.infer<typeof officialGuidePayloadSchema>;
export function currentCaliforniaGuide(
  value: unknown,
): OfficialGuidePayload | null {
  const parsed = officialGuidePayloadSchema.safeParse(value);
  return parsed.success &&
    parsed.data.complete &&
    parsed.data.electionDate === CA_GENERAL_ELECTION_DATE
    ? parsed.data
    : null;
}
export function officialGuideCacheParams(electionDate: string): string {
  return JSON.stringify({ electionDate, jurisdiction: "CA" });
}

export function officialGuideOfficeSlug(office: string): string | null {
  const normalized = office
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const names: Record<string, string> = {
    governor: "governor",
    "lieutenant governor": "lt-governor",
    "secretary of state": "sos",
    controller: "controller",
    treasurer: "treasurer",
    "attorney general": "attorney-general",
    "insurance commissioner": "insurance-commissioner",
    "superintendent of public instruction": "superintendent",
  };
  return (
    names[
      normalized.replace(/^california /, "").replace(/ of california$/, "")
    ] ?? null
  );
}
