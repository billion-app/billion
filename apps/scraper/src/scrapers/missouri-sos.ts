/** Current-cycle-only Missouri SOS candidates, measures, and results. */

import { createHash } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";

import type {
  MissouriResults,
  MissouriSnapshotData,
} from "@acme/api/lib/missouri-election-data";
import {
  MISSOURI_CURRENT_SCOPE,
  MISSOURI_CYCLE_YEAR,
  MISSOURI_SOS_PROVIDER,
} from "@acme/api/lib/missouri-election-data";
import { db } from "@acme/db/client";
import { ElectionSourceSnapshot } from "@acme/db/schema";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import {
  discoverMissouriResultsUrl,
  MISSOURI_CALENDAR_URL,
  MISSOURI_CANDIDATES_URL,
  MISSOURI_MEASURES_URL,
  MISSOURI_RESULTS_URL,
  MISSOURI_STRUCTURE_VERSION,
  parseMissouriBallotMeasures,
  parseMissouriCalendar,
  parseMissouriCandidateDiscovery,
  parseMissouriCandidateOffice,
  parseMissouriResults,
  parseMissouriWithdrawals,
} from "./missouri-sos-parsers.js";
import { missouriSosConfig } from "./missouri-sos.config.js";

const logger = createLogger("missouri-sos");
const USER_AGENT =
  "Mozilla/5.0 (compatible; BillionCivicBot/1.0; +https://billion.app)";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchOfficialHtml(url: string): Promise<string> {
  const response = await fetchWithRetry(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
    timeoutMs: 45_000,
  });
  return response.text();
}

async function upsertSnapshot(
  data: MissouriSnapshotData,
  diagnostics: string[],
  sourceUrls: string[],
  sourceVersion: string,
): Promise<void> {
  const canonicalData = JSON.stringify(data);
  const contentHash = sha256(canonicalData);
  const now = new Date();
  await db
    .insert(ElectionSourceSnapshot)
    .values({
      jurisdiction: "MO",
      cycleYear: MISSOURI_CYCLE_YEAR,
      provider: MISSOURI_SOS_PROVIDER,
      scope: MISSOURI_CURRENT_SCOPE,
      sourceVersion,
      contentHash,
      data: data as unknown as Record<string, unknown>,
      diagnostics,
      sourceUrls,
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        ElectionSourceSnapshot.jurisdiction,
        ElectionSourceSnapshot.cycleYear,
        ElectionSourceSnapshot.provider,
        ElectionSourceSnapshot.scope,
      ],
      set: {
        sourceVersion,
        contentHash,
        data: data as unknown as Record<string, unknown>,
        diagnostics,
        sourceUrls,
        fetchedAt: now,
      },
    });

  // This invariant prevents any stale scope introduced outside this scraper
  // from being mistaken for the supported current-cycle reader.
  await db
    .delete(ElectionSourceSnapshot)
    .where(
      and(
        eq(ElectionSourceSnapshot.jurisdiction, "MO"),
        eq(ElectionSourceSnapshot.provider, MISSOURI_SOS_PROVIDER),
        eq(ElectionSourceSnapshot.scope, MISSOURI_CURRENT_SCOPE),
        ne(ElectionSourceSnapshot.cycleYear, MISSOURI_CYCLE_YEAR),
      ),
    );
}

