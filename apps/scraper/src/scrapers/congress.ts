import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { ScraperCursor } from "@acme/db/schema";

import type { UpsertOutcome } from "../utils/db/operations.js";
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
  /**
   * Refresh the N most recently updated bills instead of walking the cursor.
   * See `scrapeRecent`.
   */
  recent?: number;
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
    /** The source's own last-modified time; the incremental cursor rides on this. */
    updateDate?: string;
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

/**
 * congress.gov sort values are documented as `<field>+<direction>`, and the `+`
 * has to arrive at the API as a literal `+`.
 *
 * These are written with a **space** because `congressFetch` builds the query
 * with `URLSearchParams`, which percent-encodes a literal `+` to `%2B` — and
 * the API does not recognise `updateDate%2Basc`, so it silently ignores the
 * parameter and falls back to its own default ordering. A space is encoded as
 * `+`, which is exactly the wire format the docs ask for.
 *
 * This was verified against the live API: `sort=updateDate%2Bdesc` returns the
 * *oldest* bills of the congress, while `sort=updateDate+desc` returns today's.
 * The ascending walk appeared to work only because ascending is the default.
 */
export const SORT_UPDATE_ASC = "updateDate asc";
export const SORT_UPDATE_DESC = "updateDate desc";

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

/**
 * Postgres rejects `to_tsvector` input over 1,048,575 bytes and
 * `Bill.searchVector` is a generated column over `full_text`, so an oversized
 * bill cannot be stored whole. Keep a wide margin under that ceiling.
 *
 * We refuse the bill rather than truncating it. A truncated bill is not a
 * smaller bill, it is a *wrong* one: H.R. 7008's brief told readers the bill
 * specified no penalties because the penalties were past the cut. An absent
 * bill is visibly absent; a truncated one reads as complete and misinforms.
 * Section-aware storage (#191) is what actually fixes these.
 */
const MAX_FULL_TEXT_BYTES = 800_000;

export class BillTextTooLargeError extends Error {
  constructor(
    readonly label: string,
    readonly bytes: number,
  ) {
    super(
      `${label}: full text is ${bytes} bytes, over the ${MAX_FULL_TEXT_BYTES}-byte storage ceiling — refusing to store a truncated bill`,
    );
    this.name = "BillTextTooLargeError";
  }
}

/** Throws `BillTextTooLargeError` rather than returning a shortened string. */
export function assertWithinTsvectorLimit(text: string, label: string): string {
  // Byte length, not character count: bill text carries multibyte punctuation
  // (section signs, em dashes, curly quotes) that a char count undercounts.
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_FULL_TEXT_BYTES) {
    throw new BillTextTooLargeError(label, bytes);
  }
  return text;
}

/**
 * Order text versions newest-first so we store the *operative* text.
 *
 * This used to be `[...textVersions].reverse()`, which assumes the API returns
 * oldest-first. It returns newest-first, so the reverse picked the version a
 * bill was introduced as — for every bill, forever. H.R. 7008 passed the House
 * with a substitute that added SEC. 3, "Requiring Voters To Provide Photo
 * Identification"; we stored the January introduced draft, which contains none
 * of it, and the app told readers the bill was only about stock trading.
 *
 * Sort explicitly rather than trusting either order. Versions without a date
 * sort last: an undated version is not evidence of being current.
 */
