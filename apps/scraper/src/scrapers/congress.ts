/**
 * Congress.gov Bill Scraper
 *
 * Uses the official Congress.gov REST API (api.congress.gov/v3/) instead of
 * HTML scraping. This gives us clean, structured JSON data for bills,
 * summaries, sponsors, and full-text links — no Cheerio, no CSS selectors,
 * no fragile DOM parsing.
 *
 * Requires: CONGRESS_API_KEY in your .env file.
 * Sign up free at: https://api.congress.gov/sign-up/
 */

import { printMetricsSummary, resetMetrics } from "../utils/db/metrics.js";
import { upsertBill } from "../utils/db/operations.js";

const BASE_URL = "https://api.congress.gov/v3";

// ─── Config ──────────────────────────────────────────────────────────────────

interface CongressScraperConfig {
  maxBills?: number;   // Default: 100
  congress?: number;   // Default: 119
  chamber?: "House" | "Senate"; // Default: "House"
  /**
   * @deprecated This option is ignored. Kept for backward compatibility with older callers.
   */
  maxRequests?: number;
}

// ─── API response shapes (partial — only what we use) ────────────────────────

interface ApiBillListItem {
  number: string;           // e.g. "1234"
  type: string;             // e.g. "HR", "S", "HJRES"
  title: string;
  congress: number;
  url: string;              // Link back to this API resource
  latestAction?: {
    text: string;
    actionDate: string;
  };
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
    latestAction?: {
      text: string;
      actionDate: string;
    };
  };
}

interface ApiSummary {
  actionDate: string;
  actionDesc: string;
  text: string;             // HTML-encoded summary text
  updateDate: string;
}

interface ApiTextVersion {
  type: string;             // e.g. "Introduced in House"
  date: string | null;
  formats: Array<{
    type: string;           // "Formatted Text", "PDF", "Formatted XML"
    url: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) {
    throw new Error(
      "CONGRESS_API_KEY is not set. Sign up at https://api.congress.gov/sign-up/ " +
      "and add it to your .env file."
    );
  }
  return key;
}

