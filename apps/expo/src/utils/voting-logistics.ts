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

/** Use supplied lookup URLs without inferring their authority from the container field. */
export function votingInformationLinks(data: VotingLogisticsData) {
  const links: { label: string; office: string; url: string }[] = [];
  let mailUrl: string | undefined;
  let locationUrl: string | undefined;
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
      const sourceNames = region.sources
        ?.map((source) => {
          const name = clean(source.name);
          return name && source.official === true ? `${name} (official)` : name;
        })
        .filter(Boolean)
        .join(", ");
      const office =
        clean(body.name) ??
        (sourceNames ? `Via ${sourceNames}` : clean(region.name)) ??
        "Voting information";
      if (!url) continue;
      if (field === "absenteeVotingInfoUrl") mailUrl ??= url;
      if (field === "votingLocationFinderUrl") locationUrl ??= url;
      const existing = links.find((link) => link.url === url);
      if (existing) {
        // A single office page may serve several purposes. Keep one action and
        // use a broad label rather than silently advertising only one purpose.
        if (existing.label !== label)
          existing.label = "Voting information website";
      } else {
        links.push({ label, office, url });
      }
    }
  }
  data.state?.forEach(visit);
  // Keep priority tied to the supplied purpose even when deduplication broadens
  // the label. A location finder also takes precedence over registration alone.
  const preferredUrl =
    (data.mailOnly === true ? mailUrl : undefined) ?? locationUrl;
  const preferredIndex = links.findIndex((link) => link.url === preferredUrl);
  if (preferredIndex > 0) links.unshift(...links.splice(preferredIndex, 1));
  return links;
}

/** Format strict calendar dates without shifting a supplied date across time zones. */
export function votingDateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
