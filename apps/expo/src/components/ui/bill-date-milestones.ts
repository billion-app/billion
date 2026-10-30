import type { BillBriefData } from "./BillBrief";

type Fact = BillBriefData["facts"][number];
const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  enero: 1,
  feb: 2,
  february: 2,
  febrero: 2,
  mar: 3,
  march: 3,
  marzo: 3,
  apr: 4,
  april: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  june: 6,
  junio: 6,
  jul: 7,
  july: 7,
  julio: 7,
  aug: 8,
  august: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  september: 9,
  septiembre: 9,
  oct: 10,
  october: 10,
  octubre: 10,
  nov: 11,
  november: 11,
  noviembre: 11,
  dec: 12,
  december: 12,
  diciembre: 12,
};

/** Only complete, unambiguous calendar dates earn chronological placement.
 * Relative deadlines and recurrence clauses stay in their original fact group.
 */
export function getBillDateValue(value: string): number | null {
  const plain = value.replaceAll("**", "").trim().toLowerCase();
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(plain);
  const chinese = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/u.exec(plain);
  const english = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/u.exec(plain);
  const dayFirst =
    /^(\d{1,2})\s+(?:de\s+)?([a-z]+)\.?\s+(?:de\s+)?(\d{4})$/u.exec(plain);
  if (iso || chinese) {
    const parts = iso ?? chinese;
    year = Number(parts?.[1]);
    month = Number(parts?.[2]);
    day = Number(parts?.[3]);
  } else if (english) {
    year = Number(english[3]);
    month = MONTHS[english[1] ?? ""] ?? 0;
    day = Number(english[2]);
  } else if (dayFirst) {
    year = Number(dayFirst[3]);
    month = MONTHS[dayFirst[2] ?? ""] ?? 0;
    day = Number(dayFirst[1]);
  } else return null;
  if (
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.getTime()
    : null;
}

export function getBillDateMilestones(facts: readonly Fact[]) {
  const dates = facts
    .flatMap((fact, index) => {
      const date = getBillDateValue(fact.value);
      return date === null ? [] : [{ fact, index, date }];
    })
    .sort((a, b) => a.date - b.date);
  return new Set(dates.map((point) => point.date)).size >= 2 ? dates : [];
}
