import pLimit from "p-limit";

import { and, eq, inArray, lte, notInArray } from "@acme/db";
import { db } from "@acme/db/client";
import { Bill, CivicApiCache } from "@acme/db/schema";

import type { BillData, Scraper } from "../utils/types.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createContentHash } from "../utils/hash.js";
import { createLogger } from "../utils/log.js";
import {
  MISSOURI_JURISDICTION,
  parseMissouriBill,
  parseMissouriBillList,
  parseMissouriSenateActionList,
  parseMissouriSessions,
} from "./missouri-legislature-parser.js";
import { missouriRefreshExpiresAt } from "./missouri-legislature-source.js";
import { missouriLegislatureConfig } from "./missouri-legislature.config.js";

const logger = createLogger("missouri-legislature");
const SESSION_DESCRIPTOR = "https://documents.house.mo.gov/SessionSet.js";
const SOURCE_WEBSITE = "documents.house.mo.gov";
const REFRESH_SOURCE = "missouri-house-xml";
const REFRESH_ADDRESS_HASH = createContentHash(REFRESH_SOURCE);
const REFRESH_PARAMS = "{}";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const FETCH_CONCURRENCY = 2;

async function claimRefresh(now = new Date()): Promise<boolean> {
  const expiresAt = missouriRefreshExpiresAt(now, REFRESH_INTERVAL_MS);
  const rows = await db
    .insert(CivicApiCache)
    .values({
      addressHash: REFRESH_ADDRESS_HASH,
      endpoint: REFRESH_SOURCE,
      params: REFRESH_PARAMS,
      responseData: { source: REFRESH_SOURCE },
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        CivicApiCache.addressHash,
        CivicApiCache.endpoint,
        CivicApiCache.params,
      ],
      set: { fetchedAt: now, expiresAt },
      setWhere: lte(CivicApiCache.expiresAt, now),
    })
    .returning({ id: CivicApiCache.id });
  return rows.length > 0;
}

async function text(url: string): Promise<string> {
  return (await fetchWithRetry(url, { timeoutMs: 30_000 })).text();
}

function openStatesSession(session: string): string {
  const year = `20${session.slice(0, 2)}`;
  const suffix = Number(session.slice(2));
  return suffix <= 1 ? year : `${year}S${suffix - 2}`;
}

interface OpenStatesSearchResponse {
  results?: { id: string; identifier: string; session: string }[];
}

export async function matchMissouriOpenStatesBillId(
  session: string,
  billNumber: string,
  apiKey = process.env.OPEN_STATES_API_KEY,
): Promise<string | undefined> {
  if (!apiKey) return undefined;
  const url = new URL("https://v3.openstates.org/bills");
  url.searchParams.set("jurisdiction", MISSOURI_JURISDICTION);
  url.searchParams.set("session", openStatesSession(session));
  url.searchParams.set("q", billNumber);
  url.searchParams.set("per_page", "5");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-API-KEY": apiKey },
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as OpenStatesSearchResponse;
  return payload.results?.find(
    (bill) =>
      bill.session === openStatesSession(session) &&
      bill.identifier.replace(/\s+/g, "").toUpperCase() ===
        billNumber.replace(/\s+/g, "").toUpperCase(),
  )?.id;
}

async function persistBill(data: BillData): Promise<void> {
  if (!data.legislativeSession) {
    throw new Error(`${data.billNumber} is missing its Missouri session`);
  }
  let openStatesId: string | undefined;
  try {
    openStatesId = await matchMissouriOpenStatesBillId(
      data.legislativeSession,
      data.billNumber,
    );
  } catch (error) {
    logger.debug(
      `Optional Open States match skipped for ${data.billNumber}: ${error instanceof Error ? error.message : error}`,
    );
  }
  await upsertContent(
    {
      type: "bill",
      data: {
        ...data,
        ...(openStatesId && { openStatesId }),
        sourceWebsite: SOURCE_WEBSITE,
      },
    },
    { skipEnrichment: true },
  );
}

function withVersionHistory(
  bill: ReturnType<typeof parseMissouriBill>,
  histories: Map<string, NonNullable<BillData["versions"]>>,
): BillData {
  const key = `${bill.legislativeSession}:${bill.billNumber}`;
  const previous = histories.get(key) ?? [];
  const current = bill.versions[0]!;
  const versions =
    previous.at(-1)?.hash === current.hash
      ? previous
      : [...previous, current].slice(-50);
  histories.set(key, versions);
  return { ...bill, versions, sourceWebsite: SOURCE_WEBSITE };
}

