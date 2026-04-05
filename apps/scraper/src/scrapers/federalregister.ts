import TurndownService from "turndown";

import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { upsertContent } from "../utils/db/operations.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import { getItemLimit } from "../utils/concurrency.js";
import type { Scraper } from "../utils/types.js";

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
    case "Executive Order": return "Executive Order";
    case "Proclamation": return "Proclamation";
    case "Notice": return "Notice";
    case "Memorandum": return "Memorandum";
    default: return "Presidential Document";
  }
}

async function fetchDocumentText(bodyHtmlUrl: string): Promise<string | undefined> {
  try {
    const res = await fetchWithRetry(bodyHtmlUrl, { timeoutMs: 30_000 });
    const html = await res.text();
    const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    return turndown.turndown(html).trim() || undefined;
  } catch {
    return undefined;
  }
}

async function scrape() {
  logger.info("Starting...");

  const maxDocuments = 20;
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
  const documents = data.results ?? [];

  logger.info(`Fetched ${documents.length} presidential documents`);
  setExpectedTotal(documents.length);

  const limit = getItemLimit();
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

          await upsertContent({
            type: "government_content",
            data: {
              title: doc.title,
              type: contentType,
              publishedDate,
              description: doc.abstract ?? undefined,
              fullText,
              url: doc.html_url,
              source: "federalregister.gov",
            },
          });

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
  name: NAME,
  scrape,
};
