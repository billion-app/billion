import { load } from "cheerio";

export const MISSOURI_JURISDICTION =
  "ocd-jurisdiction/country:us/state:mo/government";

export interface MissouriSession {
  code: string;
  baseUrl: string;
  kind: "regular" | "special";
}

export interface MissouriBillListEntry {
  billNumber: string;
  url: string;
  sourceVersion: string;
  sourceUpdatedAt?: Date;
}

export type MissouriDocument = {
  type: "bill_text" | "analysis" | "fiscal_note";
  description: string;
  pdfUrl?: string;
};

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function variable(script: string, name: string): string | undefined {
  return new RegExp(`\\bvar\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`, "i").exec(
    script,
  )?.[1];
}

export function parseMissouriSessions(script: string): MissouriSession[] {
  const code = variable(script, "sessionyearcode");
  const baseUrl = variable(script, "baseURL");
  if (!code || !baseUrl) {
    throw new Error("SessionSet.js is missing the active regular session");
  }
  const sessions: MissouriSession[] = [{ code, baseUrl, kind: "regular" }];
  if (variable(script, "showSpec")?.toLowerCase() !== "true") return sessions;
  for (const [codeName, urlName] of [
    ["specsessionyearcode", "specbaseURL"],
    ["specsession2yearcode", "specbaseURL2"],
  ] as const) {
    const specialCode = variable(script, codeName);
    const specialUrl = variable(script, urlName);
    if (specialCode && specialUrl && specialCode !== code) {
      sessions.push({
        code: specialCode,
        baseUrl: specialUrl,
        kind: "special",
      });
    }
  }
  return sessions;
}

export function normalizeMissouriBillNumber(value: string): string {
  const match = /^(HCR|HJR|HR|HB|SCR|SJR|SR|SB)\s*0*(\d+)$/i.exec(
    value.replace(/\s+/g, ""),
  );
  if (!match)
    throw new Error(`Unrecognized Missouri bill identifier: ${value}`);
  return `${match[1]!.toUpperCase()} ${Number(match[2])}`;
}

export function parseMissouriTimestamp(value: string): Date | undefined {
  const match =
    /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(
      value.trim(),
    );
  if (!match) return undefined;
  const [, month, day, year, hour, minute, second, millis = "0"] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millis.padEnd(3, "0")),
  );
  const guess = new Date(wallClockUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const chicagoAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
    Number(millis.padEnd(3, "0")),
  );
  return new Date(wallClockUtc - (chicagoAsUtc - guess.valueOf()));
}

export function parseMissouriBillList(xml: string): MissouriBillListEntry[] {
  const $ = load(xml, { xml: true });
  return $("BillXML")
    .map((_, element) => {
      const row = $(element);
      const type = clean(row.find("BillType").first().text());
      const number = clean(row.find("BillNumber").first().text());
      const url = clean(row.find("BillXMLLink").first().text());
      const sourceVersion = clean(row.find("LastTimeRun").first().text());
      if (!type || !number || !url || !sourceVersion) return undefined;
      return {
        billNumber: normalizeMissouriBillNumber(`${type}${number}`),
        url,
        sourceVersion,
        ...(parseMissouriTimestamp(sourceVersion) && {
          sourceUpdatedAt: parseMissouriTimestamp(sourceVersion),
        }),
      };
    })
    .get()
    .filter((entry): entry is MissouriBillListEntry => Boolean(entry))
    .sort((left, right) => left.billNumber.localeCompare(right.billNumber));
}