export async function scrapeMissouriSos(maxItems = 1000): Promise<void> {
  logger.info("Discovering official 2026 Missouri election sources…");
  const limit = getItemLimit();
  const [calendarHtml, candidateIndexHtml, measuresHtml, resultsEntryHtml] =
    await Promise.all([
      limit(() => fetchOfficialHtml(MISSOURI_CALENDAR_URL)),
      limit(() => fetchOfficialHtml(MISSOURI_CANDIDATES_URL)),
      limit(() => fetchOfficialHtml(MISSOURI_MEASURES_URL)),
      limit(() => fetchOfficialHtml(MISSOURI_RESULTS_URL)),
    ]);

  const discovery = parseMissouriCandidateDiscovery(candidateIndexHtml);
  const candidateElectionType = /general/i.test(discovery.electionName)
    ? "general"
    : /primary/i.test(discovery.electionName)
      ? "primary"
      : undefined;
  const activeElection = parseMissouriCalendar(
    calendarHtml,
    new Date(),
    MISSOURI_CALENDAR_URL,
    candidateElectionType,
  );
  if (!new RegExp(activeElection.type, "i").test(discovery.electionName)) {
    throw new Error(
      `Candidate system exposes ${discovery.electionName}, not active ${activeElection.name}`,
    );
  }

  // The official cumulative endpoint contains every office and party in ballot
  // order. It avoids a high-volume crawl of the individual office links.
  const [candidateHtml, withdrawalHtml] = await Promise.all([
    limit(() => fetchOfficialHtml(discovery.candidatesUrl)),
    limit(() => fetchOfficialHtml(discovery.withdrawalsUrl)),
  ]);
  const allCandidates = [
    ...parseMissouriCandidateOffice(candidateHtml, discovery.candidatesUrl),
    ...parseMissouriWithdrawals(withdrawalHtml, discovery.withdrawalsUrl),
  ];
  const candidates = allCandidates.slice(0, maxItems);
  const ballotMeasures = parseMissouriBallotMeasures(measuresHtml);
  const diagnostics: string[] = [];
  if (candidates.length < allCandidates.length) {
    diagnostics.push(
      `MISSOURI_SOS_MAX_ITEMS limited candidates to ${candidates.length} of ${allCandidates.length}`,
    );
  }
  if (!ballotMeasures.length) {
    throw new Error("Certified 2026 ballot-measure page contained no measures");
  }

  const resultUrl = discoverMissouriResultsUrl(
    resultsEntryHtml,
    activeElection,
  );
  let results: MissouriResults;
  if (!resultUrl) {
    const diagnostic = `Official ${activeElection.name} results are not yet available from ShowMO Votes`;
    diagnostics.push(diagnostic);
    results = {
      availability: "unavailable",
      diagnostic,
      citation: {
        label: "ShowMO Votes results entry point",
        sourceUrl: MISSOURI_RESULTS_URL,
      },
    };
    logger.info(diagnostic);
  } else {
    try {
      const resultHtml = await limit(() => fetchOfficialHtml(resultUrl));
      const parsed = parseMissouriResults(resultHtml, resultUrl);
      results = {
        availability: "available",
        electionDate: activeElection.electionDate,
        ...parsed,
        citation: {
          label: "Official Missouri SOS election results",
          sourceUrl: resultUrl,
        },
      };
    } catch (error) {
      const diagnostic = `Official results link was discovered but results are not parseable yet: ${
        error instanceof Error ? error.message : String(error)
      }`;
      diagnostics.push(diagnostic);
      results = {
        availability: "unavailable",
        diagnostic,
        citation: {
          label: "ShowMO Votes results entry point",
          sourceUrl: MISSOURI_RESULTS_URL,
        },
      };
      logger.warn(diagnostic);
    }
  }

  const sourceUrls = [
    MISSOURI_CANDIDATES_URL,
    discovery.candidatesUrl,
    discovery.withdrawalsUrl,
    MISSOURI_MEASURES_URL,
    MISSOURI_RESULTS_URL,
    MISSOURI_CALENDAR_URL,
    ...(resultUrl ? [resultUrl] : []),
  ];
  const data: MissouriSnapshotData = {
    cycleYear: MISSOURI_CYCLE_YEAR,
    activeElection,
    candidates,
    ballotMeasures,
    results,
    citations: sourceUrls.map((sourceUrl) => ({
      label: "Missouri Secretary of State official source",
      sourceUrl,
    })),
  };
  const sourceVersion = `${MISSOURI_STRUCTURE_VERSION}:${sha256(
    JSON.stringify(data),
  ).slice(0, 24)}`;
  await upsertSnapshot(
    data,
    diagnostics,
    [...new Set(sourceUrls)],
    sourceVersion,
  );
  logger.success(
    `Missouri SOS: persisted ${candidates.length} candidates, ${ballotMeasures.length} measures, and ${
      results.availability === "available"
        ? `${results.contests.length} result contests`
        : "an unavailable-results diagnostic"
    }.`,
  );
}

export const missouriSos: Scraper = {
  ...missouriSosConfig,
  scrape: (options) =>
    scrapeMissouriSos(
      (options?.maxItems ?? Number(process.env.MISSOURI_SOS_MAX_ITEMS)) || 1000,
    ),
};
