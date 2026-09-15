/** Democracy Works REST v2: https://developers.democracy.works/api/v2 */
import { createHash } from "node:crypto";
import { z } from "zod/v4";

import type {
  Contest,
  Election,
  Source,
  VoterInfoResponse,
} from "../lib/civic";

export const BALLOT_CACHE_VERSION = "democracy-works:v2:1";
const BASE = "https://api.democracy.works/v2";
const text = z.string().nullish();
const candidate = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  partyAffiliation: z.array(z.string()),
  status: text,
  isIncumbent: z.boolean().nullish(),
  ballotpediaUrl: text,
  contact: z
    .object({
      campaign: z.object({ website: text, email: text, phone: text }).nullish(),
    })
    .nullish(),
});
const contest = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.string(),
  districtName: z.string(),
  ocdId: z.string(),
  seatsUpForElection: z.string(),
  candidates: z.array(candidate),
  cancelled: z.boolean().nullish(),
  aboutOffice: text,
});
const measure = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: text,
  districtName: z.string(),
  ocdId: z.string(),
  summary: text,
  ballotQuestion: text,
});
// The published schema uses a single object; accept collections too, but reject
// malformed values. Neither shape has been verified against licensed live data.
const collection = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.array(schema), schema])
    .nullish()
    .transform((value) =>
      value == null ? undefined : Array.isArray(value) ? value : [value],
    );
const electionSchema = z.object({
  description: z.string().min(1),
  date: z.iso.date(),
  ocdId: z.string().min(1),
  type: text,
  canonicalUrl: text,
  website: text,
  pollingLocationUrl: text,
  updatedAt: text,
  contests: collection(contest),
  ballotMeasures: collection(measure),
});
const responseSchema = z.object({
  data: z.object({
    elections: z.array(electionSchema),
    statewideOnly: z.boolean().optional(),
  }),
  pagination: z.object({
    totalRecordCount: z.number().int().nonnegative(),
    currentPage: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
  }),
});
type ProviderElection = z.infer<typeof electionSchema>;

export class BallotProviderError extends Error {
  constructor(
    readonly reason:
      | "configuration"
      | "provider"
      | "response"
      | "selection"
      | "empty"
      | "pagination",
  ) {
    super(
      reason === "configuration"
        ? "Ballot lookup requires a Democracy Works API key with ballot-data access."
        : "Ballot information is unavailable for this lookup. Please check your election office.",
    );
    this.name = "BallotProviderError";
  }
}

function safeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function plainText(value: string | null | undefined): string | undefined {
  const cleaned = value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "" ? undefined : cleaned;
}

function electionIdentity(election: ProviderElection): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        election.ocdId,
        election.date,
        election.type ?? null,
        election.description,
        election.canonicalUrl ?? null,
      ]),
    )
    .digest("hex");
  return `dw:${election.date}:${hash}`;
}
function toElection(election: ProviderElection): Election {
  return {
    id: electionIdentity(election),
    name: election.description,
    electionDay: election.date,
    ocdDivisionId: election.ocdId,
  };
}

function toContests(election: ProviderElection): Contest[] | undefined {
  if (!election.contests && !election.ballotMeasures) return undefined;
  const source: Source = {
    name: "Democracy Works / Ballotpedia",
    official: false,
    url: safeUrl(election.canonicalUrl),
    tier: "ballotpedia",
  };
  const races: Contest[] = (election.contests ?? [])
    .filter((race) => race.cancelled !== true)
    .map((race) => ({
      type: "candidate",
      office: race.name,
      level:
        race.level === "federal"
          ? ["country"]
          : race.level === "state"
            ? ["administrativeArea1"]
            : undefined,
      district: { name: race.districtName, id: race.ocdId },
      numberElected: /^\d+$/.test(race.seatsUpForElection)
        ? race.seatsUpForElection
        : undefined,
      roleDescription: plainText(race.aboutOffice),
      sources: [source],
      candidates: race.candidates.flatMap((person) => {
        if (
          person.status !== "onBallot" &&
          person.status !== "withdrewStillOnBallot"
        )
          return [];
        const campaign = person.contact?.campaign;
        const fields = {
          name: person.fullName,
          party: person.partyAffiliation.join(", ") || undefined,
          candidateUrl: safeUrl(campaign?.website),
          phone: campaign?.phone ?? undefined,
          email: campaign?.email ?? undefined,
          incumbent: person.isIncumbent ?? undefined,
        };
        return [
          {
            ...fields,
            ballotStatus: person.status,
            citations: Object.entries(fields)
              .filter(([, value]) => value !== undefined)
              .map(([field]) => ({
                field,
                sourceName: source.name,
                sourceUrl: safeUrl(person.ballotpediaUrl) ?? source.url,
                tier: "ballotpedia",
                official: false,
              })),
          },
        ];
      }),
    }));
  return [
    ...races,
    ...(election.ballotMeasures ?? []).map((item) => ({
      type: "referendum",
      referendumTitle: plainText(item.shortName) ?? item.name,
      district: { name: item.districtName, id: item.ocdId },
      summary: plainText(item.summary),
      referendumText: plainText(item.ballotQuestion),
      sources: [source],
      citations: [
        ...(item.summary ? ["summary"] : []),
        ...(item.ballotQuestion ? ["referendumText"] : []),
      ].map((field) => ({
        field,
        sourceName: source.name,
        sourceUrl: source.url,
        tier: "ballotpedia",
        official: false,
      })),
    })),
  ];
}

