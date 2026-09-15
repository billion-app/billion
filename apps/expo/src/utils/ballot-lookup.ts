import type { Contest, Election, VoterInfoResponse } from "@acme/api";

import { webUrl as ballotWebUrl } from "./web-url";

export { ballotWebUrl };

/** Preserve provider fields until the shared Civic response type includes them. */
export type BallotResponse = Omit<
  VoterInfoResponse,
  "election" | "normalizedInput"
> & {
  election?: Election;
  normalizedInput?: Partial<VoterInfoResponse["normalizedInput"]>;
  otherElections?: Election[];
};

export function ballotElectionOptions(
  discovery: BallotResponse | undefined,
  selected?: BallotResponse,
): Election[] {
  const options = [
    discovery?.election,
    ...(discovery?.otherElections ?? []),
    selected?.election,
    ...(selected?.otherElections ?? []),
  ];
  return [
    ...new Map(options.filter((e) => !!e).map((e) => [e.id, e])).values(),
  ];
}

export function ballotModel(response: BallotResponse) {
  // Absence of contests is not evidence that an election has not published them.
  const contests = response.contests ?? [];
  const state = response.normalizedInput?.state?.trim().toLowerCase();
  return {
    election: response.election,
    contests,
    isCalifornia: state === "ca" || state === "california",
    empty: contests.length === 0,
  };
}

/** Mirror the route's bounded input contract without claiming to validate residence. */
export function validateBallotAddress(address: string): boolean {
  const trimmed = address.trim();
  return (
    trimmed.length >= 5 &&
    trimmed.length <= 300 &&
    [...trimmed].every(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
  );
}

export function contestBallotCitations(contest: Contest) {
  const citations = [...(contest.citations ?? [])];
  for (const source of contest.sources ?? []) {
    if (
      !citations.some(
        (citation) =>
          citation.sourceName === source.name &&
          citation.sourceUrl === source.url,
      )
    ) {
      citations.push({
        field: "Contest",
        sourceName: source.name,
        sourceUrl: source.url,
        official: source.official,
        tier: source.tier ?? "unknown",
      });
    }
  }
  if (
    contest.referendumUrl &&
    !citations.some((citation) => citation.sourceUrl === contest.referendumUrl)
  ) {
    citations.push({
      field: "Referendum text",
      sourceName: "Provider-linked measure source",
      sourceUrl: contest.referendumUrl,
      official: false,
      tier: "unknown",
    });
  }
  return citations;
}

export function ballotOfficeUrl(response: BallotResponse) {
  // Provider lookup destinations are not necessarily election-office websites.
  if (response.provider?.name === "democracy_works") return undefined;
  for (const region of response.state ?? []) {
    const url =
      ballotWebUrl(
        region.localJurisdiction?.electionAdministrationBody?.electionInfoUrl,
      ) ?? ballotWebUrl(region.electionAdministrationBody?.electionInfoUrl);
    if (url) return url;
  }
}

/** Election days are calendar dates, independent of the reader's time zone. */
export function ballotElectionDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}
