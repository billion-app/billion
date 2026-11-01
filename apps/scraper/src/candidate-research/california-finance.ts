import { z } from "zod/v4";

import type {
  CaliforniaRaceTarget,
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";
import {
  campaignFinanceSchema,
  fecCandidateMasterUrl,
  findFecIdentityBridge,
  resolveFecCandidate,
  resolveFecIdentityFromSource,
} from "@acme/validators";

import {
  isCaliforniaSourceUnavailable,
  sourceAcquisitionFailure,
} from "./california-source-availability.js";
import { fecScheduleALayout } from "./fec-filing-transactions.js";
import {
  applyIndependentExpenditures,
  applyReportedContributions,
  collectCommitteeReportingStatus,
  fecBatchUrl,
} from "./fec-finance-components.js";
import { evidence } from "./finance.js";
import { profileFinance } from "./profile.js";
import { hash } from "./sources.js";

const fecCandidateSchema = z.object({
  candidate_id: z.string().regex(/^H[A-Z0-9]{8}$/),
  name: z.string().min(1),
  office: z.string(),
  state: z.string(),
  district: z.union([z.string(), z.number()]).transform(String),
  cycles: z.array(z.number().int()),
  election_years: z.array(z.number().int()),
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
    bridge?: NonNullable<ReturnType<typeof findFecIdentityBridge>>;
  };
}
export function resolveCaliforniaFecCandidate(input: {
  candidates: FecCandidate[];
  name: string;
  district: string;
  cycle: number;
}): FecCandidate | null {
  return resolveFecCandidate(input.candidates, input);
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
    scope?: CaliforniaRaceTarget[];
    rosterSource?: ResearchSource;
    identitySources?: ResearchSource[];
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
    let source: ResearchSource;
    try {
      source = await pending;
    } catch (error) {
      throw sourceAcquisitionFailure(url, error);
    }
    if (!result.sources.some((existing) => existing.id === source.id))
      result.sources.push(source);
    return source;
  };
  const identitySources = [
    ...(input.identitySources ?? []),
    ...(input.rosterSource ? [input.rosterSource] : []),
  ];
  try {
    const master = await get(fecCandidateMasterUrl(cycle), "text");
    const resolve = (
      race: CaliforniaRaceTarget,
      member: CaliforniaRaceTarget["members"][number],
    ) => {
      if (
        race.officeFamily !== "us_house" ||
        !race.district ||
        Number(race.electionDate.slice(0, 4)) !== cycle
      )
        return null;
      const query = {
        name: member.name,
        district: race.district,
        cycle,
        sourceCandidateId: member.sourceCandidateId,
      };
      const bridge = findFecIdentityBridge(master, query, identitySources);
      const identity = resolveFecIdentityFromSource(
        master,
        query,
        bridge,
        identitySources,
      );
      return identity ? { ...identity, ...(bridge ? { bridge } : {}) } : null;
    };
    const identity = resolve(input.race, input.member);
    if (!identity) {
      result.gap =
        "The official candidate master and archived identity bridges did not establish one federal identity for this candidate, district and cycle. Financial amounts are unavailable, not zero.";
      result.gapCode = "identity_unresolved";
      return result;
    }
    result.identityProof = {
      ...identity,
      sourceId: master.id,
      sourceHash: master.contentHash,
    };
    const identitySourceIds = new Set<string>();
    if (identity.bridge?.kind === "official_domain_v1") {
      identitySourceIds.add(identity.bridge.rosterSourceId);
      identitySourceIds.add(identity.bridge.filingSourceId);
    }
    if (identity.bridge?.kind === "sos_legal_name_v1")
      identitySourceIds.add(identity.bridge.sourceId);
    for (const source of identitySources.filter((source) =>
      identitySourceIds.has(source.id),
    ))
      if (!result.sources.some((existing) => existing.id === source.id))
        result.sources.push(source);
    const scope = input.scope ?? [input.race];
    const identities = scope.flatMap((race) =>
      race.members
        .map((member) => resolve(race, member))
        .filter((value): value is NonNullable<typeof value> => value !== null),
    );
    if (!identities.some((value) => value.candidateId === identity.candidateId))
      throw new Error("Finance candidate absent from selected race scope");
    const candidateIds = [
      ...new Set(identities.map((value) => value.candidateId)),
    ].sort();
    const principal = new Map(
      master.text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const fields = line.split("|");
          return [
            fields[0]!,
            {
              committeeId: fields[9]!,
              excerpt: fields.slice(0, 10).join("|"),
            },
          ] as const;
        }),
    );
    const profiles = new Map<string, CampaignFinance>();
    const profileEvidence: CandidateBrief["evidence"] = [];
    const authorized = new Map<string, string[]>();
    for (const selected of identities) {
      try {
        const profileSource = await get(
          `https://www.fec.gov/data/candidate/${selected.candidateId}/?cycle=${cycle}`,
          "html",
        );
        const citations: CandidateBrief["evidence"] = [];
        const profile = profileFinance(
          profileSource,
          {
            fecId: selected.candidateId,
            fecName: selected.name,
            district: selected.district,
            cycle,
          },
          citations,
        );
        profiles.set(selected.candidateId, profile);
        authorized.set(selected.candidateId, profile.committeeId.split(", "));
        if (selected.candidateId === identity.candidateId)
          profileEvidence.push(...citations);
      } catch (error) {
        if (isRunBudget(error) || isCaliforniaSourceUnavailable(error))
          throw error;
      }
      if (!authorized.has(selected.candidateId)) {
        const committee = principal.get(selected.candidateId)?.committeeId;
        if (!committee || !/^C\d{8}$/.test(committee))
          throw new Error("Verified candidate principal committee unavailable");
        authorized.set(selected.candidateId, [committee]);
      }
    }
    const committeeIds = [...new Set([...authorized.values()].flat())].sort();
    const ownCommitteeIds = authorized.get(identity.candidateId)!;
    const principalRow = principal.get(identity.candidateId);
    if (!principalRow || !ownCommitteeIds.includes(principalRow.committeeId))
      throw new Error(
        "Public FEC coverage omits the verified principal committee",
      );
    const reportUrl = new URL(
      fecBatchUrl("reports/house-senate/", cycle, "committee_id", committeeIds),
    );
    reportUrl.searchParams.set("most_recent", "true");
    const reports = await get(reportUrl.toString(), "json", true);
    let finance = profiles.get(identity.candidateId);
    if (finance) result.evidence.push(...profileEvidence);
    if (!finance) {
      if (ownCommitteeIds.length !== 1)
        throw new Error(
          "Reporting status needs one verified principal committee",
        );
      const filingUrl = new URL(
        fecBatchUrl("filings/", cycle, "committee_id", ownCommitteeIds),
      );
      filingUrl.searchParams.set("most_recent", "true");
      const index = await get(filingUrl.toString(), "json", true);
      finance = await collectCommitteeReportingStatus({
        index,
        committeeId: ownCommitteeIds[0]!,
        committeeName: ownCommitteeIds[0]!,
        candidateId: identity.candidateId,
        cycle,
        get,
        sources: result.sources,
        evidence: result.evidence,
      });
    } else {
      const selectedReports = await applyReportedContributions({
        source: reports,
        committeeIds: ownCommitteeIds,
        candidateId: identity.candidateId,
        cycle,
        finance,
        get,
        sources: result.sources,
        evidence: result.evidence,
        layout: fecScheduleALayout,
      });
      if (!selectedReports)
        throw new Error(
          "No processed financial report available for donor selection",
        );
    }
    const identityEvidenceId = `${identity.candidateId}:candidate-committee`;
    result.evidence.push(
      evidence(
        master,
        identityEvidenceId,
        "FEC candidate and principal committee",
        principalRow.excerpt,
        "primary_record",
        "Candidate master columns 1–10: candidate ID, name, party, election year, state, office, district, incumbency, status, principal committee ID",
      ),
    );
    finance.filingEvidenceIds.push(identityEvidenceId);
    const outside = await get(
      fecBatchUrl(
        "schedules/schedule_e/by_candidate/",
        cycle,
        "candidate_id",
        candidateIds,
      ),
      "json",
      true,
    );
    applyIndependentExpenditures({
      source: outside,
      candidateId: identity.candidateId,
      candidateIds,
      cycle,
      finance,
      sources: result.sources,
      evidence: result.evidence,
    });
    finance.coverageNote =
      "Campaign totals retain their reported coverage. Donors are a bounded selection of individual filing transactions, never combined or ranked by name. Independent expenditures cover the separate cycle window of processed periodic reports. New reports may not yet be processed. Lobbying status and interests are not established.";
    result.finance = campaignFinanceSchema.parse(finance);
    return result;
  } catch (error) {
    if (isRunBudget(error) || isCaliforniaSourceUnavailable(error)) throw error;
    if (result.identityProof) throw error;
    result.gap =
      "Official finance acquisition or validation did not complete. Missing campaign totals, donor observations and independent expenditures remain unavailable, not zero.";
    result.gapCode = "source_unavailable";
    return result;
  }
}
