import type { ScraperEnvContract } from "@acme/env";

export interface CivicEngageJurisdictionConfig {
  id: string;
  name: string;
  governingBody: string;
  civicEngageBaseUrl: string;
  recordsPagePath: string;
  timezone: string;
  provider: {
    kind: "municode-publish-page";
    clientId: string;
    publishPageId: string;
    meetingNamePattern: RegExp;
  };
}

/**
 * Cedar Park's public website is CivicEngage, but its City Council records page
 * now embeds Municode Meetings. Keeping both halves in configuration makes the
 * adapter reusable when another CivicEngage jurisdiction uses the same embed,
 * without pretending all CivicEngage Agenda Centers share this provider.
 */
export const cedarParkCouncilSource: CivicEngageJurisdictionConfig = {
  id: "cedar-park-tx",
  name: "City of Cedar Park, Texas",
  governingBody: "City Council",
  civicEngageBaseUrl: "https://www.cedarparktexas.gov",
  recordsPagePath: "/596/City-Council-Agendas",
  timezone: "America/Chicago",
  provider: {
    kind: "municode-publish-page",
    clientId: "CPTX",
    publishPageId: "d5927f56-2e55-4a02-a095-4ed5e6109cfd",
    meetingNamePattern: /\b(?:city\s+)?council\b/i,
  },
};

export function municodePublishPageUrl(
  config: CivicEngageJurisdictionConfig,
): string {
  const url = new URL("https://meetings.municode.com/PublishPage/index");
  url.searchParams.set("cid", config.provider.clientId);
  url.searchParams.set("ppid", config.provider.publishPageId);
  url.searchParams.set("p", "-1");
  return url.toString();
}

export const cedarParkCouncilConfig = {
  id: "cedar-park-council",
  name: "Cedar Park City Council",
  source: "Cedar Park CivicEngage / official Municode Meetings embed",
  environment: {
    required: ["POSTGRES_URL"],
    optional: ["CEDAR_PARK_COUNCIL_MAX_ITEMS"],
  },
} as const satisfies ScraperEnvContract;
