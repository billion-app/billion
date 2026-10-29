export const SOS_ELECTION_DATE = "2026-11-03";
export const SOS_POLL_CLOSE = Date.parse("2026-11-04T04:00:00Z");
export const SOS_RESULTS_VERSION = "2026-11-03-general-v2";
export const SOS_MEDIA = "https://media.sos.ca.gov/media";

export function parseSosReportingTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match =
    /^(\w+) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) ([ap])\.m\.$/i.exec(
      value.trim(),
    );
  if (!match) return null;
  const [, month, day, year, hour, minute, period] = match;
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
  const monthIndex = months.findIndex(
    (name) => name.toLowerCase() === month?.toLowerCase(),
  );
  const h = Number(hour);
  const m = Number(minute);
  if (monthIndex < 0 || h < 1 || h > 12 || m > 59) return null;
  const utc = Date.UTC(
    Number(year),
    monthIndex,
    Number(day),
    (h % 12) + (period?.toLowerCase() === "p" ? 12 : 0),
    m,
  );
  for (const offset of [7, 8]) {
    const timestamp = utc + offset * 3600_000;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(timestamp);
    const part = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    if (
      part("year") === Number(year) &&
      part("month") === monthIndex + 1 &&
      part("day") === Number(day) &&
      part("hour") === new Date(utc).getUTCHours() &&
      part("minute") === m
    )
      return timestamp;
  }
  return null;
}

export function freshSosReport(value: unknown, now: number): boolean {
  const timestamp = parseSosReportingTime(value);
  return timestamp !== null && timestamp >= SOS_POLL_CLOSE && timestamp <= now;
}

export async function verifySosElection(
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<boolean> {
  if (now < SOS_POLL_CLOSE) return false;
  const response = await fetcher(`${SOS_MEDIA}/json-endpoints.csv`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return false;
  const heading = (await response.text())
    .split(/\r?\n/)[0]
    ?.replace(/^"|"$/g, "");
  return (
    heading ===
    "This file lists all available JSON endpoints for the California November 3, 2026 Statewide General Election"
  );
}

export function sosVoteCount(value: unknown): number | null {
  if (typeof value !== "string" || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))
    return null;
  const count = Number(value.replaceAll(",", ""));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}
