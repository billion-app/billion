import type { PollingLocation, VoterInfoResponse } from "@acme/api";

export type VotingLogisticsData = Pick<
  VoterInfoResponse,
  | "pollingLocations"
  | "earlyVoteSites"
  | "dropOffLocations"
  | "mailOnly"
  | "state"
>;

/** Accept web links only; provider strings must never launch arbitrary schemes. */
export function votingWebUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

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
    details: [
      clean(location.pollingHours)
        ? `Hours: ${location.pollingHours}`
        : "Hours not supplied.",
      clean(location.startDate) ? `Starts: ${location.startDate}` : undefined,
      clean(location.endDate) ? `Ends: ${location.endDate}` : undefined,
      clean(location.notes) ? `Notes: ${location.notes}` : undefined,
      clean(location.voterServices)
        ? `Services: ${location.voterServices}`
        : undefined,
    ].filter((value): value is string => Boolean(value)),
    sources: (location.sources ?? []).map((source) => ({
      label: `${clean(source.name) ?? "Unnamed source"}${source.official === true ? " (official)" : " (official status not confirmed)"}`,
      url: votingWebUrl(source.url),
    })),
  };
}

export function votingLocationGroups(data: VotingLogisticsData) {
  return [
    {
      title: "Election Day polling locations",
      locations: data.pollingLocations ?? [],
    },
    { title: "Early voting locations", locations: data.earlyVoteSites ?? [] },
    {
      title: "Ballot drop-off locations",
      locations: data.dropOffLocations ?? [],
    },
  ];
}

/** Administration-body URLs are supplied election-office links, not inferred URLs. */
export function votingInformationLinks(data: VotingLogisticsData) {
  const links: { label: string; office: string; url: string }[] = [];
  const fields = [
    ["electionRegistrationUrl", "Registration information"],
    ["absenteeVotingInfoUrl", "Absentee and mail voting information"],
    ["ballotInfoUrl", "Ballot information"],
    ["votingLocationFinderUrl", "Find voting locations"],
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
      if (
        url &&
        !links.some(
          (link) =>
            link.url === url && link.label === label && link.office === office,
        )
      ) {
        links.push({ label, office, url });
      }
    }
  }
  data.state?.forEach(visit);
  return links;
}
