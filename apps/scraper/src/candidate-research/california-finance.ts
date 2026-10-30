import { z } from "zod/v4";

import type {
  CaliforniaRaceTarget,
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";
import { campaignFinanceSchema } from "@acme/validators";

import { buildFinance } from "./finance.js";
import { profileFinance } from "./profile.js";
import { fecRows, field, hash } from "./sources.js";

const fecCandidateSchema = z.object({
  candidate_id: z.string().regex(/^H[A-Z0-9]{8}$/),
  name: z.string().min(1),
  office: z.string(),
  state: z.string(),
  district: z.union([z.string(), z.number()]).transform(String),
  cycles: z.array(z.number().int()),
  election_years: z.array(z.number().int()),
});
const indexPageSchema = z.object({
  results: z.array(fecCandidateSchema).max(100),
  pagination: z.object({
    count: z.number().int().min(0),
    pages: z.number().int().min(0).max(2),
    page: z.number().int().min(1).max(2),
    is_count_exact: z.boolean().optional(),
  }),
});
type FecCandidate = z.infer<typeof fecCandidateSchema>;
export interface CaliforniaFinanceDependencies {
  fetch(
    id: string,
    url: string,
    publisher: string,
    format: ResearchSource["format"],
    apiKey?: string,
  ): Promise<ResearchSource>;
  sharedSources: Map<string, Promise<ResearchSource>>;
  budget: { request(): void };
  apiKey?: string;
}
export interface CaliforniaFederalFinance {
  finance: CampaignFinance | null;
  sources: ResearchSource[];
  evidence: CandidateBrief["evidence"];
  gap: string | null;
  gapCode:
    | "source_unavailable"
    | "identity_unresolved"
    | "not_applicable"
    | null;
  identityProof?: {
    candidateId: string;
    name: string;
    office: "H";
    state: "CA";
    district: string;
    cycle: number;
    sourceId: string;
    sourceHash: string;
  };
}
const canonicalName = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleUpperCase("en-US")
    .replace(/[.'’"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function fecName(value: string) {
  const pieces = value.split(",");
  return canonicalName(
    pieces.length === 2 ? `${pieces[1]} ${pieces[0]}` : value,
  );
}
export function resolveCaliforniaFecCandidate(input: {
  candidates: FecCandidate[];
  name: string;
  district: string;
  cycle: number;
}): FecCandidate | null {
  const matches = input.candidates.filter(
    (candidate) =>
      candidate.office === "H" &&
      candidate.state === "CA" &&
      Number(candidate.district) === Number(input.district) &&
      candidate.cycles.includes(input.cycle) &&
      candidate.election_years.includes(input.cycle) &&
      fecName(candidate.name) === canonicalName(input.name),
  );
  return matches.length === 1 ? matches[0]! : null;
}
function isRunBudget(error: unknown) {
  return (
    error instanceof Error &&
    error.constructor.name === "CaliforniaBudgetReached"
  );
}
export async function collectCaliforniaFederalFinance(
  input: {
    race: CaliforniaRaceTarget;
    member: CaliforniaRaceTarget["members"][number];
  },
  deps: CaliforniaFinanceDependencies,
): Promise<CaliforniaFederalFinance> {
  const result: CaliforniaFederalFinance = {
    finance: null,
    sources: [],
    evidence: [],
    gap: null,
    gapCode: null,
  };
  if (input.race.officeFamily !== "us_house") {
    result.gap =
      "Federal FEC records do not apply to this state or local office.";
    result.gapCode = "not_applicable";
    return result;
  }
  const cycle = Number(input.race.electionDate.slice(0, 4));
  const district = input.race.district;
  if (
    !district ||
    !/^\d{1,2}$/.test(district) ||
    Number(district) < 1 ||
    Number(district) > 52 ||
    input.race.jurisdiction !==
      `ocd-division/country:us/state:ca/cd:${Number(district)}` ||
    cycle % 2 !== 0
  ) {
    result.gap =
      "The federal office, California district and election cycle could not be verified for finance retrieval.";
    result.gapCode = "identity_unresolved";
    return result;
  }
  const apiKey = deps.apiKey?.trim() || "DEMO_KEY";
  const get = async (
    url: string,
    format: ResearchSource["format"],
    keyed = false,
  ) => {
    let pending = deps.sharedSources.get(url);
    if (!pending) {
      deps.budget.request();
      pending = deps.fetch(
        `fec-${hash(url).slice(0, 20)}`,
        url,
        "Federal Election Commission",
        format,
        keyed ? apiKey : undefined,
      );
      deps.sharedSources.set(url, pending);
    }
    const source = await pending;
    if (!result.sources.some((existing) => existing.id === source.id))
      result.sources.push(source);
    return source;
  };
  const api = (path: string, params: Record<string, string> = {}) => {
    const url = new URL(`https://api.open.fec.gov/v1/${path}`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    return get(url.toString(), "json", true);
  };
  let candidate: FecCandidate;
  try {
    const rows: FecCandidate[] = [];
    const ids = new Set<string>();
    const sourcesByCandidate = new Map<string, ResearchSource>();
    let count = 0;
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const source = await api("candidates/search/", {
        office: "H",
        state: "CA",
        cycle: String(cycle),
        election_year: String(cycle),
        district: district.padStart(2, "0"),
        per_page: "100",
        page: String(page),
      });
      const parsed = indexPageSchema.parse(JSON.parse(source.text));
      if (
        parsed.pagination.page !== page ||
        parsed.pagination.is_count_exact === false ||
        parsed.pagination.count > 200 ||
        (page > 1 && parsed.pagination.count !== count)
      )
        throw new Error(
          "FEC candidate index is partial or changed during pagination",
        );
      count = parsed.pagination.count;
      pages = parsed.pagination.pages;
      for (const row of parsed.results) {
        if (ids.has(row.candidate_id))
          throw new Error("Duplicate FEC candidate identity");
        ids.add(row.candidate_id);
        rows.push(row);
        sourcesByCandidate.set(row.candidate_id, source);
      }
    }
    if (rows.length !== count)
      throw new Error("FEC candidate index was truncated");
    const matched = resolveCaliforniaFecCandidate({
      candidates: rows,
      name: input.member.name,
      district,
      cycle,
    });
    const identitySource =
      matched && sourcesByCandidate.get(matched.candidate_id);
    if (!matched || !identitySource) {
      result.gap =
        "The bounded official FEC candidate index did not provide one exact full-name match for this House office, California district and election cycle. Financial totals, donors and outside spending remain unavailable.";
      result.gapCode = "identity_unresolved";
      return result;
    }
    candidate = matched;
    result.identityProof = {
      candidateId: candidate.candidate_id,
      name: candidate.name,
      office: "H",
      state: "CA",
      district,
      cycle,
      sourceId: identitySource.id,
      sourceHash: identitySource.contentHash,
    };
  } catch (error) {
    if (isRunBudget(error)) throw error;
    result.gap =
      "The bounded official FEC candidate-index request or validation failed. No federal identity was inferred from a name alone, and unavailable financial amounts are not zero.";
    result.gapCode = "source_unavailable";
    return result;
  }
  let profile: CampaignFinance | null = null;
  const profileEvidence: CandidateBrief["evidence"] = [];
  try {
    const source = await get(
      `https://www.fec.gov/data/candidate/${candidate.candidate_id}/?cycle=${cycle}`,
      "html",
    );
    profile = profileFinance(
      source,
      {
        fecId: candidate.candidate_id,
        fecName: candidate.name,
        district,
        cycle,
      },
      profileEvidence,
    );
  } catch (error) {
    if (isRunBudget(error)) throw error;
  }
  if (apiKey !== "DEMO_KEY") {
    try {
      const metadata = await api(`candidate/${candidate.candidate_id}/`);
      const identities = z
        .array(fecCandidateSchema)
        .parse(fecRows(metadata).results);
      if (
        identities.length !== 1 ||
        identities[0]?.candidate_id !== candidate.candidate_id ||
        !resolveCaliforniaFecCandidate({
          candidates: identities,
          name: input.member.name,
          district,
          cycle,
        })
      )
        throw new Error(
          "FEC metadata no longer matches the official candidate index",
        );
      const totals = await api(`candidate/${candidate.candidate_id}/totals/`, {
        cycle: String(cycle),
      });
      const committees = await api(
        `candidate/${candidate.candidate_id}/committees/`,
        { cycle: String(cycle), per_page: "100" },
      );
      const committeePage = fecRows(committees);
      if (committeePage.pagination.count !== committeePage.results.length)
        throw new Error("FEC committee coverage exceeds the retrieval bound");
      const authorized = committeePage.results.filter(
        (row) => row.designation === "P" || row.designation === "A",
      );
      if (!authorized.length || authorized.length > 3)
        throw new Error(
          "Authorized committee coverage exceeds the retrieval bound",
        );
      const total = fecRows(totals).results[0];
      if (!total) throw new Error("FEC financial totals unavailable");
      const minDate = field(total, "coverage_start_date").slice(0, 10);
      const maxDate = field(total, "coverage_end_date").slice(0, 10);
      const receipts: ResearchSource[] = [];
      for (const committee of authorized)
        receipts.push(
          await api("schedules/schedule_a/", {
            committee_id: field(committee, "committee_id"),
            two_year_transaction_period: String(cycle),
            per_page: "100",
            sort: "-contribution_receipt_amount",
            min_date: minDate,
            max_date: maxDate,
            min_amount: "0.01",
          }),
        );
      const outside = await api("schedules/schedule_e/", {
        candidate_id: candidate.candidate_id,
        cycle: String(cycle),
        per_page: "100",
        is_notice: "false",
        most_recent: "true",
        min_date: minDate,
        max_date: maxDate,
      });
      const evidence: CandidateBrief["evidence"] = [];
      result.finance = campaignFinanceSchema.parse(
        buildFinance({
          candidateId: candidate.candidate_id,
          district,
          cycle,
          metadata,
          totals,
          committees,
          receipts,
          outside,
          sources: result.sources,
          evidence,
        }),
      );
      result.evidence = evidence;
      return result;
    } catch (error) {
      if (isRunBudget(error)) throw error;
    }
  }
  result.finance = profile;
  if (profile) result.evidence = profileEvidence;
  else {
    result.gap =
      "An exact official FEC identity was verified, but the public financial summary and bounded API records could not be retrieved and reconciled. Financial totals, donor identities and outside spending remain unavailable, not zero.";
    result.gapCode = "source_unavailable";
  }
  return result;
}
