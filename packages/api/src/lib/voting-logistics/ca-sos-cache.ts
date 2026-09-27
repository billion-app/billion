import { z } from "zod/v4";

/** Official statewide guidance, never a verified address or assigned location. */
export const CA_LOGISTICS_ENDPOINT = "ca-sos-election-logistics:v1";
export type ElectionGuidance = z.infer<typeof electionGuidanceSchema>;
export function caLogisticsCacheParams(electionDate: string): string {
  return JSON.stringify({
    electionDate,
    jurisdiction: "ocd-division/country:us/state:ca",
  });
}

const officialUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        (url.hostname === "ca.gov" || url.hostname.endsWith(".ca.gov"))
      );
    } catch {
      return false;
    }
  }, "Expected California government HTTPS URL");
export const electionGuidanceSchema = z
  .object({
    electionDate: z.iso.date(),
    jurisdiction: z.literal("ocd-division/country:us/state:ca"),
    sourceUrl: officialUrl.refine(
      (value) =>
        new URL(value).hostname === "www.sos.ca.gov" &&
        /\/key-dates-deadlines\/?$/.test(new URL(value).pathname),
    ),
    sourceName: z.literal("California Secretary of State"),
    fetchedAt: z.iso.datetime(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    coverage: z.literal("statewide_guidance_only"),
    items: z
      .array(
        z.object({
          kind: z.enum([
            "mailing_starts",
            "early_voting",
            "drop_off",
            "registration",
            "conditional_registration",
            "election_day",
            "mail_return",
          ]),
          text: z.string().min(1).max(3000),
          dateText: z.string().min(1).max(200),
          links: z
            .array(
              z.object({ label: z.string().min(1).max(300), url: officialUrl }),
            )
            .max(10),
        }),
      )
      .min(1)
      .max(7),
  })
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.kind)).size === value.items.length,
    "Duplicate guidance kinds",
  );
