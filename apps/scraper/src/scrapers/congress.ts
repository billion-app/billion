import { fetchWithRetry } from "../utils/fetch.js";
import { log, logError } from "../utils/log.js";
import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import type { Scraper } from "../utils/types.js";

const BASE_URL = "https://api.congress.gov/v3";
const NAME = "Congress.gov";

interface CongressScraperConfig {
  maxBills?: number;
  congress?: number;
  chamber?: "House" | "Senate";
}

interface ApiBillListItem {
  number: string;
  type: string;
  title: string;
  congress: number;
  url: string;
  latestAction?: { text: string; actionDate: string };
}

interface ApiBillDetail {
  bill: {
    number: string;
    type: string;
    title: string;
    congress: number;
    originChamber: string;
    introducedDate?: string;
    sponsors?: Array<{
      firstName: string;
      lastName: string;
      party: string;
      state: string;
    }>;
    latestAction?: { text: string; actionDate: string };
  };
}

interface ApiSummary {
  actionDate: string;
  actionDesc: string;
  text: string;
  updateDate: string;
}

interface ApiTextVersion {
  type: string;
  date: string | null;
  formats: Array<{ type: string; url: string }>;
}

function getApiKey(): string {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) {
    throw new Error(
      "CONGRESS_API_KEY is not set. Sign up at https://api.congress.gov/sign-up/",
    );
  }
  return key;
}

async function congressFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetchWithRetry(url.toString());
  return res.json() as Promise<T>;
}

function ordinalSuffix(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

function billTypeToUrlSlug(type: string): string {
  const slugMap: Record<string, string> = {
    HR: "house-bill",
    S: "senate-bill",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution",
    SCONRES: "senate-concurrent-resolution",
    HRES: "house-simple-resolution",
    SRES: "senate-simple-resolution",
  };
  return slugMap[type.toUpperCase()] ?? `${type.toLowerCase()}-bill`;
}

function formatBillNumber(type: string, number: string): string {
  const prefixMap: Record<string, string> = {
    HR: "H.R.",
    S: "S.",
    HJRES: "H.J.Res.",
    SJRES: "S.J.Res.",
    HCONRES: "H.Con.Res.",
    SCONRES: "S.Con.Res.",
    HRES: "H.Res.",
    SRES: "S.Res.",
  };
  const prefix = prefixMap[type.toUpperCase()] ?? type;
  return `${prefix} ${number}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchSummary(
  congress: number,
  billType: string,
  billNumber: string,
): Promise<string | undefined> {
  try {
    const data = await congressFetch<{ summaries: ApiSummary[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/summaries`,
    );
    if (!data.summaries?.length) return undefined;
    const latest = data.summaries[data.summaries.length - 1]!;
    return stripHtml(latest.text).slice(0, 5000);
  } catch {
    return undefined;
  }
}

async function fetchFullText(
  congress: number,
  billType: string,
  billNumber: string,
): Promise<string | undefined> {
  try {
    const data = await congressFetch<{ textVersions: ApiTextVersion[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/text`,
    );
    if (!data.textVersions?.length) return undefined;

    for (const version of [...data.textVersions].reverse()) {
      const txtFormat = version.formats.find(
        (f) => f.type === "Formatted Text",
      );
      if (!txtFormat) continue;

      const res = await fetchWithRetry(txtFormat.url);
      const rawText = await res.text();
      if (!rawText) continue;

      let text = stripHtml(rawText);
      const words = text.split(/\s+/);
      if (words.length > 1000) {
        text = words.slice(0, 1000).join(" ");
      }
      return text.trim() || undefined;
    }
  } catch {
    // Full text is optional
  }
  return undefined;
}

async function scrape(config: CongressScraperConfig = {}) {
  const { maxBills = 100, congress = 119, chamber = "House" } = config;

  log(NAME, `Starting (congress=${congress}, chamber=${chamber})...`);
  resetMetrics();

  const chamberParam = chamber === "House" ? "house" : "senate";

  const allBills: ApiBillListItem[] = [];
  let offset = 0;
  const pageSize = 250;

  while (allBills.length < maxBills) {
    const remaining = maxBills - allBills.length;
    const limit = Math.min(remaining, pageSize);

    const pageData = await congressFetch<{ bills: ApiBillListItem[] }>(
      `/bill/${congress}`,
      { chamber: chamberParam, limit, offset, sort: "updateDate+desc" },
    );

    const page = pageData.bills ?? [];
    allBills.push(...page);
    if (page.length < limit) break;
    offset += page.length;
  }

  const bills = allBills.slice(0, maxBills);
  log(NAME, `Fetched ${bills.length} bills`);

  for (const item of bills) {
    try {
      const billType = item.type.toLowerCase();
      const billNumber = item.number;

      const detailData = await congressFetch<ApiBillDetail>(
        `/bill/${congress}/${billType}/${billNumber}`,
      );
      const detail = detailData.bill;

      const formattedBillNumber = formatBillNumber(detail.type, detail.number);
      const title = (detail.title ?? "Unknown").slice(0, 250);

      const primarySponsor = detail.sponsors?.[0];
      const sponsor = primarySponsor
        ? `${primarySponsor.firstName} ${primarySponsor.lastName} (${primarySponsor.party}-${primarySponsor.state})`.slice(
            0,
            250,
          )
        : undefined;

      const status = (detail.latestAction?.text ?? "Unknown").slice(0, 250);
      const introducedDate = detail.introducedDate
        ? new Date(detail.introducedDate)
        : undefined;
      const chamberValue = (detail.originChamber ?? chamber) as
        | "House"
        | "Senate";
      const billUrl = `https://www.congress.gov/bill/${congress}${ordinalSuffix(congress)}-congress/${billTypeToUrlSlug(detail.type)}/${billNumber}`;

      const summary = await fetchSummary(congress, billType, billNumber);
      const fullText = await fetchFullText(congress, billType, billNumber);

      await upsertContent({
        type: "bill",
        data: {
          billNumber: formattedBillNumber,
          title,
          description: summary,
          sponsor,
          status,
          introducedDate,
          congress,
          chamber: chamberValue,
          summary,
          fullText,
          url: billUrl,
          sourceWebsite: "congress.gov",
        },
      });

      log(NAME, `Processed: ${formattedBillNumber} — ${title}`);
    } catch (error) {
      logError(
        NAME,
        `Error processing bill ${item.type}${item.number}`,
        error,
      );
    }
  }

  log(NAME, "Completed");
  printMetricsSummary(NAME);
}

export const congress: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};