function isoDate(value: string | undefined): string | undefined {
  const text = clean(value);
  if (!text) return undefined;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (match) {
    return `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf())
    ? undefined
    : parsed.toISOString().slice(0, 10);
}

function documents($: ReturnType<typeof load>): MissouriDocument[] {
  const result: MissouriDocument[] = [];
  const add = (
    type: MissouriDocument["type"],
    description: string,
    url?: string,
  ) => {
    const pdfUrl = clean(url);
    if (pdfUrl)
      result.push({ type, description: clean(description) ?? type, pdfUrl });
  };
  $("BillText").each((_, element) => {
    const row = $(element);
    add(
      "bill_text",
      row.find("DocumentName").first().text(),
      row.find("BillTextLink").first().text(),
    );
  });
  $("BillSummary").each((_, element) => {
    const row = $(element);
    add(
      "analysis",
      `Bill summary — ${row.find("DocumentName").first().text()}`,
      row.find("SummaryTextLink").first().text(),
    );
  });
  $("FiscalNote").each((index, element) =>
    add(
      "fiscal_note",
      `Fiscal note ${index + 1}`,
      $(element).find("FiscalNoteLink").first().text(),
    ),
  );
  $("Amendment").each((_, element) => {
    const row = $(element);
    add(
      "analysis",
      `Amendment — ${row.find("AmendmentDescription").first().text()}`,
      row.find("AmendmentText").first().text(),
    );
  });
  add("analysis", "Summary sheet", $("SummarySheetLink").first().text());
  add(
    "analysis",
    "Governor veto letter",
    $("GovernorsVetoLetter").first().text(),
  );
  $("Witness").each((index, element) =>
    add(
      "analysis",
      `Witness forms — ${
        clean($(element).find("WitnessFormsLinkDescription").first().text()) ??
        index + 1
      }`,
      $(element).find("WitnessFormsLink").first().text(),
    ),
  );
  return result;
}

export function parseMissouriBill(
  xml: string,
  options: {
    session: string;
    sourceVersion: string;
    sourceUpdatedAt?: Date;
    coverage: "complete_house_export" | "senate_with_house_actions_only";
  },
) {
  const $ = load(xml, { xml: true });
  const root = $("BillInformation").first();
  const billNumber = normalizeMissouriBillNumber(
    root.find("BillNumber").first().text(),
  );
  const chamber = billNumber.startsWith("H")
    ? ("House" as const)
    : ("Senate" as const);
  const title =
    clean(root.find("Title > LongTitle").first().text()) ??
    clean(root.children("LongTitle").first().text()) ??
    clean(root.find("Title > ShortTitle").first().text()) ??
    clean(root.children("ShortTitle").first().text());
  if (!title) throw new Error(`${billNumber} is missing a title`);
  const shortTitle =
    clean(root.find("Title > ShortTitle").first().text()) ??
    clean(root.children("ShortTitle").first().text());

  const sponsorships: {
    name: string;
    classification: "primary" | "cosponsor";
    chamber: "House" | "Senate";
  }[] = [];
  root.children("Sponsor").each((_, element) => {
    const row = $(element);
    const name = clean(row.find("FullName").first().text());
    if (!name) return;
    sponsorships.push({
      name,
      classification: /co/i.test(row.find("SponsorType").first().text())
        ? "cosponsor"
        : "primary",
      chamber,
    });
  });
  const senateSponsor = clean(root.children("SponsorName").first().text());
  if (senateSponsor)
    sponsorships.push({
      name: senateSponsor,
      classification: "primary",
      chamber: "Senate",
    });

  const actions: { date: string; text: string; type?: string }[] = [];
  const votes: {
    identifier: string;
    date?: string;
    chamber?: "House" | "Senate";
    motion?: string;
    counts: { option: string; value: number }[];
    votes: never[];
  }[] = [];
  root.children("Action").each((_, element) => {
    const row = $(element);
    const date = isoDate(row.find("PubDate").first().text());
    const text = clean(row.find("Description").first().text());
    if (!date || !text) return;
    const guid = clean(row.find("Guid").first().text());
    actions.push({ date, text, ...(guid && { type: `guid:${guid}` }) });
    const rollCall = row.find("RollCall").first();
    if (rollCall.length) {
      const count = (selector: string) =>
        Number(clean(rollCall.find(selector).first().text()));
      const counts = [
        ["Yes", count("TotalYes")],
        ["No", count("TotalNo")],
        ["Present", count("TotalPresent")],
      ] as const;
      votes.push({
        identifier: guid ?? `${date}:${text}`,
        date,
        chamber: /\(S\)/.test(text) ? "Senate" : "House",
        motion: text,
        counts: counts
          .filter((entry) => Number.isInteger(entry[1]))
          .map(([option, value]) => ({ option, value })),
        votes: [],
      });
    }
  });
  const effectiveDateText = isoDate(
    root.find("ProposedEffectiveDate").first().text(),
  );
  const sponsor = sponsorships
    .filter((item) => item.classification === "primary")
    .map((item) => item.name)
    .join(" | ")
    .slice(0, 256);
  root.find("Hearings").each((_, element) => {
    const hearing = $(element);
    const name = clean(hearing.find("CommitteeName, CommName").first().text());
    const date =
      isoDate(hearing.find("NoticeDate").first().text()) ?? actions[0]?.date;
    if (name && date) {
      actions.push({
        date,
        text: `Committee hearing: ${name}`,
        type: "committee",
      });
    }
  });
  if (effectiveDateText) {
    actions.push({
      date: effectiveDateText,
      text: "Proposed effective date",
      type: "effective_date",
    });
  }
  actions.sort((left, right) => left.date.localeCompare(right.date));
  const url =
    clean(root.children("Action").first().find("Link").first().text()) ??
    `https://house.mo.gov/bill.aspx?bill=${billNumber.replace(/\s+/g, "")}&year=20${options.session.slice(0, 2)}&code=${options.session.slice(2) === "1" ? "R" : `S${options.session.slice(2)}`}`;
  return {
    billNumber,
    title,
    ...(shortTitle && { description: shortTitle }),
    ...(sponsor && { sponsor }),
    ...(clean(root.find("LastAction").first().text()) && {
      status: clean(root.find("LastAction").first().text())!.slice(0, 100),
    }),
    ...(actions[0]?.date && {
      introducedDate: new Date(`${actions[0].date}T12:00:00Z`),
    }),
    chamber,
    jurisdiction: MISSOURI_JURISDICTION,
    legislativeSession: options.session,
    subjects: root
      .find("SubjectIndex > SubjectName")
      .map((_, element) => clean($(element).text()))
      .get()
      .filter(Boolean) as string[],
    sponsorships,
    documents: documents($),
    votes,
    actions,
    versions: [
      {
        hash: options.sourceVersion,
        updatedAt:
          options.sourceUpdatedAt?.toISOString() ??
          `${actions.at(-1)?.date ?? "1970-01-01"}T00:00:00.000Z`,
        changes: options.coverage,
      },
    ],
    url,
  };
}

export function missouriCommitteesFromActions(
  actions: readonly { text: string; type?: string }[],
): string[] {
  return [
    ...new Set(
      actions.flatMap((action) => {
        if (action.type === "committee") {
          const name = clean(
            action.text.replace(/^Committee hearing:\s*/i, ""),
          );
          return name ? [name] : [];
        }
        const match =
          /(?:Re-referred to Committee|Referred):\s*(.+?)(?:\([HS]\))?$/i.exec(
            action.text,
          );
        const name = clean(match?.[1]);
        return name ? [name] : [];
      }),
    ),
  ];
}

export function missouriEffectiveDateFromActions(
  actions: readonly { date: string; type?: string }[],
): string | undefined {
  return actions.find((action) => action.type === "effective_date")?.date;
}

export function parseMissouriSenateActionList(
  xml: string,
  session: string,
  sourceVersion: string,
  sourceUpdatedAt?: Date,
) {
  const $ = load(xml, { xml: true });
  return $("SenateBillsWithHouseActions > BillInformation")
    .map((_, element) =>
      parseMissouriBill($.xml(element), {
        session,
        sourceVersion,
        ...(sourceUpdatedAt && { sourceUpdatedAt }),
        coverage: "senate_with_house_actions_only",
      }),
    )
    .get()
    .filter((bill) => bill.chamber === "Senate");
}
