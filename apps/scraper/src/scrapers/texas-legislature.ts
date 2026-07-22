import type { BillData, Scraper } from "../utils/types.js";
import type { TexasBulkClient } from "./texas-legislature-source.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import { createLogger } from "../utils/log.js";
import {
  htmlToText,
  openStatesSessionName,
  parseTexasBillHistory,
  TEXAS_JURISDICTION,
} from "./texas-legislature-parser.js";
import {
  bulkHtmlPath,
  listFilesRecursively,
  selectCurrentTexasSession,
  TexasFtpClient,
} from "./texas-legislature-source.js";
import { texasLegislatureConfig } from "./texas-legislature.config.js";

const logger = createLogger("texas-legislature");

interface OpenStatesSearchResponse {
  results?: { id: string; identifier: string; session: string }[];
}

export async function matchOpenStatesBillId(
  session: string,
  billNumber: string,
  apiKey = process.env.OPEN_STATES_API_KEY,
): Promise<string | undefined> {
  if (!apiKey) return undefined;
  const url = new URL("https://v3.openstates.org/bills");
  url.searchParams.set("jurisdiction", TEXAS_JURISDICTION);
  url.searchParams.set("session", openStatesSessionName(session));
  url.searchParams.set("q", billNumber);
  url.searchParams.set("per_page", "5");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-API-KEY": apiKey },
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as OpenStatesSearchResponse;
  return payload.results?.find(
    (bill) =>
      bill.identifier.replace(/\s+/g, "").toUpperCase() ===
        billNumber.replace(/\s+/g, "").toUpperCase() &&
      bill.session === openStatesSessionName(session),
  )?.id;
}

async function enrichDocuments(
  client: TexasBulkClient,
  session: string,
  documents: ReturnType<typeof parseTexasBillHistory>["documents"],
) {
  return Promise.all(
    documents.map(async (document) => {
      const path = bulkHtmlPath(session, document);
      if (!path) return document;
      try {
        const html = (await client.download(path)).toString("utf8");
        const text = htmlToText(html);
        return text ? { ...document, text } : document;
      } catch (error) {
        logger.debug(
          `Optional bulk HTML unavailable at ${path}: ${error instanceof Error ? error.message : error}`,
        );
        return document;
      }
    }),
  );
}

export async function scrapeTexasLegislature(
  client: TexasBulkClient,
  options: { maxItems: number; session?: string },
): Promise<void> {
  const availableSessions = (await client.list("/bills"))
    .filter((entry) => entry.isDirectory)
    .map((entry) => entry.name);
  const currentSession = selectCurrentTexasSession(availableSessions);
  const session = options.session?.toUpperCase() ?? currentSession;
  if (session !== currentSession) {
    throw new Error(
      `Texas ingestion is current-session only: requested ${session}, latest bulk session is ${currentSession}`,
    );
  }

  logger.info(`Reading official Texas bulk data for ${session}...`);
  const paths = (
    await listFilesRecursively(client, `/bills/${session}/billhistory`)
  )
    .filter(
      (path) =>
        path.toLowerCase().endsWith(".xml") &&
        !/\/history(?:_periodic)?\.xml$/i.test(path),
    )
    .sort()
    .slice(0, options.maxItems);
  setExpectedTotal(paths.length);
  let persisted = 0;

  for (const path of paths) {
    try {
      const parsed = parseTexasBillHistory(
        (await client.download(path)).toString("utf8"),
        session,
      );
      const documents = await enrichDocuments(
        client,
        session,
        parsed.documents,
      );
      const latestBillText = documents
        .filter((document) => document.type === "bill_text" && document.text)
        .at(-1)?.text;
      let openStatesId: string | undefined;
      try {
        openStatesId = await matchOpenStatesBillId(session, parsed.billNumber);
      } catch (error) {
        logger.debug(
          `Open States identity match skipped for ${parsed.billNumber}: ${error instanceof Error ? error.message : error}`,
        );
      }
      const data: BillData = {
        ...parsed,
        documents,
        ...(latestBillText && { fullText: latestBillText }),
        ...(openStatesId && { openStatesId }),
        sourceWebsite: "capitol.texas.gov",
      };
      await upsertContent({ type: "bill", data }, { skipEnrichment: true });
      persisted += 1;
    } catch (error) {
      logger.error(
        `Failed to process ${path}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  logger.success(
    `Persisted ${persisted}/${paths.length} Texas bills from ${session}.`,
  );
}

async function scrape(options?: { maxItems?: number }): Promise<void> {
  const client = new TexasFtpClient();
  try {
    await client.connect();
    await scrapeTexasLegislature(client, {
      maxItems:
        options?.maxItems ??
        (Number(process.env.TEXAS_LEGISLATURE_MAX_ITEMS) || 100),
      ...(process.env.TEXAS_LEGISLATURE_SESSION && {
        session: process.env.TEXAS_LEGISLATURE_SESSION,
      }),
    });
  } finally {
    client.close();
  }
}

export const texasLegislature: Scraper = {
  ...texasLegislatureConfig,
  scrape,
};
