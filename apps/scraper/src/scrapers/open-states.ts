/**
 * State-legislature bill ingestion via the Open States v3 API.
 *
 * Structured like the congress.gov scraper — an ascending `updated_since` walk
 * with a persisted source cursor and a retry queue — with one deliberate
 * difference: it asks the *list* endpoint for sponsorships, abstracts, actions
 * and versions in a single request rather than fetching each bill's detail
 * separately. That is a quota decision. The free Open States tier allows a few
 * hundred requests a day and a California session holds thousands of bills; at
 * one request per bill a backfill would take weeks, which is exactly why the
 * CourtListener scraper is shelved. Twenty fully-hydrated bills per request
 * keeps a whole session inside a day's budget.
 *
 * Bill *text* is fetched from the state's own site (leginfo for California),
 * not from Open States, so it does not draw on the API budget at all.
 */

import type { OpenStatesBill } from "@acme/api/clients/open-states";
import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { ScraperCursor } from "@acme/db/schema";

import type { UpsertOutcome } from "../utils/db/operations.js";
import type { NewItemLimiter } from "../utils/new-item-limit.js";
import type { Scraper } from "../utils/types.js";
import type { NormalizedStateBill } from "./open-states-normalize.js";
import { getItemLimit } from "../utils/concurrency.js";
import { advancesCursor, cursorHighWaterMark } from "../utils/cursor.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import {
  clearRetry,
  dueRetries,
  recordRetry,
  retryQueueDepth,
} from "../utils/db/retry-queue.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { latestActionDate } from "../utils/last-action.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import {
  assertWithinTsvectorLimit,
  BillTextTooLargeError,
} from "./congress.js";
import { readBulkBills } from "./open-states-bulk.js";
import {
  normalizeBill,
  normalizeIdentifier,
  UnnormalizableBillError,
} from "./open-states-normalize.js";
import { openStatesConfig } from "./open-states.config.js";

const BASE_URL = "https://v3.openstates.org";
const logger = createLogger("Open States");

/**
 * Bills per list request. The API caps `/bills` at 20 and silently clamps
 * anything larger, so asking for more only makes the page count misleading.
 */
const PAGE_SIZE = 20;

/**
 * Pause between list requests. The free tier enforces a per-minute ceiling as
 * well as a daily one, and a tight pagination loop trips it within seconds.
 * `fetchWithRetry` would recover from the resulting 429s, but spending the
 * budget on rejected requests is not recovery.
 */
const PAGE_DELAY_MS = 1_000;

const DEFAULT_STATES = ["ca"];

interface OpenStatesScraperConfig {
  maxBills?: number;
  /** Two-letter state codes to walk. */
  states?: string[];
  /** Bill identifiers to fetch directly instead of walking the cursor. */
  bills?: string[];
  /** Session identifier for targeted runs, e.g. "20252026". */
  session?: string;
  /** Unzipped bulk session-CSV export to import instead of calling the API. */
  bulkDir?: string;
}

interface BillListResponse {
  results: OpenStatesBill[];
  pagination: {
    page: number;
    max_page: number;
    per_page: number;
    total_items: number;
  };
}

function getApiKey(): string {
  const key = process.env.OPEN_STATES_API_KEY;
  if (!key) {
    throw new Error(
      "OPEN_STATES_API_KEY is not set. Get one at https://open.pluralpolicy.com/accounts/profile/",
    );
  }
  return key;
}

function jurisdictionFor(stateCode: string): string {
  const code = stateCode.toLowerCase();
  if (code === "dc")
    return "ocd-jurisdiction/country:us/district:dc/government";
  return `ocd-jurisdiction/country:us/state:${code}/government`;
}

/**
 * Open States calls go through `fetchWithRetry` rather than the shared
 * `@acme/api` client. The client throws on any non-2xx, including the 429 a
 * free-tier key sees routinely; `fetchWithRetry` carries the per-host backoff
 * and `Retry-After` handling that an unattended run needs. The request shape is
 * the same, and the response types are still the client's.
 */
type OpenStatesQueryParams = Record<
  string,
  string | number | readonly string[] | undefined
