import TurndownService from "turndown";

import type { GovernmentContentTitleMatch } from "../utils/db/helpers.js";
import type { Scraper } from "../utils/types.js";
import { getItemLimit } from "../utils/concurrency.js";
import { findGovernmentContentTitleMatches } from "../utils/db/helpers.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import {
  mergeFederalRegisterCitation,
  upsertContent,
} from "../utils/db/operations.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { createNewItemLimiter } from "../utils/new-item-limit.js";
import { normalizeTitle } from "../utils/normalize-title.js";
import { federalregisterConfig } from "./federalregister.config.js";

const NAME = "Federal Register";
const FR_BASE = "https://www.federalregister.gov/api/v1";
const logger = createLogger(NAME);

export interface FrDocument {
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
 * Pairs documents with matching whitehouse.gov rows.
 *
 * whitehouse.gov carries the same executive orders, proclamations and
 * memoranda three to five days before the Federal Register does, so by the
 * time a document reaches this feed it is usually already stored. Without this
 * every order would appear in the app twice and pay twice for enrichment.
 *
 * The match is a budget per title, not a boolean, because a title does not
 * identify a document: FR 2026-14991, -14992 and -14997 share a title, a
 * signing date and a publication date. Treating a single prior row as "this
 * title is covered" would merge two real proclamations into the same row. One
 * stored row therefore receives exactly one citation; the rest are ingested.
 *
 * Ordering is newest-first from the API, so each citation lands on the White
 * House row it most plausibly represents.
 */
export function assignWhiteHouseMatches<
  T extends { title: string; document_number?: string },
>(
  documents: readonly T[],
  whiteHouseMatches: ReadonlyMap<
    string,
    readonly GovernmentContentTitleMatch[]
  >,
): {
  unmatched: T[];
  matched: { document: T; contentId: string }[];
} {
  const available = new Map(
    [...whiteHouseMatches].map(([title, matches]) => [title, [...matches]]),
  );
  const unmatched: T[] = [];
  const matched: { document: T; contentId: string }[] = [];

  for (const document of documents) {
    const key = normalizeTitle(document.title);
    const candidates = available.get(key);
    const exactIndex = document.document_number
      ? (candidates?.findIndex(
          (candidate) =>
            candidate.federalRegisterDocumentNumber ===
            document.document_number,
        ) ?? -1)
      : -1;
    const openIndex =
      exactIndex >= 0
        ? exactIndex
        : (candidates?.findIndex(
            (candidate) => candidate.federalRegisterDocumentNumber === null,
          ) ?? -1);
    const target =
      candidates && openIndex >= 0
        ? candidates.splice(openIndex, 1)[0]
        : undefined;
    if (target) {
      matched.push({ document, contentId: target.id });
    } else {
      unmatched.push(document);
    }
  }

  return { unmatched, matched };
}

async function mergeWhiteHouseDuplicates(
  documents: readonly FrDocument[],
): Promise<FrDocument[]> {
  const titles = [
    ...new Set(documents.map((document) => normalizeTitle(document.title))),
  ];
  const whiteHouseMatches = await findGovernmentContentTitleMatches(
    titles,
    "whitehouse.gov",
  );
  const { unmatched, matched } = assignWhiteHouseMatches(
    documents,
    whiteHouseMatches,
  );

  for (const { document, contentId } of matched) {
    const merged = await mergeFederalRegisterCitation(contentId, {
      url: document.html_url,
      documentNumber: document.document_number,
      publishedDate: document.publication_date
        ? new Date(document.publication_date)
        : new Date(),
    });
    if (!merged) {
      logger.warn(
        `Could not merge Federal Register citation for ${document.title}; ingesting it separately`,
      );
      unmatched.push(document);
      continue;
    }
    logger.success(
      `Merged Federal Register citation into White House record: ${document.title}`,
    );
  }

  return unmatched;
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

  const documents = await mergeWhiteHouseDuplicates(fetched);
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
