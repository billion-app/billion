import { load } from "cheerio";

export const TEXAS_JURISDICTION =
  "ocd-jurisdiction/country:us/state:tx/government";

export interface TexasDocument {
  type: "bill_text" | "analysis" | "fiscal_note";
  description: string;
  htmlUrl?: string;
  pdfUrl?: string;
  ftpHtmlUrl?: string;
  ftpPdfUrl?: string;
  text?: string;
}

export interface TexasVote {
  identifier: string;
  date?: string;
  chamber?: "House" | "Senate";
  motion?: string;
  result?: string;
  sourceUrl?: string;
  counts: { option: string; value: number }[];
  votes: { option: string; voterName: string; openStatesId?: string }[];
}

export interface ParsedTexasBill {
  billNumber: string;
  title: string;
  sponsor?: string;
  status?: string;
  introducedDate?: Date;
  chamber: "House" | "Senate";
  jurisdiction: typeof TEXAS_JURISDICTION;
  legislativeSession: string;
  subjects: string[];
  sponsorships: {
    name: string;
    classification: "primary" | "cosponsor";
    chamber: "House" | "Senate";
  }[];
  documents: TexasDocument[];
  votes: TexasVote[];
  actions: { date: string; text: string; type?: string }[];
  url: string;
}

function normalizeSpace(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function parseTexasDate(value: string | undefined): string | undefined {
  const text = normalizeSpace(value);
  if (!text) return undefined;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf())
    ? undefined
    : parsed.toISOString().slice(0, 10);
}

export function normalizeTexasBillNumber(value: string): string {
  const match = /(HCR|HJR|HR|HB|SCR|SJR|SR|SB)\s*0*(\d+)/i.exec(value);
  if (!match) throw new Error(`Unrecognized Texas bill identifier: ${value}`);
  return `${match[1]!.toUpperCase()} ${Number(match[2])}`;
}

function chamberFor(identifier: string): "House" | "Senate" {
  return identifier.startsWith("H") ? "House" : "Senate";
}

function splitNames(value: string | undefined): string[] {
  return (value ?? "")
    .split("|")
    .map((name) => normalizeSpace(name))
    .filter((name): name is string => Boolean(name));
}

function firstText(
  $: ReturnType<typeof load>,
  selectors: readonly string[],
): string | undefined {
  for (const selector of selectors) {
    const value = normalizeSpace($(selector).first().text());
    if (value) return value;
  }
  return undefined;
}

function parseDocuments($: ReturnType<typeof load>): TexasDocument[] {
  const documents: TexasDocument[] = [];
  const groups = [
    ["billtext > docTypes > bill > versions > version", "bill_text"],
    ["billtext > docTypes > analysis > versions > version", "analysis"],
    ["billtext > docTypes > fiscalNote > versions > version", "fiscal_note"],
  ] as const;

  for (const [selector, type] of groups) {
    $(selector).each((_, element) => {
      const version = $(element);
      const description =
        normalizeSpace(version.find("versionDescription").first().text()) ??
        type.replace("_", " ");
      const htmlUrl = normalizeSpace(version.find("WebHTMLURL").first().text());
      const pdfUrl = normalizeSpace(version.find("WebPDFURL").first().text());
      const ftpHtmlUrl = normalizeSpace(
        version.find("FTPHTMLURL").first().text(),
      );
      const ftpPdfUrl = normalizeSpace(
        version.find("FTPPDFURL").first().text(),
      );
      if (htmlUrl || pdfUrl || ftpHtmlUrl || ftpPdfUrl) {
        documents.push({
          type,
          description,
          ...(htmlUrl && { htmlUrl }),
          ...(pdfUrl && { pdfUrl }),
          ...(ftpHtmlUrl && { ftpHtmlUrl }),
          ...(ftpPdfUrl && { ftpPdfUrl }),
        });
      }
    });
  }
  return documents;
}

