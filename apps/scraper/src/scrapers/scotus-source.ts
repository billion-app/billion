import * as cheerio from "cheerio";
import { extractText } from "unpdf";

import type { CourtCaseData } from "../utils/types.js";
import { fetchWithRetry } from "../utils/fetch.js";

const BASE = "https://www.supremecourt.gov";

interface PublishedOpinion {
  caseNumber: string;
  title: string;
  filedDate: Date;
  description?: string;
  pdfUrls: string[];
}

/** October terms continue through the summer, including emergency orders. */
export function termYear(now: Date): number {
  const year = now.getUTCFullYear();
  const october = new Date(Date.UTC(year, 9, 1));
  const firstMonday = new Date(
    Date.UTC(year, 9, 1 + ((8 - october.getUTCDay()) % 7)),
  );
  return now < firstMonday ? year - 1 : year;
}

export function parseOpinionIndex(
  html: string,
  indexUrl: string,
): PublishedOpinion[] {
  const $ = cheerio.load(html);
  const opinions: PublishedOpinion[] = [];
  $("table").each((_, table) => {
    const headers = $(table)
      .find("th")
      .map((_, cell) => $(cell).text().trim())
      .get();
    const dateColumn = headers.indexOf("Date");
    const docketColumn = headers.indexOf("Docket");
    const nameColumn = headers.indexOf("Name");
    if (dateColumn < 0 || docketColumn < 0 || nameColumn < 0) return;
    $(table)
      .find("tr")
      .each((_, row) => {
        const cells = $(row).children("td");
        const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(
          cells.eq(dateColumn).text().trim(),
        );
        if (!match) return;
        const month = Number(match[1]) - 1;
        const day = Number(match[2]);
        const year = 2000 + Number(match[3]);
        const filedDate = new Date(Date.UTC(year, month, day));
        if (
          filedDate.getUTCFullYear() !== year ||
          filedDate.getUTCMonth() !== month ||
          filedDate.getUTCDate() !== day
        )
          return;
        const links = cells
          .eq(nameColumn)
          .find("a[href]")
          .filter((_, link) => {
            const url = new URL($(link).attr("href")!, indexUrl);
            return (
              url.origin === BASE &&
              /^\/opinions\/\d{2}pdf\/[^/]+\.pdf$/i.test(url.pathname)
            );
          });
        const title = links.first().text().trim();
        const caseNumber = cells.eq(docketColumn).text().trim();
        if (!title || !caseNumber || !links.length) return;
        // Revision links follow the original link. Only read the current text.
        const url = new URL(links.last().attr("href")!, indexUrl).href;
        opinions.push({
          title,
          caseNumber,
          filedDate,
          description: links.first().attr("title")?.trim() || undefined,
          pdfUrls: [url],
        });
      });
  });
  return opinions;
}

interface SourceDependencies {
  fetch?: (url: string) => Promise<Response>;
  readPdf?: (bytes: Uint8Array) => Promise<string>;
}

/** Read-only discovery seam: returns the exact source input used by upsertContent. */
export async function collectScotusCases(
  maxItems: number,
  now = new Date(),
  dependencies: SourceDependencies = {},
): Promise<CourtCaseData[]> {
  if (!Number.isInteger(maxItems) || maxItems <= 0)
    throw new Error("SCOTUS maxItems must be a positive integer");
  const fetchSource =
    dependencies.fetch ??
    ((url: string) => fetchWithRetry(url, { timeoutMs: 30_000 }));
  const readPdf =
    dependencies.readPdf ??
    (async (bytes: Uint8Array) =>
      (await extractText(bytes, { mergePages: true })).text);
  const currentTerm = termYear(now);
  const opinions: PublishedOpinion[] = [];
  // The previous term supplies a recent window while a new October term is
  // still empty. No archive cursor, paid generation, or database writes here.
  for (const year of [currentTerm, currentTerm - 1]) {
    for (const kind of ["slipopinion", "relatingtoorders"]) {
      const url = `${BASE}/opinions/${kind}/${String(year).slice(-2)}`;
      const response = await fetchSource(url);
      if (!response.ok)
        throw new Error(
          `Supreme Court index returned ${response.status}: ${url}`,
        );
      const html = await response.text();
      const $ = cheerio.load(html);
      // Empty term tables are valid; a challenge/error page isn't.
      if (
        !$("th")
          .toArray()
          .some((cell) => $(cell).text().trim() === "Docket")
      )
        throw new Error(`Unrecognized Supreme Court index: ${url}`);
      opinions.push(...parseOpinionIndex(html, url));
    }
  }
  opinions.sort((a, b) => b.filedDate.getTime() - a.filedDate.getTime());
  const cases = new Map<string, PublishedOpinion>();
  for (const opinion of opinions) {
    const existing = cases.get(opinion.caseNumber);
    if (!existing)
      cases.set(opinion.caseNumber, {
        ...opinion,
        pdfUrls: [...opinion.pdfUrls],
      });
    else if (existing.filedDate.getTime() === opinion.filedDate.getTime()) {
      existing.pdfUrls = [
        ...new Set([...existing.pdfUrls, ...opinion.pdfUrls]),
      ];
    }
  }
  const data: CourtCaseData[] = [];
  for (const opinion of [...cases.values()].slice(0, maxItems)) {
    const texts: string[] = [];
    for (const url of opinion.pdfUrls) {
      const response = await fetchSource(url);
      if (!response.ok)
        throw new Error(
          `Supreme Court PDF returned ${response.status}: ${url}`,
        );
      const text = (
        await readPdf(new Uint8Array(await response.arrayBuffer()))
      ).trim();
      if (!text) throw new Error(`Empty Supreme Court PDF: ${url}`);
      texts.push(
        opinion.pdfUrls.length > 1 ? `Source: ${url}\n\n${text}` : text,
      );
    }
    data.push({
      caseNumber: opinion.caseNumber,
      title: opinion.title,
      court: "Supreme Court of the United States",
      // Browse needs the published decision date, not the lawsuit's filing date.
      filedDate: opinion.filedDate,
      description: opinion.description,
      status: "Published opinion or order",
      fullText: texts.join("\n\n"),
      url: opinion.pdfUrls[0]!,
    });
  }
  return data;
}
