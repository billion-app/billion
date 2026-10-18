import type { PollingLocation, VoterInfoResponse } from "@acme/api";

import type { AppLanguage } from "~/i18n/language";
import { translateApp } from "~/i18n/app-strings";
import { formatDate, localeTag } from "~/i18n/format";
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
  mailing_starts: "voting.guidance.mailing_starts",
  early_voting: "voting.guidance.early_voting",
  drop_off: "voting.guidance.drop_off",
  registration: "voting.guidance.registration",
  conditional_registration: "voting.guidance.conditional_registration",
  election_day: "voting.guidance.election_day",
  mail_return: "voting.guidance.mail_return",
} as const;

/** Only show guidance for the selected election; keep official date wording intact. */
export function votingGuidance(
  data: VotingLogisticsData,
  language: AppLanguage = "en",
) {
  const guidance = data.officialVotingGuidance;
  if (!guidance || guidance.electionDate !== data.election?.electionDay)
    return undefined;
  const sourceUrl = votingWebUrl(guidance.sourceUrl);
  if (!sourceUrl) return undefined;
  const items = guidance.items
    .filter((item) => item.dateText.trim() && item.text.trim())
    .map((item) => ({
      ...item,
      title: translateApp(language, guidanceTitles[item.kind]),
      links: item.links.flatMap((link) => {
        const url = votingWebUrl(link.url);
        return url ? [{ label: link.label, url }] : [];
      }),
    }));
  const fetched = new Date(guidance.fetchedAt);
  const retrievedLabel = Number.isNaN(fetched.getTime())
    ? undefined
    : fetched.toLocaleString(localeTag(language), {
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

export function describeVotingLocation(
  location: PollingLocation,
  language: AppLanguage = "en",
) {
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
      clean(location.name) ??
      clean(address.locationName) ??
      translateApp(language, "voting.locationFallback"),
    address: addressText || translateApp(language, "voting.addressMissing"),
    sources: (location.sources ?? []).map((source) => {
      const name =
        clean(source.name) ?? translateApp(language, "voting.unnamedSource");
      return {
        label: translateApp(
          language,
          source.official === true
            ? "voting.sourceOfficial"
            : "voting.sourceUnconfirmed",
          { name },
        ),
        url: votingWebUrl(source.url),
      };
    }),
  };
}

export function votingLocationGroups(
  data: VotingLogisticsData,
  language: AppLanguage = "en",
) {
  return [
    {
      kind: "election_day" as const,
      title: translateApp(language, "voting.guidance.election_day"),
      locations: data.pollingLocations ?? [],
    },
    {
      kind: "early_voting" as const,
      title: translateApp(language, "voting.guidance.early_voting"),
      locations: data.earlyVoteSites ?? [],
    },
    {
      kind: "drop_off" as const,
      title: translateApp(language, "voting.guidance.drop_off"),
      locations: data.dropOffLocations ?? [],
    },
  ];
}

/** Use supplied lookup URLs without inferring their authority from the container field. */
export function votingInformationLinks(
  data: VotingLogisticsData,
  language: AppLanguage = "en",
) {
  const links: { label: string; office: string; url: string }[] = [];
  let mailUrl: string | undefined;
  let locationUrl: string | undefined;
  const t = (key: Parameters<typeof translateApp>[1], name?: string) =>
    translateApp(language, key, name === undefined ? undefined : { name });
  const fields = [
    ["votingLocationFinderUrl", t("voting.link.findLocations")],
    ["electionRegistrationUrl", t("voting.link.registration")],
    ["absenteeVotingInfoUrl", t("voting.link.absentee")],
    ["ballotInfoUrl", t("voting.link.ballot")],
    ["electionInfoUrl", t("voting.link.election")],
    ["electionRulesUrl", t("voting.link.rules")],
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
          return name && source.official === true
            ? t("voting.sourceOfficial", name)
            : name;
        })
        .filter(Boolean)
        .join(", ");
      const office =
        clean(body.name) ??
        (sourceNames ? t("voting.via", sourceNames) : clean(region.name)) ??
        t("voting.information");
      if (!url) continue;
      if (field === "absenteeVotingInfoUrl") mailUrl ??= url;
      if (field === "votingLocationFinderUrl") locationUrl ??= url;
      const existing = links.find((link) => link.url === url);
      if (existing) {
        // A single office page may serve several purposes. Keep one action and
        // use a broad label rather than silently advertising only one purpose.
        if (existing.label !== label) existing.label = t("voting.link.website");
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
export function votingDateLabel(value: string, language: AppLanguage = "en") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    return value;
  return formatDate(
    language,
    date,
    { month: "short", day: "numeric", year: "numeric" },
    { calendar: true },
  );
}
