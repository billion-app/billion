import { z } from "zod";

export const CA_OFFICIAL_GUIDE_ENDPOINT = "ca-official-guide-v1";
export const CA_OFFICIAL_GUIDE_ADDRESS_HASH = "__global__";
export const CA_OFFICIAL_GUIDE_SOURCE =
  "California Secretary of State Official Voter Information Guide";
const text = z.string().min(1).max(30_000);
const url = z
  .string()
  .url()
  .refine((value) => {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      ["voterguide.sos.ca.gov", "vig.cdn.sos.ca.gov"].includes(parsed.hostname)
    );
  });
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
        sourceUrl: url,
        officialSummary: text.optional(),
        fiscalImpact: text.optional(),
        proArguments: z.array(argument).max(1).optional(),
        conArguments: z.array(argument).max(1).optional(),
        fullTextUrl: url.optional(),
      }),
    )
    .max(100),
  candidates: z
    .array(
      z.object({
        name: text,
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
        statement: text,
        sourceUrl: url,
      }),
    )
    .max(200),
});
export type OfficialGuidePayload = z.infer<typeof officialGuidePayloadSchema>;
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
