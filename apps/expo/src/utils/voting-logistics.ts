import type { PollingLocation, VoterInfoResponse } from "@acme/api";

import { webUrl } from "./web-url";

export const votingWebUrl: (value?: string) => string | undefined = webUrl;

export type VotingLogisticsData = Pick<
  VoterInfoResponse,
  | "pollingLocations"
  | "earlyVoteSites"
  | "dropOffLocations"
  | "mailOnly"
  | "state"
>;

const clean = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
};

export function describeVotingLocation(location: PollingLocation) {
  const address = location.address;
  const cityState = [clean(address.city), clean(address.state)]
    .filter(Boolean)
    .join(", ");
  const addressText = [
    clean(address.line1),
    clean(address.line2),
    clean(address.line3),
    [cityState, clean(address.zip)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return {
    name:
      clean(location.name) ?? clean(address.locationName) ?? "Voting location",
    address: addressText || "Address not supplied.",
    sources: (location.sources ?? []).map((source) => ({
      label: `${clean(source.name) ?? "Unnamed source"}${source.official === true ? " (official)" : " (official status not confirmed)"}`,
      url: votingWebUrl(source.url),
    })),
  };
}

export function votingLocationGroups(data: VotingLogisticsData) {
  return [
    {
      title: "Election Day",
      locations: data.pollingLocations ?? [],
    },
    { title: "Early voting", locations: data.earlyVoteSites ?? [] },
    {
      title: "Ballot drop-off",
      locations: data.dropOffLocations ?? [],
    },
  ];
}

/** Administration-body URLs are supplied election-office links, not inferred URLs. */
export function votingInformationLinks(data: VotingLogisticsData) {
  const links: { label: string; office: string; url: string }[] = [];
  const fields = [
    ["votingLocationFinderUrl", "Find voting locations"],
    ["electionRegistrationUrl", "Registration information"],
    ["absenteeVotingInfoUrl", "Absentee and mail voting information"],
    ["ballotInfoUrl", "Ballot information"],
    ["electionInfoUrl", "Election information"],
    ["electionRulesUrl", "Voting rules"],
  ] as const;
  type Region = NonNullable<VotingLogisticsData["state"]>[number];
  function visit(region: Region) {
    if (region.localJurisdiction) visit(region.localJurisdiction);
    const body = region.electionAdministrationBody;
    if (!body) return;
    for (const [field, label] of fields) {
      const url = votingWebUrl(body[field]);
      const office =
        clean(body.name) ?? clean(region.name) ?? "Election office";
      if (!url) continue;
      const existing = links.find((link) => link.url === url);
      if (existing) {
        // A single office page may serve several purposes. Keep one action and
        // use a broad label rather than silently advertising only one purpose.
        if (existing.label !== label)
          existing.label = "Election office website";
      } else {
        links.push({ label, office, url });
      }
    }
  }
  data.state?.forEach(visit);
  return links;
}
