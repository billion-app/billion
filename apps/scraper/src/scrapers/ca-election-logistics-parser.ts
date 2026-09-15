import { createHash } from "node:crypto";
import { load } from "cheerio";

import type { ElectionGuidance } from "@acme/api/lib/voting-logistics/ca-sos-cache";
import { electionGuidanceSchema } from "@acme/api/lib/voting-logistics/ca-sos-cache";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function electionDateFromUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  if (url.origin !== "https://www.sos.ca.gov" || url.username || url.password)
    throw new Error("Expected official CA SOS source");
  const match =
    /^\/elections\/upcoming-elections\/(?:general|primary)-election-([a-z]+)-(\d{1,2})-(\d{4})\/key-dates-deadlines\/?$/.exec(
      url.pathname,
    );
  if (!match) throw new Error("Expected election-specific key-dates page");
  const month = MONTHS.indexOf(match[1]!);
  if (month < 0) throw new Error("Invalid election month");
  const date = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
  if (new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)
    throw new Error("Invalid election date");
  return date;
}
const rules: [ElectionGuidance["items"][number]["kind"], RegExp][] = [
  [
    "mailing_starts",
    /begin mailing each registered voter a vote.by.mail ballot/i,
  ],
  ["early_voting", /^Early Voting sites open$/i],
  ["drop_off", /all counties shall open ballot drop.off locations/i],
  [
    "registration",
    /^Last day to register to vote for the (?:general|primary) election/i,
  ],
  ["conditional_registration", /^Same Day Registration available/i],
  ["election_day", /^Election Day - Polls shall be open throughout the state/i],
  ["mail_return", /^Vote.By.Mail Ballots returned by mail/i],
];
/** Preserve date prose and source instructions; do not turn absent rows into rules. */
export function parseCaElectionLogistics(
  html: string,
  sourceUrl: string,
  fetchedAt = new Date(),
): ElectionGuidance {
  const electionDate = electionDateFromUrl(sourceUrl);
  const $ = load(html);
  const items: ElectionGuidance["items"] = [];
  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length !== 2) return;
    const text = cells.eq(0).text().replace(/\s+/g, " ").trim();
    const dateText = cells.eq(1).text().replace(/\s+/g, " ").trim();
    const kind = rules.find(([, pattern]) => pattern.test(text))?.[0];
    if (!kind || !dateText) return;
    const years = dateText.match(/\b20\d{2}\b/g);
    if (
      !years?.length ||
      years.some((year) => year !== electionDate.slice(0, 4))
    )
      throw new Error("Guidance year does not match election");
    if (items.some((item) => item.kind === kind))
      throw new Error(`Ambiguous duplicate ${kind} guidance`);
    const links: ElectionGuidance["items"][number]["links"] = [];
    cells
      .eq(0)
      .find("a[href]")
      .each((_, anchor) => {
        const url = new URL($(anchor).attr("href")!, sourceUrl);
        if (url.protocol === "https:" && !url.username && !url.password)
          links.push({ label: $(anchor).text().trim(), url: url.href });
      });
    items.push({ kind, text, dateText, links });
  });
  const day = items.find((item) => item.kind === "election_day");
  // The page path alone is insufficient: the published table must confirm it.
  if (
    !day ||
    new Date(`${day.dateText} 12:00:00 GMT`).toISOString().slice(0, 10) !==
      electionDate
  )
    throw new Error("Election date does not match published table");
  return electionGuidanceSchema.parse({
    electionDate,
    jurisdiction: "ocd-division/country:us/state:ca",
    sourceUrl,
    sourceName: "California Secretary of State",
    fetchedAt: fetchedAt.toISOString(),
    checksum: createHash("sha256").update(html).digest("hex"),
    coverage: "statewide_guidance_only",
    items,
  });
}
