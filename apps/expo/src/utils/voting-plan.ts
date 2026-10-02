import type { VotingLogisticsData } from "./voting-logistics";
import { votingWebUrl } from "./voting-logistics";

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
  type Region = NonNullable<VotingLogisticsData["state"]>[number];
  function visit(region: Region): { url: string; name: string } | undefined {
    const local = region.localJurisdiction && visit(region.localJurisdiction);
    if (local) return local;
    const body = region.electionAdministrationBody;
    const url = votingWebUrl(body?.electionRegistrationConfirmationUrl);
    const name = body?.name?.trim();
    return url ? { url, name: name?.length ? name : region.name } : undefined;
  }
  return data?.state?.map(visit).find(Boolean);
}