export function createDemocracyWorksClient({
  apiKey = () => process.env.DEMOCRACY_WORKS_API_KEY,
  fetch: request = fetch,
  now = () => new Date(),
}: {
  apiKey?: () => string | undefined;
  fetch?: typeof fetch;
  now?: () => Date;
} = {}) {
  function requireAccess() {
    const key = apiKey()?.trim();
    if (!key) throw new BallotProviderError("configuration");
    return key;
  }
  async function elections(
    address: string,
    includeBallotData: boolean,
    electionId?: string,
  ) {
    const key = requireAccess();
    const selectedDate = electionId?.match(
      /^dw:(\d{4}-\d{2}-\d{2}):[a-f0-9]{64}$/,
    )?.[1];
    if (electionId && !selectedDate) throw new BallotProviderError("selection");
    const startDate = selectedDate ?? now().toISOString().slice(0, 10);
    const records: ProviderElection[] = [];
    let addressScope: "address" | "statewide_only" | "unknown" = "address";
    // At most two pages / eight seconds of upstream waiting per lookup.
    for (let page = 1; page <= 2; page++) {
      const url = new URL(`${BASE}/elections`);
      for (const [name, value] of Object.entries({
        address,
        includeBallotData: String(includeBallotData),
        startDate,
        page: String(page),
        pageSize: "100",
      }))
        url.searchParams.set(name, value);
      if (selectedDate) url.searchParams.set("endDate", selectedDate);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      let payload: z.infer<typeof responseSchema>;
      try {
        const response = await request(url, {
          headers: {
            "x-api-key": key,
            "Accept-Language": "en",
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new BallotProviderError("provider");
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success) throw new BallotProviderError("response");
        payload = parsed.data;
      } catch (error) {
        if (error instanceof BallotProviderError) throw error;
        throw new BallotProviderError("provider");
      } finally {
        clearTimeout(timer);
      }
      const { pagination, data } = payload;
      if (
        pagination.currentPage !== page ||
        pagination.pageSize !== 100 ||
        data.elections.length !==
          Math.min(
            100,
            Math.max(0, pagination.totalRecordCount - (page - 1) * 100),
          )
      )
        throw new BallotProviderError("response");
      if (data.statewideOnly === true) addressScope = "statewide_only";
      else if (
        data.statewideOnly === undefined &&
        addressScope !== "statewide_only"
      )
        addressScope = "unknown";
      records.push(...data.elections);
      if (page * pagination.pageSize >= pagination.totalRecordCount) {
        if (records.length !== pagination.totalRecordCount)
          throw new BallotProviderError("response");
        const ids = records.map(electionIdentity);
        if (new Set(ids).size !== ids.length)
          throw new BallotProviderError("response");
        return {
          records: records
            .filter(
              (item) =>
                item.date >= startDate &&
                (!selectedDate || item.date === selectedDate),
            )
            .sort(
              (a, b) =>
                a.date.localeCompare(b.date) ||
                electionIdentity(a).localeCompare(electionIdentity(b)),
            ),
          addressScope,
        };
      }
    }
    throw new BallotProviderError("pagination");
  }
  return {
    requireAccess,
    async getElections(address: string): Promise<Election[]> {
      return (await elections(address, false)).records.map(toElection);
    },
    async getVoterInfo(
      address: string,
      electionId?: string,
    ): Promise<VoterInfoResponse> {
      const { records, addressScope } = await elections(
        address,
        true,
        electionId,
      );
      const selected = electionId
        ? records.find((item) => electionIdentity(item) === electionId)
        : records[0];
      if (!selected)
        throw new BallotProviderError(electionId ? "selection" : "empty");
      const sourceUrl = safeUrl(selected.canonicalUrl);
      return {
        kind: "democracy-works#voterInfoResponse",
        election: toElection(selected),
        otherElections: records
          .filter((item) => item !== selected)
          .map(toElection),
        submittedAddress: address,
        // DW /elections supplies no normalized address. Empty legacy fields keep
        // installed callers compatible without presenting input as verification.
        normalizedInput: { line1: "", city: "", state: "", zip: "" },
        contests: toContests(selected),
        state: [
          {
            name: selected.description,
            sources: [
              { name: "Democracy Works", url: sourceUrl, official: false },
            ],
            electionAdministrationBody: {
              electionInfoUrl: safeUrl(selected.website),
              votingLocationFinderUrl: safeUrl(selected.pollingLocationUrl),
            },
          },
        ],
        provider: {
          name: "democracy_works",
          sourceUrl,
          updatedAt: selected.updatedAt ?? undefined,
          fetchedAt: now().toISOString(),
          coverage: "partial",
          addressScope,
          ballotDataStatus:
            selected.contests || selected.ballotMeasures
              ? "provided"
              : "unavailable",
          addressNormalization: "unavailable",
          logistics: "lookup_links_only",
        },
      };
    },
  };
}
