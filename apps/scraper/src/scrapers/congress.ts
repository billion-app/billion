import { eq, max } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill } from "@acme/db/schema";

import type { NewItemLimiter } from "../utils/new-item-limit.js";
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
  /** Bill identifiers to fetch directly instead of walking the update feed. */
  bills?: string[];
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

const urlSlugToApiType: Record<string, string> = {
  "house-bill": "hr",
  "senate-bill": "s",
  "house-joint-resolution": "hjres",
  "senate-joint-resolution": "sjres",
  "house-concurrent-resolution": "hconres",
  "senate-concurrent-resolution": "sconres",
  "house-simple-resolution": "hres",
  "senate-simple-resolution": "sres",
};

/**
 * Recover the congress.gov API's {billType, billNumber} from a stored bill
 * URL (built by `scrape()` as .../bill/{congress}th-congress/{slug}/{number}).
 * The Bill row only persists the human-formatted billNumber (e.g. "H.R. 1234"),
 * not the raw API type/number, so this is the only way to re-hit the API later.
 */
export function parseBillUrl(
  url: string,
): { billType: string; billNumber: string } | undefined {
  const match = /\/bill\/\d+\w{2}-congress\/([a-z-]+)\/(\d+)/.exec(url);
  if (!match) return undefined;
  const [, slug, number] = match;
  const billType = urlSlugToApiType[slug!];
  if (!billType || !number) return undefined;
  return { billType, billNumber: number };
}

const apiBillTypes = new Set(Object.values(urlSlugToApiType));

/**
 * Parse a human-written bill identifier into the congress.gov API's
 * {billType, billNumber}. Punctuation and spacing within the type are ignored,
 * so the forms people actually paste all work: "H.R. 7008", "hr7008",
 * "H.Con.Res. 113". The number itself must be contiguous — otherwise a typo
 * like "H.R. 70 08" would silently resolve to a different real bill.
 */
export function parseBillIdentifier(
  input: string,
): { billType: string; billNumber: string } | undefined {
  const match = /^([a-z][a-z.\s]*?)[.\s]*(\d+)$/i.exec(input.trim());
  if (!match) return undefined;
  const billType = match[1]!.replace(/[.\s]/g, "").toLowerCase();
  if (!apiBillTypes.has(billType)) return undefined;
  return { billType, billNumber: match[2]! };
}

function chamberForBillType(billType: string): "House" | "Senate" {
  return billType.startsWith("h") ? "House" : "Senate";
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

export async function fetchSummary(
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

export async function fetchFullText(
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
}

async function fetchActions(
  congress: number,
  billType: string,
  billNumber: string,
): Promise<
  { date: string; text: string; type?: string; actionCode?: string }[]
> {
  try {
    const data = await congressFetch<{ actions: ApiAction[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/actions`,
    );
    if (!data.actions?.length) return [];
    return data.actions.map((a) => ({
      date: a.actionDate,
      text: a.text,
      type: a.type,
      actionCode: a.actionCode,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch one bill's detail/summary/text/actions and upsert it. Shared by the
 * incremental feed walk and the targeted `--bill` path.
 */
async function processBill(
  congress: number,
  billType: string,
  billNumber: string,
  fallbackChamber: "House" | "Senate",
  newItemLimiter: NewItemLimiter,
): Promise<void> {
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
  const chamberValue = (detail.originChamber ?? fallbackChamber) as
    | "House"
    | "Senate";
  const billUrl = `https://www.congress.gov/bill/${congress}${ordinalSuffix(congress)}-congress/${billTypeToUrlSlug(detail.type)}/${billNumber}`;

  const summary = await fetchSummary(congress, billType, billNumber);
  const fullText = await fetchFullText(congress, billType, billNumber);
  const actions = await fetchActions(congress, billType, billNumber);

  await upsertContent(
    {
      type: "bill",
      data: {
        billNumber: formattedBillNumber,
        title,
        // Keep the official CRS summary as source material. The DB
        // pipeline generates the compact, app-facing description.
        description: undefined,
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
}

/**
 * Fetch specific bills by number, bypassing the incremental `fromDateTime`
 * cursor. A normal run only sees bills updated since the last successful
 * scrape and caps each window at `maxBills`, so anything that overflowed a
 * busy window becomes unreachable once the cursor moves past it. This is how
 * those gaps get backfilled.
 */
async function scrapeTargeted(identifiers: string[], congress: number) {
  const targets = identifiers.map((identifier) => {
    const parsed = parseBillIdentifier(identifier);
    if (!parsed) {
      throw new Error(
        `Unrecognized bill identifier "${identifier}" (expected e.g. "H.R. 7008" or "S.J.Res. 5")`,
      );
    }
    return parsed;
  });

  logger.info(
    `Fetching ${targets.length} requested bill(s) from congress ${congress}...`,
  );
  setExpectedTotal(targets.length);

  // Every bill here was explicitly asked for, so none should be downgraded to
  // a raw-content save by the per-run new-item budget.
  const newItemLimiter = createNewItemLimiter(targets.length);
  const limit = getItemLimit();
  const results = await Promise.allSettled(
    targets.map(({ billType, billNumber }) =>
      limit(() =>
        processBill(
          congress,
          billType,
          billNumber,
          chamberForBillType(billType),
          newItemLimiter,
        ),
      ),
    ),
  );

  // Unlike the feed walk, a targeted run has no later run to retry it — fail
  // loudly so the caller knows the bill still isn't in the database.
  const failures = results.flatMap((result, i) =>
    result.status === "rejected"
      ? [{ target: targets[i]!, reason: result.reason as unknown }]
      : [],
  );
  for (const { target, reason } of failures) {
    logger.error(
      `Error processing bill ${target.billType}${target.billNumber}`,
      reason,
    );
  }
  if (failures.length > 0) {
    throw new Error(
      `Failed to process ${failures.length} of ${targets.length} requested bill(s)`,
    );
  }

  logger.success("Completed");
}

async function scrape(config: CongressScraperConfig = {}) {
  const { maxBills = 100, congress = 119, chamber = "House" } = config;

  if (config.bills?.length) {
    return scrapeTargeted(config.bills, congress);
  }

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
          await processBill(
            congress,
            item.type.toLowerCase(),
            item.number,
            chamber,
            newItemLimiter,
          );
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
      bills: options?.targets,
      ...(options?.congress ? { congress: options.congress } : {}),
    }),
};