export function orderTextVersionsNewestFirst(
  versions: readonly ApiTextVersion[],
): ApiTextVersion[] {
  return [...versions].sort((a, b) => {
    const aTime = a.date ? Date.parse(a.date) : NaN;
    const bTime = b.date ? Date.parse(b.date) : NaN;
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (aValid && bValid) return bTime - aTime;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
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

    for (const version of orderTextVersionsNewestFirst(data.textVersions)) {
      const txtFormat = version.formats.find(
        (f) => f.type === "Formatted Text",
      );
      if (!txtFormat) continue;

      const res = await fetchWithRetry(txtFormat.url);
      const rawText = await res.text();
      if (!rawText) continue;

      // Store the bill as published. An earlier 1,000-word cap silently cut
      // most bills off mid-section — H.R. 7008 lost its entire penalties
      // section, and the brief generator then reported that the bill
      // specified no penalties. Downstream consumers window this text to fit
      // their own context budget (see SOURCE_WINDOW in ai/bill-brief.ts);
      // truncating at ingest time only destroys information for all of them.
      const text = stripHtml(rawText).trim();
      return assertWithinTsvectorLimit(text, billNumber) || undefined;
    }
  } catch (error) {
    // Full text is otherwise optional — a fetch failure degrades to a bill
    // without text. Oversize is different: it means we *have* the text and
    // cannot store it faithfully, and swallowing it here would save the bill
    // textless, which is the silent-wrongness this check exists to prevent.
    if (error instanceof BillTextTooLargeError) throw error;
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
 * Whether an item's outcome lets the cursor move past it.
 *
 * `deferred` is the one that must not: the bill is not in the database in the
 * state we want it, for a reason a later run can fix. `skipped` may, because
 * re-offering the bill unchanged would reach the same conclusion — and any real
 * change upstream moves its `updateDate`, which puts it back in the feed.
 */
export function advancesCursor(outcome: UpsertOutcome): boolean {
  return outcome.status !== "deferred";
}

/**
 * How far the cursor may move given this run's outcomes, in feed order.
 *
 * Only the leading run of clean bills counts. The feed is sorted oldest-first,
 * so the first bill we could not settle is the true high-water mark: moving
 * past it would strand it exactly the way the old wall-clock cursor did.
 * Everything from there on is simply re-offered next run, however many of them
 * happened to succeed.
 */
export function cursorHighWaterMark(
  outcomes: { ok: boolean; sourceUpdatedAt?: Date }[],
): { highWaterMark: Date | undefined; held: number } {
  const firstFailure = outcomes.findIndex((outcome) => !outcome.ok);
  const settled =
    firstFailure === -1 ? outcomes : outcomes.slice(0, firstFailure);
  const highWaterMark = settled.reduce<Date | undefined>(
    (newest, outcome) =>
      outcome.sourceUpdatedAt && (!newest || outcome.sourceUpdatedAt > newest)
        ? outcome.sourceUpdatedAt
        : newest,
    undefined,
  );
  return { highWaterMark, held: outcomes.length - settled.length };
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
): Promise<{ outcome: UpsertOutcome; sourceUpdatedAt?: Date }> {
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

  // No slice: `Bill.status` is text. A 250-char slice into a varchar(100)
  // column is what made every bill with a long action text fail to insert.
  const status = detail.latestAction?.text ?? "Unknown";
  const introducedDate = detail.introducedDate
    ? new Date(detail.introducedDate)
    : undefined;
  const chamberValue = (detail.originChamber ?? fallbackChamber) as
    | "House"
    | "Senate";
  const billUrl = `https://www.congress.gov/bill/${congress}${ordinalSuffix(congress)}-congress/${billTypeToUrlSlug(detail.type)}/${billNumber}`;

  const sourceUpdatedAt = detail.updateDate
    ? new Date(detail.updateDate)
    : undefined;

  const summary = await fetchSummary(congress, billType, billNumber);
  const fullText = await fetchFullText(congress, billType, billNumber);
  const actions = await fetchActions(congress, billType, billNumber);

  const outcome = await upsertContent(
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
        sourceUpdatedAt,
      },
    },
    { newItemLimiter },
  );

  if (outcome.status === "written") {
    logger.success(`Processed: ${formattedBillNumber} — ${title}`);
  } else {
    logger.info(
      `${outcome.status === "skipped" ? "Skipped" : "Deferred"}: ${formattedBillNumber} — ${outcome.reason}`,
    );
  }
  return { outcome, sourceUpdatedAt };
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
  // loudly so the caller knows the bill still isn't in the database. A bill
  // that was deferred or skipped counts too: the caller asked for it by name
  // and it is not there, which a zero exit code would hide.
  const failures = results.flatMap((result, i) => {
    const target = targets[i]!;
    if (result.status === "rejected") {
      return [{ target, reason: result.reason as unknown }];
    }
    const { outcome } = result.value;
    return outcome.status === "written"
      ? []
      : [{ target, reason: `${outcome.status}: ${outcome.reason}` }];
  });
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

/**
 * Refresh the `count` most recently updated bills in a congress.
 *
 * This is the daily production mode. It trades completeness for freshness: the
 * app is a news feed, so a bill whose status changed today matters more than
 * one introduced in early 2025 that nothing has touched since.
 *
 * Deliberately does **not** read or write `scraper_cursor`. The cursor exists to
 * guarantee eventual coverage of an ordered walk, and this is not a walk — it
 * re-reads the same head of the feed every day. Advancing a cursor from here
 * would be actively harmful: a descending window's newest item is not a
 * high-water mark for anything, and writing it would strand every older bill
 * from a subsequent ascending walk. Because nothing is skipped-and-forgotten,
 * a failed bill needs no retry bookkeeping — tomorrow's run sees it again as
 * long as it is still in the window.
 *
 * The tradeoff to know about: this covers the *head* of the update feed, not
 * all of it. Between 2026-07-21 and 2026-07-28, 1,742 House bills were updated
 * upstream — roughly 250/day — so a 100-bill window sees the most recent
 * activity, not every change. Raise `count` to widen it.
 */
async function scrapeRecent(
  count: number,
  congress: number,
  chamber: "House" | "Senate",
) {
  logger.info(
    `Refreshing the ${count} most recently updated bills (congress=${congress})`,
  );

  const fetched: ApiBillListItem[] = [];
  const pageSize = 250;
  let offset = 0;

  while (fetched.length < count) {
    const pageLimit = Math.min(count - fetched.length, pageSize);
    const pageData = await congressFetch<{ bills: ApiBillListItem[] }>(
      `/bill/${congress}`,
      { sort: SORT_UPDATE_DESC, limit: pageLimit, offset },
    );
    const page = pageData.bills ?? [];
    fetched.push(...page);
    if (page.length < pageLimit) break;
    offset += page.length;
  }

  const bills = fetched.slice(0, count);
  logger.info(`Fetched ${bills.length} recently updated bill(s)`);

  if (bills.length === 0) {
    logger.success("No bills returned");
    return;
  }

  setExpectedTotal(bills.length);

  const limit = getItemLimit();
  const newItemLimiter = createNewItemLimiter();
  let failures = 0;

  await Promise.all(
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
          if (error instanceof BillTextTooLargeError) {
            logger.warn(`Skipping ${item.type}${item.number}: ${error.message}`);
            return;
          }
          failures += 1;
          logger.error(
            `Error processing bill ${item.type}${item.number}`,
            error,
          );
        }
      }),
    ),
  );

  if (failures > 0) {
    logger.warn(
      `${failures} bill(s) failed; they are re-offered by tomorrow's run while they remain in the window`,
    );
  }
  logger.success("Completed");
}

