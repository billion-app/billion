import { load } from "cheerio";

import type { OfficialGuidePayload } from "@acme/api/lib/official-guide-cache";
import { CA_OFFICIAL_GUIDE_SOURCE } from "@acme/api/lib/official-guide-cache";

export const GUIDE_BASE = "https://voterguide.sos.ca.gov";
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
/** The guide banner identifies the election; sidebar deadlines do not. */
export function guideElectionDate(html: string): string | null {
  const $ = load(html);
  const match =
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/.exec(
      $("#txtBnr").text(),
    );
  if (!match) return null;
  const month =
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ].indexOf(match[1]!) + 1;
  const value = `${match[3]}-${String(month).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    ? value
    : null;
}
export function guideLinks(
  html: string,
  kind: "measures" | "candidates",
): string[] {
  const $ = load(html);
  const paths = new Set<string>();
  $("a[href]").each((_, element) => {
    const url = new URL($(element).attr("href")!, GUIDE_BASE);
    if (url.origin !== GUIDE_BASE) return;
    if (
      kind === "measures"
        ? /^\/propositions\/\d+[a-z]?\/(?:index.htm)?$/i.test(url.pathname)
        : /^\/candidates\/(?:governor|lt-governor|sos|controller|treasurer|attorney-general|insurance-commissioner|superintendent)-candidate-statements.htm$/.test(
            url.pathname,
          )
    )
      paths.add(url.origin + url.pathname.replace(/index\.htm$/, ""));
  });
  return [...paths];
}
export function parseGuideMeasure(
  html: string,
  sourceUrl: string,
  electionDate: string,
): OfficialGuidePayload["measures"][number] | null {
  if (guideElectionDate(html) !== electionDate) return null;
  const $ = load(html);
  const number = clean($("#propNum").text()).toUpperCase();
  if (
    !/^\d+[A-Z]?$/.test(number) ||
    !new URL(sourceUrl).pathname.match(
      new RegExp(`/propositions/${number}/`, "i"),
    )
  )
    return null;
  const title = clean($(".propName h2").text());
  const summary = clean($(".summaryHeadings").parent().next("p").text());
  if (!title || !summary) return null;
  const fiscalMatch =
    /Fiscal Impact\s*:\s*([\s\S]*?)(?=Supporters\s*:|Opponents\s*:|$)/i.exec(
      summary,
    );
  const officialSummary = summary
    .split(/Fiscal Impact\s*:|Supporters\s*:|Opponents\s*:/i)[0]
    ?.trim();
  const getArgument = (label: string) => {
    const marker = $(".yesNoProCon")
      .filter((_, el) => clean($(el).text()) === label)
      .first();
    const paragraph = marker.parent().clone();
    paragraph.find(".yesNoProCon").remove();
    const text = clean(paragraph.text());
    return text
      ? [{ text, sourceName: CA_OFFICIAL_GUIDE_SOURCE, sourceUrl }]
      : undefined;
  };
  let fullTextUrl: string | undefined;
  $("a[href]").each((_, el) => {
    if (!/text of proposed law/i.test($(el).text())) return;
    const url = new URL($(el).attr("href")!, sourceUrl);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname === "vig.cdn.sos.ca.gov" &&
      url.pathname.startsWith(
        `/${electionDate.slice(0, 4)}/${/general election/i.test($("#txtBnr").text()) ? "general" : "primary"}/`,
      )
    )
      fullTextUrl = url.href;
  });
  return {
    number,
    title,
    sourceUrl,
    officialSummary,
    fiscalImpact: fiscalMatch?.[1]?.trim(),
    proArguments: getArgument("PRO"),
    conArguments: getArgument("CON"),
    fullTextUrl,
  };
}
export function parseGuideCandidates(
  html: string,
  sourceUrl: string,
  electionDate: string,
): OfficialGuidePayload["candidates"] {
  if (guideElectionDate(html) !== electionDate) return [];
  const officeSlug = /\/([^/]+)-candidate-statements.htm$/.exec(sourceUrl)?.[1];
  if (
    !officeSlug ||
    ![
      "governor",
      "lt-governor",
      "sos",
      "controller",
      "treasurer",
      "attorney-general",
      "insurance-commissioner",
      "superintendent",
    ].includes(officeSlug)
  )
    return [];
  const $ = load(html);
  const candidates: OfficialGuidePayload["candidates"] = [];
  $("section[role=main] h2").each((_, el) => {
    const name = clean($(el).text()).split("|")[0]?.trim();
    if (!name || !$(el).text().includes("|")) return;
    // Candidate prose is contained in the heading's own column, not the next candidate or footer.
    const paragraphs = $(el)
      .nextUntil("h2")
      .filter("p")
      .toArray()
      .map((p) => clean($(p).text()));
    const statement = paragraphs
      .filter(
        (p) =>
          !/^(?:No candidate statement\.?|Tel(?:ephone)?\s*:|E-?mail\s*:)/i.test(
            p,
          ) && !/\b(?:Tel:|E-mail:|Email:)\s*/i.test(p),
      )
      .join("\n\n");
    if (statement.length < 40 || statement.length > 30_000) return;
    candidates.push({
      name,
      officeSlug:
        officeSlug as OfficialGuidePayload["candidates"][number]["officeSlug"],
      statement,
      sourceUrl,
    });
  });
  return candidates;
}
