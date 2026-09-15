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
  | "officialVotingGuidance"
  | "officialLocationSource"
> &
  Partial<Pick<VoterInfoResponse, "election">>;

const guidanceTitles = {
  mailing_starts: "Mailing begins by",
  early_voting: "Early voting",
  drop_off: "Ballot drop-off",
  registration: "Registration",
  conditional_registration: "Conditional registration",
  election_day: "Election Day",
  mail_return: "Mail ballot receipt deadline",
} as const;

/** Only show guidance for the selected election; keep official date wording intact. */
export function votingGuidance(data: VotingLogisticsData) {
  const guidance = data.officialVotingGuidance;
  if (!guidance || guidance.electionDate !== data.election?.electionDay)
    return undefined;
  const sourceUrl = votingWebUrl(guidance.sourceUrl);
  if (!sourceUrl) return undefined;
  const items = guidance.items
    .filter((item) => item.dateText.trim() && item.text.trim())
    .map((item) => ({
      ...item,
      title: guidanceTitles[item.kind],
      links: item.links.flatMap((link) => {
        const url = votingWebUrl(link.url);
        return url ? [{ label: link.label, url }] : [];
      }),
    }));
  const fetched = new Date(guidance.fetchedAt);
  const retrievedLabel = Number.isNaN(fetched.getTime())
    ? undefined
    : fetched.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      });
  return items.length
    ? { ...guidance, sourceUrl, items, retrievedLabel }
    : undefined;
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
  if (data.mailOnly) {
    const mailIndex = links.findIndex(
      (link) => link.label === "Absentee and mail voting information",
    );
    if (mailIndex > 0) links.unshift(...links.splice(mailIndex, 1));
  }
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
