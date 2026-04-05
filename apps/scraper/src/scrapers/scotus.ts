import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { getItemLimit } from "../utils/concurrency.js";
import { upsertContent } from "../utils/db/operations.js";
import { setExpectedTotal } from "../utils/db/metrics.js";
import type { Scraper } from "../utils/types.js";

const CL_BASE = "https://www.courtlistener.com/api/rest/v4";
const NAME = "SCOTUS";

interface ScotusScraperConfig {
  maxCases?: number;
  court?: string;
}

interface ClCluster {
  id: number;
  absolute_url: string;
  case_name: string;
  docket_id: number;
  date_filed: string | null;
  precedential_status: string;
  syllabus: string;
  sub_opinions: string[];
}

interface ClOpinion {
  id: number;
  plain_text: string;
  html: string;
  type: string;
}

interface ClDocket {
  id: number;
  docket_number: string;
  court: string;
  date_filed: string | null;
  case_name: string;
}

const COURT_NAMES: Record<string, string> = {
  scotus: "Supreme Court of the United States",
  ca1: "1st Circuit Court of Appeals",
  ca2: "2nd Circuit Court of Appeals",
  ca3: "3rd Circuit Court of Appeals",
  ca4: "4th Circuit Court of Appeals",
  ca5: "5th Circuit Court of Appeals",
  ca6: "6th Circuit Court of Appeals",
  ca7: "7th Circuit Court of Appeals",
  ca8: "8th Circuit Court of Appeals",
  ca9: "9th Circuit Court of Appeals",
  ca10: "10th Circuit Court of Appeals",
  ca11: "11th Circuit Court of Appeals",
  cadc: "D.C. Circuit Court of Appeals",
};

function clHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "billion-scraper/1.0 (contact via github)",
  };
  if (process.env.COURTLISTENER_API_KEY) {
    headers["Authorization"] = `Token ${process.env.COURTLISTENER_API_KEY}`;
  }
  return headers;
}

async function clFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${CL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetchWithRetry(url.toString(), {
    headers: clHeaders(),
  });
  return res.json() as Promise<T>;
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

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(" ") : text;
}

async function fetchOpinionText(
  subOpinionUrls: string[],
): Promise<string | undefined> {
  const fetched: { opinion: ClOpinion; text: string }[] = [];

  for (const url of subOpinionUrls) {
    try {
      const res = await fetchWithRetry(url, { headers: clHeaders() });
      const opinion = (await res.json()) as ClOpinion;
      const text = (
        opinion.plain_text?.trim() || stripHtml(opinion.html ?? "")
      ).trim();
      if (text.length > 0) {
        fetched.push({ opinion, text });
      }
    } catch {
      // Skip failed sub-opinions
    }
  }

  if (fetched.length === 0) return undefined;

  const preferredTypes = new Set(["010combined", "020lead"]);
  fetched.sort((a, b) => {
    const aPref = preferredTypes.has(a.opinion.type) ? 0 : 1;
    const bPref = preferredTypes.has(b.opinion.type) ? 0 : 1;
    return aPref - bPref;
  });

  for (const { text } of fetched) {
    if (text.length > 200) {
      return truncateWords(text, 1000);
    }
  }
  return undefined;
}

async function scrape(config: ScotusScraperConfig = {}) {
  const { maxCases = 50, court = "scotus" } = config;

  const displayName = court === "scotus" ? "SCOTUS" : court.toUpperCase();
  const logger = createLogger(displayName);
  logger.info(`Starting (court=${court}, maxCases=${maxCases})...`);

  const allClusters: ClCluster[] = [];
  let page = 1;
  const pageSize = 100;

  while (allClusters.length < maxCases) {
    const pageData = await clFetch<{
      results: ClCluster[];
      next: string | null;
    }>("/clusters/", {
      docket__court: court,
      order_by: "-date_filed",
      page_size: pageSize,
      page,
    });

    const results = pageData.results ?? [];
    allClusters.push(...results);
    if (!pageData.next || results.length < pageSize) break;
    page++;
  }

  const clusters = allClusters.slice(0, maxCases);
  logger.info(`Fetched ${clusters.length} opinion clusters`);
  setExpectedTotal(clusters.length);

  const limit = getItemLimit();
  await Promise.allSettled(
    clusters.map((cluster) =>
      limit(async () => {
        try {
          const docket = await clFetch<ClDocket>(
            `/dockets/${cluster.docket_id}/`,
          );
          const docketNumber = docket.docket_number || `CL-${cluster.id}`;
          const filedDate = docket.date_filed
            ? new Date(docket.date_filed)
            : undefined;
          const courtCode = docket.court ?? court;
          const courtName = COURT_NAMES[courtCode] ?? courtCode.toUpperCase();

          const title = cluster.case_name?.slice(0, 250) || "Unknown Case";
          const status = cluster.precedential_status || "Unknown";
          const caseUrl = `https://www.courtlistener.com${cluster.absolute_url}`;

          const fullText = await fetchOpinionText(cluster.sub_opinions ?? []);

          const description = cluster.syllabus
            ? stripHtml(cluster.syllabus).slice(0, 1000) || undefined
            : undefined;

          await upsertContent({
            type: "court_case",
            data: {
              caseNumber: docketNumber,
              title,
              court: courtName,
              filedDate,
              description,
              status,
              fullText,
              url: caseUrl,
            },
          });

          logger.success(`Processed: ${docketNumber} — ${title}`);
        } catch (error) {
          logger.error(`Error processing cluster ${cluster.id}`, error);
        }
      }),
    ),
  );

  logger.success("Completed");
}

export const scotus: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};