>;

export function buildOpenStatesUrl(
  path: string,
  params: OpenStatesQueryParams,
): URL {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function openStatesFetch<T>(
  path: string,
  params: OpenStatesQueryParams,
): Promise<T> {
  const url = buildOpenStatesUrl(path, params);

  const res = await fetchWithRetry(url.toString(), {
    headers: { "X-API-KEY": getApiKey(), Accept: "application/json" },
  });
  return res.json() as Promise<T>;
}

/** Everything the normalizer can use, in one request per page. */
const LIST_INCLUDES = [
  "sponsorships",
  "abstracts",
  "actions",
  "versions",
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Fetch the operative bill text from the state's own site.
 *
 * Optional by design: a bill with an abstract but no retrievable text is still
 * worth storing, and states publish text on their own schedule. Oversize is the
 * one failure that propagates — see `BillTextTooLargeError`, which exists so a
 * bill is never stored silently truncated.
 */
async function fetchFullText(
  bill: NormalizedStateBill,
): Promise<string | undefined> {
  if (!bill.textLink) return undefined;
  try {
    const res = await fetchWithRetry(bill.textLink.url);
    const raw = await res.text();
    if (!raw) return undefined;
    const text = stripHtml(raw);
    if (!text) return undefined;
    return assertWithinTsvectorLimit(text, bill.billNumber) || undefined;
  } catch (error) {
    if (error instanceof BillTextTooLargeError) throw error;
    logger.warn(
      `${bill.billNumber}: could not fetch text from ${bill.textLink.url}`,
    );
    return undefined;
  }
}

async function processBill(
  bill: OpenStatesBill,
  stateCode: string,
  newItemLimiter: NewItemLimiter,
): Promise<{ outcome: UpsertOutcome; sourceUpdatedAt?: Date }> {
  const normalized = normalizeBill(bill, { stateCode });
  const fullText = await fetchFullText(normalized);

  const outcome = await upsertContent(
    {
      type: "bill",
      data: {
        billNumber: normalized.billNumber,
        title: normalized.title,
        // As with congress.gov, the abstract is kept as source material and the
        // DB pipeline generates the compact, app-facing description.
        description: undefined,
        sponsor: normalized.sponsor,
        status: normalized.status,
        introducedDate: normalized.introducedDate,
        // `congress` is federal-only and stays null for state bills; the
        // session lives in `billNumber`, where it is part of the row's identity.
        congress: undefined,
        chamber: normalized.chamber,
        summary: normalized.summary,
        fullText,
        actions: normalized.actions,
        // The sort key for every "recent" listing. State bills share the feed
        // with federal ones, so a CA bill chaptered last week has to rank
        // against a House bill passed last week — which only works if both
        // sources fill this from the same kind of event.
        lastActionAt: latestActionDate(normalized.actions),
        url: normalized.url,
        sourceWebsite: normalized.sourceWebsite,
        sourceUpdatedAt: normalized.sourceUpdatedAt,
      },
    },
    { newItemLimiter },
  );

  if (outcome.status === "written") {
    logger.success(`Processed: ${normalized.billNumber} — ${normalized.title}`);
  } else {
    logger.info(
      `${outcome.status === "skipped" ? "Skipped" : "Deferred"}: ${normalized.billNumber} — ${outcome.reason}`,
    );
  }
  return { outcome, sourceUpdatedAt: normalized.sourceUpdatedAt };
}

/**
 * One page of the update feed, oldest-first from `updatedSince`.
 *
 * Ascending for the same reason the federal walk is: bounded at `maxBills`, a
 * descending window hands us the newest N and strands everything older, and the
 * cursor then jumps past the strand.
 */
async function fetchBillPage(args: {
  stateCode: string;
  page: number;
  updatedSince?: string;
  session?: string;
}): Promise<BillListResponse> {
  return openStatesFetch<BillListResponse>("/bills", {
    jurisdiction: jurisdictionFor(args.stateCode),
    sort: "updated_asc",
    include: LIST_INCLUDES,
    page: args.page,
    per_page: PAGE_SIZE,
    updated_since: args.updatedSince,
    session: args.session,
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Import an unzipped bulk session-CSV export.
 *
 * Deliberately does not touch the cursor. The export is a snapshot of a whole
 * session with no position in the update feed, so there is no high-water mark
 * to take from it — and writing one would strand every bill changed between the
 * export's build date and now. The incremental walk still has to sweep after a
 * backfill; the backfill just means it finds almost everything already stored
 * and unchanged, which costs nothing.
 */
async function importBulk(
  directory: string,
  stateCode: string,
  maxBills: number,
): Promise<void> {
  logger.info(`Importing bulk export from ${directory} (state=${stateCode})`);
  const bills = readBulkBills(directory).slice(0, maxBills);
  logger.info(`Read ${bills.length} bill(s) from the export`);

  if (bills.length === 0) {
    logger.success("Export contained no bills");
    return;
  }

  setExpectedTotal(bills.length);
  const limit = getItemLimit();
  const newItemLimiter = createNewItemLimiter();
  let failures = 0;
  let unnormalizable = 0;

  await Promise.all(
    bills.map((bill) =>
      limit(async () => {
        try {
          await processBill(bill, stateCode, newItemLimiter);
        } catch (error) {
          if (error instanceof UnnormalizableBillError) {
            unnormalizable += 1;
            logger.warn(`Skipping ${error.message}`);
            return;
          }
          if (error instanceof BillTextTooLargeError) {
            logger.warn(`Skipping ${error.message}`);
            return;
          }
          failures += 1;
          logger.error(`Error importing ${bill.identifier}`, error);
        }
      }),
    ),
  );

  if (unnormalizable > 0) {
    logger.warn(`${unnormalizable} bill(s) had no stable identifier or title`);
  }
  if (failures > 0) {
    logger.warn(
      `${failures} bill(s) failed; re-run the import to retry them, or let the incremental walk pick them up`,
    );
  }
  logger.success("Completed");
}

/**
 * Fetch specific bills by identifier, bypassing the cursor. The counterpart of
 * the federal scraper's `--bill`: a bill that overflowed a busy window becomes
 * unreachable once the cursor moves past it, and this is how it gets back.
 */
async function scrapeTargeted(
  identifiers: string[],
  stateCode: string,
  session: string | undefined,
): Promise<void> {
  const wanted = identifiers.map((identifier) => {
    const normalized = normalizeIdentifier(identifier);
    if (!normalized) {
      throw new Error(
        `Unrecognized bill identifier "${identifier}" (expected e.g. "SB 243" or "AB 1064")`,
      );
    }
    return normalized;
  });

  logger.info(
    `Fetching ${wanted.length} requested bill(s) from ${stateCode.toUpperCase()}${session ? ` session ${session}` : ""}...`,
  );
  setExpectedTotal(wanted.length);

  const newItemLimiter = createNewItemLimiter(wanted.length);
  const failures: { identifier: string; reason: unknown }[] = [];

  for (const identifier of wanted) {
    try {
      // `q` is the only identifier-ish filter /bills offers; match the exact
      // identifier out of the results rather than trusting the search ranking.
      const response = await openStatesFetch<BillListResponse>("/bills", {
        jurisdiction: jurisdictionFor(stateCode),
        q: identifier,
        include: LIST_INCLUDES,
        per_page: PAGE_SIZE,
        session,
      });

      const match = response.results.find(
        (bill) => normalizeIdentifier(bill.identifier) === identifier,
      );
      if (!match) {
        failures.push({ identifier, reason: "not found in Open States" });
        continue;
      }

      const { outcome } = await processBill(match, stateCode, newItemLimiter);
      if (outcome.status !== "written") {
        failures.push({
          identifier,
          reason: `${outcome.status}: ${outcome.reason}`,
        });
      }
    } catch (error) {
      failures.push({ identifier, reason: error });
    }
    await sleep(PAGE_DELAY_MS);
  }

  // A targeted run has no later run to retry it — fail loudly so the caller
  // knows the bill still is not in the database.
  for (const { identifier, reason } of failures) {
    logger.error(`Error processing ${identifier}`, reason);
  }
  if (failures.length > 0) {
    throw new Error(
      `Failed to process ${failures.length} of ${wanted.length} requested bill(s)`,
    );
  }
  logger.success("Completed");
}

/** The incremental walk for one state. */
async function scrapeState(stateCode: string, maxBills: number): Promise<void> {
  const scraperKey = `open-states:${stateCode.toLowerCase()}`;
  const [lastScrape] = await db
    .select({ lastUpdated: ScraperCursor.sourceUpdatedAt })
    .from(ScraperCursor)
    .where(eq(ScraperCursor.scraperKey, scraperKey))
    .limit(1);

  // The API takes `updated_since` as a date, so the cursor is coarser than the
  // timestamp we store. Re-offering the cursor's own day is the safe direction
  // to round: an unchanged bill hashes identically and costs a no-op upsert,
  // whereas rounding forward would drop everything updated later that day.
  const updatedSince = lastScrape?.lastUpdated
    ?.toISOString()
    .slice(0, "YYYY-MM-DD".length);

  logger.info(
    updatedSince
      ? `${stateCode.toUpperCase()}: fetching bills updated since ${updatedSince} (oldest first)`
      : `${stateCode.toUpperCase()}: no source cursor yet — starting from the beginning of the feed`,
  );

  const bills: OpenStatesBill[] = [];
  let page = 1;
  let maxPage = 1;

  while (bills.length < maxBills && page <= maxPage) {
    const response = await fetchBillPage({ stateCode, page, updatedSince });
    bills.push(...(response.results ?? []));
    maxPage = response.pagination?.max_page ?? 1;
    if (page === 1) {
      logger.info(
        `${stateCode.toUpperCase()}: ${response.pagination?.total_items ?? 0} bill(s) match the window across ${maxPage} page(s)`,
      );
    }
    if ((response.results ?? []).length === 0) break;
    page += 1;
    if (bills.length < maxBills && page <= maxPage) await sleep(PAGE_DELAY_MS);
  }

  const window = bills.slice(0, maxBills);
  logger.info(`${stateCode.toUpperCase()}: fetched ${window.length} bill(s)`);

  // Retries drain after the feed, and are capped, for the same reason as the
  // federal walk: a backed-up queue must not push this week's legislation
  // behind last month's problem cases.
  const retryBudget = Math.max(5, Math.floor(maxBills / 4));
  const retries = await dueRetries(scraperKey, retryBudget);
  if (retries.length > 0) {
    logger.info(
      `Retry queue: ${await retryQueueDepth(scraperKey)} outstanding, ${retries.length} due this run`,
    );
  }

  if (window.length === 0 && retries.length === 0) {
    logger.success(
      `${stateCode.toUpperCase()}: no new or updated bills since last scrape`,
    );
    return;
  }

  setExpectedTotal(window.length + retries.length);
  const limit = getItemLimit();
  const newItemLimiter = createNewItemLimiter();

  /**
   * Run one bill and translate its result into a cursor decision. An item we
   * could not finish goes to the retry queue and is then reported `ok`, because
   * the queue — not the cursor — is what remembers it from that point. Failing
   * to *record* the retry is the one case that still holds the cursor.
   */
  const runBill = async (
    bill: OpenStatesBill,
  ): Promise<{ ok: boolean; sourceUpdatedAt?: Date }> => {
    const itemKey = bill.id;
    const feedUpdatedAt = bill.updated_at
      ? new Date(bill.updated_at)
      : undefined;

    const queue = async (reason: string) => {
      try {
        await recordRetry(scraperKey, itemKey, reason);
        return { ok: true, sourceUpdatedAt: feedUpdatedAt };
      } catch (error) {
        logger.error(`Could not queue ${itemKey} for retry`, error);
        return { ok: false };
      }
    };

    try {
      const { outcome, sourceUpdatedAt } = await processBill(
        bill,
        stateCode,
        newItemLimiter,
      );
      if (advancesCursor(outcome)) {
        await clearRetry(scraperKey, itemKey);
        return { ok: true, sourceUpdatedAt };
      }
      return queue(outcome.reason);
    } catch (error) {
      // Both of these are deliberate refusals rather than failures to retry:
      // the bill will be exactly as unnormalizable or as oversized next run, so
      // queueing it would burn an attempt a day forever.
      if (
        error instanceof UnnormalizableBillError ||
        error instanceof BillTextTooLargeError
      ) {
        logger.warn(`Skipping ${error.message}`);
        await clearRetry(scraperKey, itemKey);
        return { ok: true, sourceUpdatedAt: feedUpdatedAt };
      }
      logger.error(`Error processing ${bill.identifier}`, error);
      return queue(error instanceof Error ? error.message : String(error));
    }
  };

  const outcomes = await Promise.all(
    window.map((bill) => limit(() => runBill(bill))),
  );

  const { highWaterMark, held } = cursorHighWaterMark(outcomes);
  if (held > 0) {
    logger.warn(
      `${held} bill(s) could not even be queued; holding the cursor so the page is re-offered next run`,
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
  } else if (window.length > 0) {
    logger.warn("Cursor not advanced — no bill was durably processed");
  }

  // Retries run after the cursor is written and never feed into it: these bills
  // sit behind the cursor by definition, so their timestamps could only drag it
  // backwards.
  if (retries.length > 0) {
    await Promise.all(
      retries.map(({ itemKey }) =>
        limit(async () => {
          try {
            const response = await openStatesFetch<OpenStatesBill>(
              `/bills/${encodeURIComponent(itemKey)}`,
              { include: LIST_INCLUDES },
            );
            const { outcome } = await processBill(
              response,
              stateCode,
              newItemLimiter,
            );
            if (advancesCursor(outcome)) {
              await clearRetry(scraperKey, itemKey);
            } else {
              await recordRetry(scraperKey, itemKey, outcome.reason);
            }
          } catch (error) {
            if (
              error instanceof UnnormalizableBillError ||
              error instanceof BillTextTooLargeError
            ) {
              logger.warn(`Skipping ${itemKey}: ${error.message}`);
              await clearRetry(scraperKey, itemKey);
              return;
            }
            logger.error(`Retry failed for ${itemKey}`, error);
            await recordRetry(
              scraperKey,
              itemKey,
              error instanceof Error ? error.message : String(error),
            );
          }
        }),
      ),
    );
    logger.info(
      `Retry queue: ${await retryQueueDepth(scraperKey)} still outstanding`,
    );
  }

  logger.success(`${stateCode.toUpperCase()}: completed`);
}

export function parseStates(value: string | undefined): string[] | undefined {
  const states = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return states.length > 0 ? states : undefined;
}

async function scrape(config: OpenStatesScraperConfig = {}): Promise<void> {
  const {
    maxBills = 100,
    states = parseStates(process.env.OPEN_STATES_STATES) ?? DEFAULT_STATES,
  } = config;

  if (config.bulkDir) {
    // A bulk export is a single state's session by construction.
    return importBulk(config.bulkDir, states[0] ?? "ca", maxBills);
  }

  if (config.bills?.length) {
    return scrapeTargeted(config.bills, states[0] ?? "ca", config.session);
  }

  logger.info(`Starting (states=${states.join(", ")})...`);

  // States walk sequentially, each with its own cursor. Running them
  // concurrently would multiply the request rate against a shared per-minute
  // quota, and there is one state today.
  for (const stateCode of states) {
    // The per-run limit is per state, matching how `--max-items` reads for
    // every other scraper: a cap on what this run will take on from a source.
    await scrapeState(stateCode, maxBills);
  }
}

export const openStates: Scraper = {
  ...openStatesConfig,
  scrape: (options) =>
    scrape({
      maxBills:
        (options?.maxItems ?? Number(process.env.OPEN_STATES_MAX_ITEMS)) || 100,
      bills: options?.targets,
      ...(options?.session ? { session: options.session } : {}),
      ...(options?.bulkDir ? { bulkDir: options.bulkDir } : {}),
    }),
};