function parseVotes($: ReturnType<typeof load>): TexasVote[] {
  const votes: TexasVote[] = [];
  $("votes > vote, recordVotes > vote, voteHistory > vote").each(
    (_, element) => {
      const vote = $(element);
      const text = (selectors: string[]) => {
        for (const selector of selectors) {
          const value = normalizeSpace(vote.find(selector).first().text());
          if (value) return value;
        }
        return undefined;
      };
      const identifier = text([
        "identifier",
        "voteNumber",
        "rollCallId",
        "actionNumber",
      ]);
      if (!identifier) return;
      const chamberText = text(["chamber", "organization"]);
      const chamber = chamberText
        ? chamberText.toLowerCase().startsWith("h")
          ? "House"
          : chamberText.toLowerCase().startsWith("s")
            ? "Senate"
            : undefined
        : undefined;
      const counts: TexasVote["counts"] = [];
      vote.find("counts > count, totals > total").each((__, countElement) => {
        const count = $(countElement);
        const option = normalizeSpace(
          count.attr("option") ?? count.find("option").first().text(),
        );
        const value = Number(
          normalizeSpace(
            count.attr("value") ?? count.find("value").first().text(),
          ),
        );
        if (option && Number.isInteger(value)) counts.push({ option, value });
      });
      const memberVotes: TexasVote["votes"] = [];
      vote
        .find("voters > voter, memberVotes > vote")
        .each((__, voterElement) => {
          const voter = $(voterElement);
          const voterName = normalizeSpace(
            voter.attr("name") ??
              voter.find("name, voterName, memberName").first().text(),
          );
          const option = normalizeSpace(
            voter.attr("option") ?? voter.find("option, vote").first().text(),
          );
          if (voterName && option) memberVotes.push({ voterName, option });
        });
      votes.push({
        identifier,
        ...(parseTexasDate(text(["date", "voteDate"])) && {
          date: parseTexasDate(text(["date", "voteDate"])),
        }),
        ...(chamber && { chamber }),
        ...(text(["motion", "motionText", "description"]) && {
          motion: text(["motion", "motionText", "description"]),
        }),
        ...(text(["result", "outcome"]) && {
          result: text(["result", "outcome"]),
        }),
        ...(text(["sourceUrl", "url"]) && {
          sourceUrl: text(["sourceUrl", "url"]),
        }),
        counts,
        votes: memberVotes,
      });
    },
  );
  $("actions > action").each((_, element) => {
    const action = $(element);
    if (
      normalizeSpace(action.find("description").first().text()) !==
      "Record vote"
    ) {
      return;
    }
    const identifier = normalizeSpace(action.find("comment").first().text());
    if (!identifier) return;
    const actionNumber = normalizeSpace(
      action.find("actionNumber").first().text(),
    );
    votes.push({
      identifier,
      ...(parseTexasDate(action.find("date").first().text()) && {
        date: parseTexasDate(action.find("date").first().text()),
      }),
      ...(actionNumber?.startsWith("H") && { chamber: "House" }),
      ...(actionNumber?.startsWith("S") && { chamber: "Senate" }),
      motion: "Record vote",
      counts: [],
      votes: [],
    });
  });
  $("committees > house, committees > senate").each((_, element) => {
    const committee = $(element);
    const name = normalizeSpace(committee.attr("name"));
    if (!name) return;
    const chamber =
      element.tagName.toLowerCase() === "house" ? "House" : "Senate";
    const countAttributes = [
      ["Yea", "ayeVotes"],
      ["Nay", "nayVotes"],
      ["Present not voting", "presentNotVotingVotes"],
      ["Absent", "absentVotes"],
    ] as const;
    const counts = countAttributes.flatMap(([option, attribute]) => {
      const value = Number(committee.attr(attribute));
      return Number.isInteger(value) ? [{ option, value }] : [];
    });
    if (counts.length === 0) return;
    votes.push({
      identifier: `committee:${chamber.toLowerCase()}:${name}`,
      chamber,
      motion: `${name} committee vote`,
      result: normalizeSpace(committee.attr("status")),
      counts,
      votes: [],
    });
  });
  return votes;
}

export function parseTexasBillHistory(
  xml: string,
  session: string,
): ParsedTexasBill {
  const $ = load(xml, { xml: true });
  const root = $.root().children().first();
  const rawIdentifier = root.attr("bill") ?? firstText($, ["billNumber"]);
  if (!rawIdentifier)
    throw new Error("Texas bill history is missing bill identity");
  const billNumber = normalizeTexasBillNumber(rawIdentifier);
  const title = firstText($, ["caption"]);
  if (!title || title.includes("Bill does not exist")) {
    throw new Error(`${billNumber} does not contain a usable caption`);
  }
  const chamber = chamberFor(billNumber);
  const otherChamber = chamber === "House" ? "Senate" : "House";
  const sponsorships: ParsedTexasBill["sponsorships"] = [];
  for (const [selector, classification, sponsorChamber] of [
    ["authors", "primary", chamber],
    ["coauthors", "cosponsor", chamber],
    ["sponsors", "primary", otherChamber],
    ["cosponsors", "cosponsor", otherChamber],
  ] as const) {
    for (const name of splitNames($(selector).first().text())) {
      sponsorships.push({ name, classification, chamber: sponsorChamber });
    }
  }

  const actions: ParsedTexasBill["actions"] = [];
  $("actions > action").each((_, element) => {
    const action = $(element);
    const date = parseTexasDate(action.find("date").first().text());
    const text = normalizeSpace(action.find("description").first().text());
    if (!date || !text) return;
    const actionNumber = normalizeSpace(
      action.find("actionNumber").first().text(),
    );
    actions.push({ date, text, ...(actionNumber && { type: actionNumber }) });
  });
  actions.sort((left, right) => left.date.localeCompare(right.date));

  const sponsor = sponsorships
    .filter((item) => item.classification === "primary")
    .map((item) => item.name)
    .join(" | ")
    .slice(0, 256);
  const billSlug = billNumber.replace(/\s+/g, "");
  return {
    billNumber,
    title,
    ...(sponsor && { sponsor }),
    ...(actions.at(-1)?.text && { status: actions.at(-1)!.text.slice(0, 100) }),
    ...(actions[0]?.date && {
      introducedDate: new Date(`${actions[0].date}T12:00:00.000Z`),
    }),
    chamber,
    jurisdiction: TEXAS_JURISDICTION,
    legislativeSession: session.toUpperCase(),
    subjects: $("subjects > subject")
      .map((_, element) => normalizeSpace($(element).text()))
      .get()
      .filter((value): value is string => Boolean(value)),
    sponsorships,
    documents: parseDocuments($),
    votes: parseVotes($),
    actions,
    url: `https://capitol.texas.gov/BillLookup/History.aspx?LegSess=${encodeURIComponent(session.toUpperCase())}&Bill=${billSlug}`,
  };
}

export function htmlToText(html: string): string {
  const $ = load(html);
  $("script, style, nav, header, footer").remove();
  $("br, p, div, h1, h2, h3, h4, h5, h6, li, tr").each((_, element) => {
    $(element).append(" ");
  });
  return $.root().text().replace(/\s+/g, " ").trim();
}

export function openStatesSessionName(session: string): string {
  const normalized = session.toUpperCase();
  if (/^\d{2}R$/.test(normalized)) return normalized.slice(0, 2);
  if (/^\d{3}$/.test(normalized)) return normalized;
  throw new Error(`Invalid Texas legislative session: ${session}`);
}
