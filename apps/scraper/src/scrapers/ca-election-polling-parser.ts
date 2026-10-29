import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";

import type {
  CaliforniaPollingReport,
  PollingObservation,
} from "@acme/api/lib/california-polling";
import { californiaPollingReportSchema } from "@acme/api/lib/california-polling";

export interface PollPdfItem {
  str: string;
  x: number;
  y: number;
}
export interface PollPdfPage {
  number: number;
  items: PollPdfItem[];
}
export interface PollReportSource {
  reportId: string;
  sourceUrl: string;
  publishedAt: string | null;
  expectedObservationCount?: number;
}
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const months = [
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
];
const isoDate = (month: string, day: string, year: string) => {
  const index = months.findIndex(
    (value) => value.toLowerCase() === month.toLowerCase(),
  );
  if (index < 0) throw new Error(`Unknown polling month ${month}`);
  return `${year}-${String(index + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
};

export function parsePpicPages(
  pages: PollPdfPage[],
  source: PollReportSource,
  sourceHash: string,
  retrievedAt: Date,
): CaliforniaPollingReport {
  const sourceText = pages
    .map((page) => {
      const lines = new Map<number, PollPdfItem[]>();
      for (const item of page.items) {
        const y = Math.round(item.y * 10) / 10;
        const row = lines.get(y) ?? [];
        row.push(item);
        lines.set(y, row);
      }
      return [...lines]
        .sort(([a], [b]) => b - a)
        .map(([, row]) =>
          row
            .sort((a, b) => a.x - b.x)
            .map((item) => item.str)
            .join(" "),
        )
        .join("\n");
    })
    .join("\n\f\n");
  const methodologyText = clean(
    pages[0]?.items.map((item) => item.str).join(" ") ?? "",
  );
  if (
    !/Full Crosstabs.{0,3}Likely Voters Only/i.test(methodologyText) ||
    !/Ipsos KnowledgePanel/.test(methodologyText)
  )
    throw new Error("Unsupported PPIC likely-voter report");
  const field = /from ([A-Za-z]+) (\d{1,2})\s*[—–-]\s*(\d{1,2}), (\d{4})/.exec(
    methodologyText,
  );
  const sample = /subgroup of ([\d,]+) likely voters/i.exec(methodologyText);
  const moe =
    /is ±\s*([\d.]+) percent at the (\d+) percent confidence level/.exec(
      methodologyText,
    );
  if (
    !field?.[1] ||
    !field[2] ||
    !field[3] ||
    !field[4] ||
    !sample?.[1] ||
    !moe?.[1] ||
    !moe[2]
  )
    throw new Error("PPIC methodology metadata missing");
  const onlinePanel = /conducted online using the ([^.]+)\./.exec(
    methodologyText,
  )?.[1];
  const interviewLanguages =
    /Interviews were conducted in (.+?) according/.exec(methodologyText)?.[1];
  const observations: PollingObservation[] = [];
  for (const page of pages.slice(1)) {
    const header = page.items.find((item) => item.str === "Likely voters");
    if (!header) continue;
    const nextHeader = Math.max(
      0,
      ...page.items
        .filter(
          (item) =>
            item.y < header.y && /^(Dem-Rep Seat|Education)$/.test(item.str),
        )
        .map((item) => item.y),
    );
    const table = page.items.filter(
      (item) => item.y < header.y && item.y > nextHeader,
    );
    const questionItems = table
      .filter((item) => item.x < header.x / 2)
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const questionText = clean(questionItems.map((item) => item.str).join(" "));
    const question = /^Q(\d+)\./.exec(questionText);
    if (!question?.[1]) continue;
    const isGovernor = /^Q\d+\. If the November 3rd election for governor/.test(
      questionText,
    );
    const proposition =
      /Proposition (\d+) is called [“"](.+?)(?:[”"]| If the election)/.exec(
        questionText,
      );
    if (!proposition && /Proposition \d+ is/.test(questionText))
      throw new Error(`Unsupported PPIC proposition wording Q${question[1]}`);
    if (!isGovernor && !proposition) continue;
    if (
      !/If (?:the November 3rd election for governor were being held today|the election were held today)/i.test(
        questionText,
      )
    )
      throw new Error(`Unsupported PPIC election wording Q${question[1]}`);
    const values = table.filter(
      (item) =>
        item.x >= header.x &&
        item.x < header.x + 45 &&
        /^\d+(?:\.\d+)?%?$/.test(item.str),
    );
    const labels = table
      .filter((item) => item.x >= header.x / 2 && item.x < header.x)
      .sort((a, b) => b.y - a.y);
    const unweighted = labels.find((item) => item.str === "Unweighted n");
    const sampleValue =
      unweighted &&
      values.filter(
        (item) =>
          !item.str.endsWith("%") && Math.abs(item.y - unweighted.y) < 1,
      );
    if (!sampleValue || sampleValue.length !== 1)
      throw new Error(`Question sample missing Q${question[1]}`);
    const choices = values
      .filter((item) => item.str.endsWith("%"))
      .sort((a, b) => b.y - a.y)
      .map((value) => {
        const surrounding = labels.filter(
          (item) =>
            item.str !== "Unweighted n" &&
            values
              .filter((entry) => entry.str.endsWith("%"))
              .every(
                (entry) =>
                  Math.abs(item.y - value.y) <= Math.abs(item.y - entry.y),
              ),
        );
        const raw = clean(surrounding.map((item) => item.str).join(" "));
        const candidate = /^(.+?), a (?:Democrat|Republican)/.exec(raw)?.[1];
        const kind = candidate
          ? ("candidate" as const)
          : /^yes$/i.test(raw)
            ? ("yes" as const)
            : /^no$/i.test(raw)
              ? ("no" as const)
              : /know/.test(raw)
                ? ("undecided" as const)
                : /neither/.test(raw)
                  ? ("other" as const)
                  : null;
        if (!kind)
          throw new Error(
            `Unrecognized PPIC response label Q${question[1]} ${raw}`,
          );
        return {
          kind,
          label: raw,
          ...(candidate ? { candidateName: candidate } : {}),
          share: Number(value.str.slice(0, -1)),
        };
      });
    if (
      choices.length !== (isGovernor ? 4 : 3) ||
      new Set(choices.map((choice) => choice.label)).size !== choices.length
    )
      throw new Error(`Incomplete PPIC choices Q${question[1]}`);
    if (
      observations.some(
        (observation) => observation.questionId === `Q${question[1]}`,
      )
    )
      throw new Error(`Duplicate statewide PPIC question Q${question[1]}`);
    const candidateNames = choices.flatMap((choice) =>
      choice.candidateName ? [choice.candidateName] : [],
    );
    observations.push({
      questionId: `Q${question[1]}`,
      locator: `PDF page ${page.number}, Q${question[1]}, Likely voters column`,
      questionText,
      contest: isGovernor
        ? { type: "candidate", officeSlug: "governor", candidateNames }
        : {
            type: "measure",
            number: proposition![1]!,
            officialTitle: proposition![2]!,
          },
      population: "California statewide likely voters",
      sampleSize: Number(sampleValue[0]!.str),
      choices,
    });
  }
  if (
    !observations.length ||
    !observations.some(
      (item) =>
        item.contest.type === "candidate" &&
        item.contest.officeSlug === "governor",
    )
  )
    throw new Error("No supported November governor polling found");
  if (
    source.expectedObservationCount !== undefined &&
    observations.length !== source.expectedObservationCount
  )
    throw new Error(
      `Expected ${source.expectedObservationCount} PPIC observations, parsed ${observations.length}`,
    );
  const year = field[4];
  const electionDate = `${year}-11-03`;
  if (year !== "2026") throw new Error("Unsupported PPIC election cycle");
  const result = californiaPollingReportSchema.parse({
    electionDate,
    electionType: "general",
    jurisdiction: "CA",
    publisher: "PPIC",
    pollster: "Public Policy Institute of California / Ipsos",
    sponsor: null,
    ...source,
    sourceHash,
    retrievedAt: retrievedAt.toISOString(),
    publishedAt: source.publishedAt,
    fieldStart: isoDate(field[1], field[2], year),
    fieldEnd: isoDate(field[1], field[3], year),
    sampleSize: Number(sample[1].replaceAll(",", "")),
    marginOfError: Number(moe[1]),
    marginOfErrorScope: `${moe[2]}% confidence, full unweighted likely-voter sample, includes weighting design effects; subgroup sampling error is larger`,
    methodology:
      onlinePanel && interviewLanguages
        ? `Online ${onlinePanel} survey in ${interviewLanguages}.`
        : null,
    sourceText,
    observations,
  });
  const today = retrievedAt.toISOString().slice(0, 10);
  if (
    result.fieldEnd > today ||
    (result.publishedAt && result.publishedAt > today)
  )
    throw new Error("PPIC report dates are in the future");
  return result;
}

export async function readPpicPdfPages(
  bytes: Uint8Array,
): Promise<PollPdfPage[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: PollPdfPage[] = [];
  try {
    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push({
        number,
        items: content.items.flatMap((item) =>
          "str" in item && item.str.trim()
            ? [
                {
                  str: clean(item.str),
                  x: item.transform[4]!,
                  y: item.transform[5]!,
                },
              ]
            : [],
        ),
      });
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
}
export async function parsePpicPdf(
  bytes: Uint8Array,
  source: PollReportSource,
  retrievedAt = new Date(),
): Promise<CaliforniaPollingReport> {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return parsePpicPages(
    await readPpicPdfPages(bytes),
    source,
    hash,
    retrievedAt,
  );
}
