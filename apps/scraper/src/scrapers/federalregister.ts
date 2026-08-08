import TurndownService from "turndown";

import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { countGovernmentContentTitles } from "../utils/db/helpers.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { upsertContent } from "../utils/db/operations.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import { normalizeTitle } from "../utils/normalize-title.js";
import { federalregisterConfig } from "./federalregister.config.js";

const NAME = "Federal Register";
const FR_BASE = "https://www.federalregister.gov/api/v1";
const logger = createLogger(NAME);

interface FrDocument {
  title: string;
  type: string;
  document_number: string;
  publication_date: string | undefined;
  abstract: string | null;
  html_url: string;
  body_html_url: string | null;
  subtype: string | null;
}

interface FrListResponse {
  count: number;
  total_pages: number;
  next_page_url: string | null;
  results: FrDocument[];
}

function mapSubtype(subtype: string | null): string {
  switch (subtype) {
    case "Executive Order":
      return "Executive Order";
    case "Proclamation":
      return "Proclamation";
    case "Notice":
      return "Notice";
    case "Memorandum":
      return "Memorandum";
    default:
      return "Presidential Document";
  }
}

async function fetchDocumentText(
  bodyHtmlUrl: string,
): Promise<string | undefined> {
  try {
    const res = await fetchWithRetry(bodyHtmlUrl, { timeoutMs: 30_000 });
    const html = await res.text();
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    return turndown.turndown(html).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Drops documents whitehouse.gov has already published.
 *
 * whitehouse.gov carries the same executive orders, proclamations and
 * memoranda three to five days before the Federal Register does, so by the
 * time a document reaches this feed it is usually already stored. Without this
 * every order would appear in the app twice and pay twice for enrichment.
 *
 * The skip is a *budget per title*, not a boolean, because a title does not
 * identify a document: FR 2026-14991, -14992 and -14997 share a title, a
 * signing date and a publication date. Treating a single prior row as "this
 * title is covered" would have silently dropped two real proclamations. One
 * stored row therefore excuses exactly one document; the rest are ingested.
 *
 * Ordering is newest-first from the API, so the documents skipped are the ones
 * whitehouse.gov most plausibly published.
 */
export function applyDuplicateBudget<T extends { title: string }>(
  documents: readonly T[],
  whiteHouseCounts: ReadonlyMap<string, number>,
): { kept: T[]; skipped: T[] } {
  const budget = new Map(whiteHouseCounts);
  const kept: T[] = [];
  const skipped: T[] = [];

  for (const document of documents) {
    const key = normalizeTitle(document.title);
    const remaining = budget.get(key) ?? 0;
    if (remaining > 0) {
      budget.set(key, remaining - 1);
      skipped.push(document);
    } else {
      kept.push(document);
    }
  }

  return { kept, skipped };
}

async function withoutWhiteHouseDuplicates(
  documents: readonly FrDocument[],
): Promise<FrDocument[]> {
  const titles = [
    ...new Set(documents.map((document) => normalizeTitle(document.title))),
  ];
  const counts = await countGovernmentContentTitles(titles, "whitehouse.gov");
  const { kept, skipped } = applyDuplicateBudget(documents, counts);

  if (skipped.length > 0) {
    logger.info(
      `Skipping ${skipped.length} already published by whitehouse.gov: ` +
        skipped.map((document) => document.title).join("; "),
    );
  }

  return kept;
}

async function scrape(maxDocuments = 20) {
  logger.info("Starting...");

  const fields = [
    "title",
    "type",
    "document_number",
    "publication_date",
    "abstract",
    "html_url",
    "body_html_url",
    "subtype",
  ];

  const url = new URL(`${FR_BASE}/documents.json`);
  url.searchParams.append("conditions[type][]", "PRESDOCU");
  url.searchParams.set("order", "newest");
  url.searchParams.set("per_page", String(maxDocuments));
  for (const field of fields) {
    url.searchParams.append("fields[]", field);
  }

  const res = await fetchWithRetry(url.toString(), { timeoutMs: 30_000 });
  const data = (await res.json()) as FrListResponse;
  // The Federal Register API may return its minimum page size even when a
  // smaller `per_page` value is requested. Enforce the CLI limit locally so
  // `--max-items 1` cannot accidentally process a full page of documents.
  const fetched = (data.results ?? []).slice(0, maxDocuments);

  logger.info(`Fetched ${fetched.length} presidential documents`);

  const documents = await withoutWhiteHouseDuplicates(fetched);
  setExpectedTotal(documents.length);

  const limit = getItemLimit();
  const newItemLimiter = createNewItemLimiter();
  await Promise.allSettled(
    documents.map((doc) =>
      limit(async () => {
        try {
          const fullText = doc.body_html_url
            ? await fetchDocumentText(doc.body_html_url)
            : undefined;

          const contentType = mapSubtype(doc.subtype);
          const publishedDate = doc.publication_date
            ? new Date(doc.publication_date)
            : new Date();

          await upsertContent(
            {
              type: "government_content",
              data: {
                title: doc.title,
                type: contentType,
                publishedDate,
                description: fullText ? undefined : (doc.abstract ?? undefined),
                fullText,
                url: doc.html_url,
                source: "federalregister.gov",
              },
            },
            { newItemLimiter },
          );

          logger.success(`Scraped ${contentType}: ${doc.title}`);
        } catch (error) {
          logger.error(`Error processing ${doc.document_number}`, error);
        }
      }),
    ),
  );

  logger.success("Completed");
}

export const federalregister: Scraper = {
  ...federalregisterConfig,
  scrape: (options) =>
    scrape(
      (options?.maxItems ?? Number(process.env.FEDERALREGISTER_MAX_ITEMS)) ||
        20,
    ),
};