async function scrape(config: CongressScraperConfig = {}) {
  const { maxBills = 100, congress = 119, chamber = "House" } = config;

  if (config.bills?.length) {
    return scrapeTargeted(config.bills, congress);
  }

  if (config.recent) {
    return scrapeRecent(config.recent, congress, chamber);
  }

  logger.info(`Starting (congress=${congress}, chamber=${chamber})...`);

  // The cursor is the newest *source* timestamp we have actually persisted,
  // never our own write clock. `updatedAt` is set to now() on every write, so
  // using it meant asking congress.gov for "bills changed since the moment we
  // last saved something" — which silently discarded every bill a run fetched
  // but did not store, with no way to ever see it again.
  // Not chamber-scoped: the walk covers both chambers (see fetchParams below),
  // so one cursor tracks the whole congress.
  const scraperKey = `congress:${congress}`;
  const [lastScrape] = await db
    .select({ lastUpdated: ScraperCursor.sourceUpdatedAt })
    .from(ScraperCursor)
    .where(eq(ScraperCursor.scraperKey, scraperKey))
    .limit(1);

  const fetchParams: Record<string, string | number> = {
    // No `chamber` filter: `/bill/{congress}` does not support one. It was
    // passed for years and silently ignored — the same request with and
    // without it returns identical results and the same 17,897 total — so the
    // feed has always carried both chambers and `originChamber` from the
    // detail endpoint is what actually labels each row. Sending it implied a
    // filter we never had.
    //
    // Oldest-first from the cursor. Descending order only makes sense with an
    // unbounded window: bounded at `maxBills`, it hands us the newest N and
    // strands everything older, and the cursor then jumps past the strand.
    // Ascending drains monotonically — whatever we do not reach this run is
    // still the next run's first page.
    sort: SORT_UPDATE_ASC,
  };

  if (lastScrape?.lastUpdated) {
    // Congress.gov API expects ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    const fromDate = lastScrape.lastUpdated
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");
    fetchParams.fromDateTime = fromDate;
    logger.info(`Fetching bills updated since ${fromDate} (oldest first)`);
  } else {
    logger.info(
      "No source cursor yet — starting from the beginning of the congress",
    );
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
  const outcomes = await Promise.all(
    bills.map((item) =>
      limit(async (): Promise<{ ok: boolean; sourceUpdatedAt?: Date }> => {
        try {
          const { outcome, sourceUpdatedAt } = await processBill(
            congress,
            item.type.toLowerCase(),
            item.number,
            chamber,
            newItemLimiter,
          );
          return { ok: advancesCursor(outcome), sourceUpdatedAt };
        } catch (error) {
          if (error instanceof BillTextTooLargeError) {
            // A deliberate refusal, not a failure to retry: the bill will be
            // exactly as oversized next run. Let the cursor move past it so it
            // cannot wedge the walk, and rely on the log to surface it.
            logger.warn(
              `Skipping ${item.type}${item.number}: ${error.message}`,
            );
            return {
              ok: true,
              sourceUpdatedAt: item.updateDate
                ? new Date(item.updateDate)
                : undefined,
            };
          }
          logger.error(
            `Error processing bill ${item.type}${item.number}`,
            error,
          );
          return { ok: false };
        }
      }),
    ),
  );

  const { highWaterMark, held } = cursorHighWaterMark(outcomes);

  if (held > 0) {
    logger.warn(
      `${held} bill(s) failed or were deferred; holding the cursor at the last clean bill so they are retried next run`,
    );
  }

  if (highWaterMark) {
    await db
      .insert(ScraperCursor)
      .values({ scraperKey, sourceUpdatedAt: highWaterMark })
      .onConflictDoUpdate({
        target: ScraperCursor.scraperKey,
        set: { sourceUpdatedAt: highWaterMark, updatedAt: new Date() },
      });
    logger.info(`Cursor advanced to ${highWaterMark.toISOString()}`);
  } else {
    logger.warn("Cursor not advanced — no bill was durably processed");
  }

  logger.success("Completed");
}

export const congress: Scraper = {
  ...congressConfig,
  scrape: (options) =>
    scrape({
      maxBills:
        (options?.maxItems ?? Number(process.env.CONGRESS_MAX_ITEMS)) || 100,
      bills: options?.targets,
      ...(options?.recent ? { recent: options.recent } : {}),
      ...(options?.congress ? { congress: options.congress } : {}),
    }),
};
