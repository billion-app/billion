import type { BillAction } from "@acme/db/schema";
import { eq, max } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import { congressConfig } from "./congress.config.js";

const BASE_URL = "https://api.congress.gov/v3";
const logger = createLogger("Congress.gov");

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
  updateDate: string;
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

interface ApiAction {
  actionDate: string;
  text: string;
  type?: string;
  actionCode?: string;
  sourceSystem?: {
    code?: number;
    name?: string;
  };
  recordedVotes?: Array<{
    rollNumber?: number;
    url?: string;
  }>;
}

interface ApiPagination {
  count?: number;
}

interface ApiActionsPage {
  actions?: ApiAction[];
  pagination?: ApiPagination;
}

type FetchActionsPage = (
  offset: number,
  limit: number,
) => Promise<ApiActionsPage>;

export function buildActionSourceUrl(billUrl: string): string {
  return `${billUrl.replace(/\/$/, "")}/all-actions`;
}

function actionSourceLocator(action: ApiAction): string {
  const parts = [action.actionDate];
  if (action.sourceSystem?.name) parts.push(action.sourceSystem.name);
  if (action.actionCode) parts.push(`action code ${action.actionCode}`);
  const rollNumber = officialVote(action)?.rollNumber;
  if (rollNumber !== undefined) parts.push(`roll call ${rollNumber}`);
  return parts.join(" · ");
}

function officialVote(action: ApiAction) {
  return (
    action.recordedVotes?.find((vote) => vote.url) ?? action.recordedVotes?.[0]
  );
}

export async function collectCongressActions(
  fetchPage: FetchActionsPage,
  billUrl: string,
): Promise<BillAction[]> {
  const pageSize = 250;
  const allActions: ApiAction[] = [];
  let offset = 0;

  while (true) {
    const data = await fetchPage(offset, pageSize);
    const page = data.actions ?? [];
    allActions.push(...page);

    const total = data.pagination?.count;
    const reachedReportedTotal =
      total !== undefined && allActions.length >= total;
    const reachedLastPage = total === undefined && page.length < pageSize;
    if (page.length === 0 || reachedReportedTotal || reachedLastPage) break;

    offset += page.length;
  }

  const actionRecordUrl = buildActionSourceUrl(billUrl);
  return allActions.map((action) => {
    const vote = officialVote(action);
    return {
      date: action.actionDate,
      text: action.text,
      type: action.type,
      actionCode: action.actionCode,
      sourceSystem: action.sourceSystem?.name,
      // Congress.gov supplies a vote-specific official URL for recorded votes.
      // Other actions have no individual public URL, so cite the stable action
      // record instead of fabricating an anchor that Congress.gov does not expose.
      sourceUrl: vote?.url ?? actionRecordUrl,
      sourceLocator: actionSourceLocator(action),
      textKind: "official",
    };
  });
}

async function fetchActions(
  congress: number,
  billType: string,
  billNumber: string,
  billUrl: string,
): Promise<BillAction[]> {
  try {
    const path = `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/actions`;
    return await collectCongressActions(
      (offset, limit) => congressFetch<ApiActionsPage>(path, { offset, limit }),
      billUrl,
    );
  } catch {
    return [];
  }
}

async function scrape(config: CongressScraperConfig = {}) {
  const { maxBills = 100, congress = 119, chamber = "House" } = config;

  logger.info(`Starting (congress=${congress}, chamber=${chamber})...`);

  // Query the last time we successfully scraped a congress.gov bill
  const [lastScrape] = await db
    .select({ lastUpdated: max(Bill.updatedAt) })
    .from(Bill)
    .where(eq(Bill.sourceWebsite, "congress.gov"));

  const chamberParam = chamber === "House" ? "house" : "senate";

  const fetchParams: Record<string, string | number> = {
    chamber: chamberParam,
    sort: "updateDate+desc",
  };

  if (lastScrape?.lastUpdated) {
    // Congress.gov API expects ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    const fromDate = lastScrape.lastUpdated
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");
    fetchParams.fromDateTime = fromDate;
    logger.info(`Fetching bills updated since ${fromDate}`);
  }

  const allBills: ApiBillListItem[] = [];
  let offset = 0;
  const pageSize = 250;

  while (allBills.length < maxBills) {
    const remaining = maxBills - allBills.length;
    const limit = Math.min(remaining, pageSize);

    const pageData = await congressFetch<{ bills: ApiBillListItem[] }>(
      `/bill/${congress}`,
      { ...fetchParams, limit, offset },
    );

    const page = pageData.bills ?? [];
    allBills.push(...page);
    if (page.length < limit) break;
    offset += page.length;
  }

  const bills = allBills.slice(0, maxBills);
  logger.info(
    `Fetched ${bills.length} bills${lastScrape?.lastUpdated ? " (incremental)" : " (full)"}`,
  );

  if (bills.length === 0) {
    logger.success("No new or updated bills since last scrape");
    return;
  }

  setExpectedTotal(bills.length);

  const limit = getItemLimit();
  const newItemLimiter = createNewItemLimiter();
  await Promise.allSettled(
    bills.map((item) =>
      limit(async () => {
        try {
          const billType = item.type.toLowerCase();
          const billNumber = item.number;

          const detailData = await congressFetch<ApiBillDetail>(
            `/bill/${congress}/${billType}/${billNumber}`,
          );
          const detail = detailData.bill;

          const formattedBillNumber = formatBillNumber(
            detail.type,
            detail.number,
          );
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
          const actions = await fetchActions(
            congress,
            billType,
            billNumber,
            billUrl,
          );

          await upsertContent(
            {
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
                actions,
                url: billUrl,
                sourceWebsite: "congress.gov",
              },
            },
            { newItemLimiter },
          );

          logger.success(`Processed: ${formattedBillNumber} — ${title}`);
        } catch (error) {
          logger.error(
            `Error processing bill ${item.type}${item.number}`,
            error,
          );
        }
      }),
    ),
  );

  logger.success("Completed");
}

export const congress: Scraper = {
  ...congressConfig,
  scrape: (options) =>
    scrape({
      maxBills:
        (options?.maxItems ?? Number(process.env.CONGRESS_MAX_ITEMS)) || 100,
    }),
};