export async function scrapeMissouriLegislature(options: {
  maxItems: number;
  now?: Date;
}): Promise<void> {
  const refreshNow = options.now ?? new Date();
  if (!(await claimRefresh(refreshNow))) {
    logger.info(
      "Skipping Missouri XML refresh: the official 30-minute polling interval has not elapsed.",
    );
    return;
  }

  const descriptor = await text(SESSION_DESCRIPTOR);
  const sessions = parseMissouriSessions(descriptor);
  const activeSessionCodes = sessions.map((session) => session.code);
  await db
    .delete(Bill)
    .where(
      and(
        eq(Bill.jurisdiction, MISSOURI_JURISDICTION),
        eq(Bill.sourceWebsite, SOURCE_WEBSITE),
        notInArray(Bill.legislativeSession, activeSessionCodes),
      ),
    );
  const existing = await db
    .select({
      billNumber: Bill.billNumber,
      session: Bill.legislativeSession,
      versions: Bill.versions,
    })
    .from(Bill)
    .where(
      and(
        eq(Bill.jurisdiction, MISSOURI_JURISDICTION),
        eq(Bill.sourceWebsite, SOURCE_WEBSITE),
        inArray(Bill.legislativeSession, activeSessionCodes),
      ),
    );
  const versionHistories = new Map(
    existing.map((row) => [
      `${row.session}:${row.billNumber}`,
      row.versions ?? [],
    ]),
  );
  const currentVersion = (key: string) =>
    versionHistories.get(key)?.at(-1)?.hash;
  const limit = pLimit(FETCH_CONCURRENCY);
  const pending: BillData[] = [];

  for (const [sessionIndex, session] of sessions.entries()) {
    const sessionBudget =
      Math.floor(options.maxItems / sessions.length) +
      (sessionIndex < options.maxItems % sessions.length ? 1 : 0);
    const sessionEnd = pending.length + sessionBudget;
    const billListXml = await text(`${session.baseUrl}BillList.XML`);
    const changed = parseMissouriBillList(billListXml)
      .filter(
        (entry) =>
          currentVersion(`${session.code}:${entry.billNumber}`) !==
          entry.sourceVersion,
      )
      .sort((left, right) => {
        const leftMissing = !versionHistories.has(
          `${session.code}:${left.billNumber}`,
        );
        const rightMissing = !versionHistories.has(
          `${session.code}:${right.billNumber}`,
        );
        return Number(rightMissing) - Number(leftMissing);
      });
    const senateReserve = Math.min(
      sessionBudget,
      Math.max(1, Math.floor(sessionBudget * 0.2)),
    );
    const remaining = Math.max(0, sessionEnd - pending.length - senateReserve);
    const houseBills = await Promise.all(
      changed.slice(0, remaining).map((entry) =>
        limit(async () =>
          parseMissouriBill(await text(entry.url), {
            session: session.code,
            sourceVersion: entry.sourceVersion,
            ...(entry.sourceUpdatedAt && {
              sourceUpdatedAt: entry.sourceUpdatedAt,
            }),
            coverage: "complete_house_export",
          }),
        ),
      ),
    );
    pending.push(
      ...houseBills.map((bill) => withVersionHistory(bill, versionHistories)),
    );

    if (pending.length < sessionEnd) {
      const senateXml = await text(`${session.baseUrl}SenateActList.XML`);
      const senateVersion = `sha256:${createContentHash(senateXml)}`;
      const senateBills = parseMissouriSenateActionList(
        senateXml,
        session.code,
        senateVersion,
        refreshNow,
      )
        .filter(
          (bill) =>
            currentVersion(`${session.code}:${bill.billNumber}`) !==
            senateVersion,
        )
        .sort((left, right) => {
          const leftMissing = !versionHistories.has(
            `${session.code}:${left.billNumber}`,
          );
          const rightMissing = !versionHistories.has(
            `${session.code}:${right.billNumber}`,
          );
          return Number(rightMissing) - Number(leftMissing);
        });
      pending.push(
        ...senateBills
          .slice(0, sessionEnd - pending.length)
          .map((bill) => withVersionHistory(bill, versionHistories)),
      );
    }
  }

  setExpectedTotal(pending.length);
  for (const bill of pending) await persistBill(bill);
  logger.success(
    `Persisted ${pending.length} changed Missouri bills across active session(s) ${activeSessionCodes.join(", ")}. Senate rows include House actions only.`,
  );
}

async function scrape(options?: { maxItems?: number }): Promise<void> {
  await scrapeMissouriLegislature({
    maxItems:
      options?.maxItems ??
      (Number(process.env.MISSOURI_LEGISLATURE_MAX_ITEMS) || 100),
  });
}

export const missouriLegislature: Scraper = {
  ...missouriLegislatureConfig,
  scrape,
};