async function congressFetch<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  // Basic network hardening: per-request timeout + limited retries for transient errors.
  const timeoutMs = 30_000; // 30 seconds
  const maxRetries = 3;

  let attempt = 0;
  // Exponential backoff: 1s, 2s, 4s between retries (for 429/5xx only).
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });

      if (res.ok) {
        return res.json() as Promise<T>;
      }

      // Retry on transient errors (rate limits / server errors) up to maxRetries.
      const isRetriableStatus =
        res.status === 429 || (res.status >= 500 && res.status < 600);

      if (isRetriableStatus && attempt < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Non-retriable error or retries exhausted: surface full error text.
      throw new Error(
        `Congress API ${path} → HTTP ${res.status}: ${await res.text()}`
      );
    } catch (err: unknown) {
      // If the request was aborted due to timeout, surface a clear message.
      if (
        err instanceof Error &&
        (err.name === "AbortError" ||
          // Some environments use a different error name/message for aborted fetches.
          err.message.toLowerCase().includes("aborted"))
      ) {
        throw new Error(
          `Congress API ${path} → request timed out after ${timeoutMs}ms`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** Return the correct ordinal suffix for a congress number (e.g. 1→"st", 2→"nd", 119→"th") */
function ordinalSuffix(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

/** Map API bill type codes to human-readable bill number format (e.g. "HR" → "H.R.") */
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

/** Strip HTML tags from summary text returned by the API */
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

/**
 * Fetch the latest summary text for a bill.
 * Returns undefined if no summaries exist.
 */
async function fetchSummary(
  congress: number,
  billType: string,
  billNumber: string
): Promise<string | undefined> {
  try {
    const data = await congressFetch<{ summaries: ApiSummary[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/summaries`
    );
    if (!data.summaries?.length) return undefined;
    // The last item is the most recent summary
    const latest = data.summaries[data.summaries.length - 1]!;
    return stripHtml(latest.text).slice(0, 5000);
  } catch {
    return undefined;
  }
}

/**
 * Fetch full plain text for a bill.
 * Downloads the "Formatted Text" version if available, falls back to nothing.
 * Truncates to 1,000 words to match the govtrack scraper behaviour.
 */
async function fetchFullText(
  congress: number,
  billType: string,
  billNumber: string
): Promise<string | undefined> {
  try {
    const data = await congressFetch<{ textVersions: ApiTextVersion[] }>(
      `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/text`
    );
    if (!data.textVersions?.length) return undefined;

    // Prefer the most recent text version with a plain-text format
    for (const version of [...data.textVersions].reverse()) {
      const txtFormat = version.formats.find((f) => f.type === "Formatted Text");
      if (!txtFormat) continue;

      const txtController = new AbortController();
      const txtTimeoutId = setTimeout(() => txtController.abort(), 30_000);
      let rawText: string | undefined;
      try {
        const res = await fetch(txtFormat.url, { signal: txtController.signal });
        if (res.ok) {
          rawText = await res.text();
        }
      } finally {
        clearTimeout(txtTimeoutId);
      }
      if (!rawText) continue;
      let text = stripHtml(rawText);
      // Truncate to 1,000 words
      const words = text.split(/\s+/);
      if (words.length > 1000) {
        text = words.slice(0, 1000).join(" ");
      }
      return text.trim() || undefined;
    }
  } catch {
    // Full text is optional — continue without it
  }
  return undefined;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeCongress(config: CongressScraperConfig = {}) {
  const {
    maxBills = 100,
    congress = 119,
    chamber = "House",
  } = config;

  console.log(
    `Starting Congress.gov API scraper (congress=${congress}, chamber=${chamber})...`
  );
  resetMetrics();

  // The API uses lowercase chamber strings for filtering
  const chamberParam = chamber === "House" ? "house" : "senate";

  // ── Step 1: fetch bill listing (paginated — API max 250 per page) ──────────
  const allBills: ApiBillListItem[] = [];
  let offset = 0;
  const pageSize = 250; // API maximum per page

  while (allBills.length < maxBills) {
    const remaining = maxBills - allBills.length;
    const limit = Math.min(remaining, pageSize);

    const pageData = await congressFetch<{ bills: ApiBillListItem[] }>(
      `/bill/${congress}`,
      {
        chamber: chamberParam,
        limit,
        offset,
        sort: "updateDate+desc",
      }
    );

    const page = pageData.bills ?? [];
    allBills.push(...page);

    // Stop early if the API returned fewer items than requested (last page)
    if (page.length < limit) break;

    offset += page.length;
  }

  const bills = allBills.slice(0, maxBills);
  console.log(`Fetched ${bills.length} bills from Congress API.`);

  // ── Step 2: enrich each bill with detail, summary, and full text ───────────
  for (const item of bills) {
    try {
      const billType = item.type.toLowerCase(); // e.g. "hr", "s"
      const billNumber = item.number;           // e.g. "1234"

      // Detail endpoint
      const detailData = await congressFetch<ApiBillDetail>(
        `/bill/${congress}/${billType}/${billNumber}`
      );
      const detail = detailData.bill;

      const formattedBillNumber = formatBillNumber(detail.type, detail.number);
      const title = (detail.title ?? "Unknown").slice(0, 250);

      // Sponsor — use the first (primary) sponsor
      const primarySponsor = detail.sponsors?.[0];
      const sponsor = primarySponsor
        ? `${primarySponsor.firstName} ${primarySponsor.lastName} (${primarySponsor.party}-${primarySponsor.state})`.slice(0, 250)
        : undefined;

      // Status: most recent legislative action text
      const status = (detail.latestAction?.text ?? "Unknown").slice(0, 250);

      const introducedDate = detail.introducedDate
        ? new Date(detail.introducedDate)
        : undefined;

      const chamberValue = (detail.originChamber ?? chamber) as "House" | "Senate";

      // Canonical congress.gov bill page URL
      const billUrl = `https://www.congress.gov/bill/${congress}${ordinalSuffix(congress)}-congress/${chamberValue.toLowerCase()}-bill/${billNumber}`;

      // Summary from CRS — replaces the need to AI-generate a summary in most cases
      const summary = await fetchSummary(congress, billType, billNumber);

      // Full text — used downstream for AI article generation
      const fullText = await fetchFullText(congress, billType, billNumber);

      await upsertBill({
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
      });

      console.log(`Processed: ${formattedBillNumber} — ${title}`);
    } catch (error) {
      console.error(`Error processing bill ${item.type}${item.number}:`, error);
    }
  }

  console.log("Congress.gov API scraper completed.");
  printMetricsSummary("Congress.gov");
}