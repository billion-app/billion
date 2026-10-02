import type { VotingLogisticsData } from "./voting-logistics";
import { votingGuidance, votingWebUrl } from "./voting-logistics";

export type PlanMethod = "undecided" | "mail" | "in-person";
export const planMethods = ["undecided", "mail", "in-person"] as const;

/** No address, party, eligibility or registration status is stored. */
export function planStorageKey(election: {
  id: string;
  electionDay: string;
  ocdDivisionId: string;
}) {
  return `billion.voting-plan.v1:${encodeURIComponent(JSON.stringify([election.id, election.electionDay, election.ocdDivisionId]))}`;
}
export function readPlanMethod(raw: string | null): PlanMethod {
  return planMethods.find((method) => method === raw) ?? "undecided";
}

/** Local office first; supplied links retain their named attribution. */
export function registrationCheck(data?: VotingLogisticsData) {
  return votingPlanAction(data, "electionRegistrationConfirmationUrl");
}

/** Purpose-specific supplied destinations; absence never establishes method availability. */
export function votingPlanAction(
  data: VotingLogisticsData | undefined,
  field:
    | "electionRegistrationConfirmationUrl"
    | "electionInfoUrl"
    | "absenteeVotingInfoUrl"
    | "votingLocationFinderUrl",
) {
  type Region = NonNullable<VotingLogisticsData["state"]>[number];
  function visit(region: Region): { url: string; name: string } | undefined {
    const local = region.localJurisdiction && visit(region.localJurisdiction);
    if (local) return local;
    // A provider's information website is not necessarily an election office.
    if (
      field === "electionInfoUrl" &&
      region.sources?.some((source) => source.official === false) &&
      !region.sources.some((source) => source.official === true)
    )
      return undefined;
    const body = region.electionAdministrationBody;
    const url = votingWebUrl(body?.[field]);
    const name = body?.name?.trim();
    return url ? { url, name: name?.length ? name : region.name } : undefined;
  }
  return data?.state?.map(visit).find(Boolean);
}

/** Resource-only results are already routed by the plan; keep actual facts visible separately. */
export function hasVotingPlanLogistics(data: VotingLogisticsData) {
  return (
    data.mailOnly === true ||
    [data.pollingLocations, data.earlyVoteSites, data.dropOffLocations].some(
      (locations) => (locations?.length ?? 0) > 0,
    ) ||
    votingGuidance(data) !== undefined
  );
}
