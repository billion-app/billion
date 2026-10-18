/**
 * Voting-logistics derivation — the "how do I cast my ballot" model behind the
 * How to Vote screen.
 *
 * Locations and authority links are derived from the ballot response. Nothing
 * is inferred from the election date: this module deliberately has no
 * "registration closes 15 days before" style arithmetic, because a deadline we
 * computed is not a deadline any authority published. Where we don't have a
 * fact, the model says so (`status: "unknown"`) and the UI renders an honest
 * missing-details variant instead of a guess.
 *
 * See also `~/utils/elections` for ballot-content classification. This module
 * is strictly logistics.
 */

import type {
  AdministrationBody,
  Address as CivicAddress,
  PollingLocation,
  VoterInfoResponse,
} from "@acme/api";

import type { AppTranslate } from "../i18n/app-strings";
import { appTranslator } from "../i18n/app-strings";
import { daysUntil } from "./dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VotingMethodId =
  | "mail"
  | "dropBox"
  | "earlyInPerson"
  | "electionDay";

/**
 * How usable a method is right now.
 *
 * Missing data does not establish whether a method is offered or open.
 * Listed locations likewise do not establish current opening hours.
 */
export type MethodStatus =
  | "listed" // locations supplied; current availability is unverified
  | "upcoming" // published start date is in the future
  | "closed" // published end date has passed
  | "unknown" // this lookup does not supply the details
  | "limited"; // offered in a reduced form (e.g. in person during a mail-only election)

export interface VotingMethod {
  id: VotingMethodId;
  status: MethodStatus;
  /** Locations this method applies to, if any were published. */
  locations: PollingLocation[];
  /** Official hand-off for instructions. */
  instructionsUrl?: string;
  /** Published window for the method, when the feed carried one. */
  startDate?: string;
  endDate?: string;
}

export interface OfficialSource {
  /** Verbatim authority name, e.g. "Sacramento County Voter Registration & Elections". */
  name: string;
  electionInfoUrl?: string;
  registrationUrl?: string;
  registrationConfirmationUrl?: string;
  absenteeVotingInfoUrl?: string;
  votingLocationFinderUrl?: string;
  electionRulesUrl?: string;
  /** First official phone number we can offer as an Election Day fallback. */
  phone?: string;
}

/**
 * Where to send someone who doesn't know whether they're registered.
 *
 * Always resolves: county/state tool if the feed carried one, otherwise the
 * federal portal. A registration prompt with no action is worse than no
 * prompt at all, so this never returns undefined.
 */
export function registrationCheckUrl(source?: OfficialSource): string {
  return (
    source?.registrationConfirmationUrl ??
    source?.registrationUrl ??
    "https://vote.gov"
  );
}

export interface VotingPlan {
  methods: VotingMethod[];
  mailOnly: boolean;
  /** True when no method carried a single published location. */
  noLocationsPublished: boolean;
  /** The most specific election authority we could resolve, if any. */
  source?: OfficialSource;
}

// ---------------------------------------------------------------------------
// Election-day phase
// ---------------------------------------------------------------------------

export type ElectionPhase = "upcoming" | "electionDay" | "ended";

/** Which phase of the election cycle a date falls in, relative to now. */
export function electionPhase(electionDay: string | undefined): ElectionPhase {
  if (!electionDay) return "upcoming";
  const days = daysUntil(electionDay);
  if (days === 0) return "electionDay";
  return days < 0 ? "ended" : "upcoming";
}

// ---------------------------------------------------------------------------
// Address formatting
// ---------------------------------------------------------------------------

/** One-line "100 Oak St, San Jose, CA 95112" from a Civic address. */
export function formatCivicAddress(a: CivicAddress): string {
  return [a.line1, a.line2, a.line3, `${a.city}, ${a.state} ${a.zip}`.trim()]
    .filter(Boolean)
    .join(", ");
}

/**
 * Street + city only. The registered address is sensitive, and the How to Vote
 * screen has no reason to render a ZIP back at someone who typed it.
 */
export function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 2) return address;
  return `${parts[0]}, ${parts[1]}`;
}

// ---------------------------------------------------------------------------
// Method construction
// ---------------------------------------------------------------------------

/** Earliest published `startDate` across a set of locations. */
function earliestStart(locations: PollingLocation[]): string | undefined {
  const dates = locations
    .map((l) => l.startDate)
    .filter((d): d is string => !!d)
    .sort();
  return dates[0];
}

/** Latest published `endDate` across a set of locations. */
function latestEnd(locations: PollingLocation[]): string | undefined {
  const dates = locations
    .map((l) => l.endDate)
    .filter((d): d is string => !!d)
    .sort();
  return dates[dates.length - 1];
}

/**
 * Resolve a method's status from its published window.
 *
 * With no locations at all we return `unknown` rather than `unavailable` —
 * Google Civic routinely returns an empty array weeks out, which is a
 * publication gap and not a statement that the method isn't offered.
 */
function windowStatus(
  locations: PollingLocation[],
  start: string | undefined,
  end: string | undefined,
): MethodStatus {
  if (locations.length === 0) return "unknown";
  if (
    start &&
    locations.every((location) => !!location.startDate) &&
    daysUntil(start) > 0
  )
    return "upcoming";
  if (
    end &&
    locations.every((location) => !!location.endDate) &&
    daysUntil(end) < 0
  )
    return "closed";
  return "listed";
}

/** Mail instructions require supplied source text; a URL alone is not evidence. */
function mailMethod(source: OfficialSource | undefined): VotingMethod {
  return {
    id: "mail",
    instructionsUrl: source?.absenteeVotingInfoUrl ?? source?.electionInfoUrl,
    status: "unknown",
    locations: [],
  };
}

/** Published locations and dates for drop boxes or early voting. */
function locationMethod(
  id: "dropBox" | "earlyInPerson",
  locations: PollingLocation[],
  source: OfficialSource | undefined,
): VotingMethod {
  const instructionsUrl =
    (id === "dropBox"
      ? source?.absenteeVotingInfoUrl
      : source?.votingLocationFinderUrl) ?? source?.electionInfoUrl;
  const startDate = earliestStart(locations);
  const endDate = latestEnd(locations);
  return {
    id,
    instructionsUrl,
    status: windowStatus(locations, startDate, endDate),
    locations,
    startDate,
    endDate,
  };
}

/** Election Day polling places / vote centers. */
function electionDayMethod(
  locations: PollingLocation[],
  mailOnly: boolean,
  source: OfficialSource | undefined,
): VotingMethod {
  const instructionsUrl =
    source?.votingLocationFinderUrl ?? source?.electionInfoUrl;
  // In an all-mail election in-person service still exists — usually one
  // office for replacement ballots and assistance. Dropping the row entirely
  // would read as "you cannot vote in person", which isn't what mailOnly means.
  if (mailOnly) {
    return {
      id: "electionDay",
      instructionsUrl,
      status: "limited",
      locations,
    };
  }

  const status: MethodStatus = locations.length > 0 ? "listed" : "unknown";
  return {
    id: "electionDay",
    instructionsUrl,
    status,
    locations,
  };
}

// ---------------------------------------------------------------------------
// Official source
// ---------------------------------------------------------------------------

/**
 * Pick the most specific election authority in the response.
 *
 * Civic nests `localJurisdiction` inside `state`; the local body is the one
 * that actually runs the election, so it wins when it names itself.
 */
export function resolveOfficialSource(
  resp: VoterInfoResponse | undefined,
): OfficialSource | undefined {
  // Democracy Works synthesizes these fields from provider lookup destinations;
  // they do not identify a verified election authority (see ballotOfficeUrl).
  if (resp?.provider?.name === "democracy_works") return undefined;

  const region = resp?.state?.[0];
  if (!region) return undefined;

  const local = region.localJurisdiction?.electionAdministrationBody;
  const state = region.electionAdministrationBody;
  const body: AdministrationBody | undefined = local?.name ? local : state;
  const name = body?.name ?? region.localJurisdiction?.name ?? region.name;
  if (!name) return undefined;

  const official = body?.electionOfficials?.find((o) => o.officePhoneNumber);

  return {
    name,
    electionInfoUrl: body?.electionInfoUrl,
    registrationUrl: body?.electionRegistrationUrl,
    registrationConfirmationUrl: body?.electionRegistrationConfirmationUrl,
    absenteeVotingInfoUrl: body?.absenteeVotingInfoUrl,
    votingLocationFinderUrl: body?.votingLocationFinderUrl,
    electionRulesUrl: body?.electionRulesUrl,
    phone: official?.officePhoneNumber,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Build the full voting plan for a voter-info response.
 *
 * Method order is fixed and independent of availability so the list doesn't
 * reshuffle between visits — an unavailable method keeps its slot and explains
 * itself rather than disappearing.
 */
export function buildVotingPlan(
  resp: VoterInfoResponse | undefined,
): VotingPlan {
  const mailOnly = resp?.mailOnly === true;
  const dropOff = resp?.dropOffLocations ?? [];
  const early = resp?.earlyVoteSites ?? [];
  const polling = resp?.pollingLocations ?? [];

  // Resolve the authority used for official hand-offs.
  const source = resolveOfficialSource(resp);

  const methods: VotingMethod[] = [
    mailMethod(source),
    locationMethod("dropBox", dropOff, source),
    ...(mailOnly ? [] : [locationMethod("earlyInPerson", early, source)]),
    electionDayMethod(polling, mailOnly, source),
  ];

  return {
    methods,
    mailOnly,
    noLocationsPublished:
      dropOff.length === 0 && early.length === 0 && polling.length === 0,
    source,
  };
}

/**
 * Sublabel for the Elections-tab entry card.
 *
 * Deliberately never states a deadline: we have no sourced deadline data, and
 * the entry point is the last place to start guessing at one.
 */
export function entryCardSubtitle(
  hasAddress: boolean,
  plan: VotingPlan | undefined,
  phase: ElectionPhase,
  t: AppTranslate = appTranslator("en"),
): string {
  if (!hasAddress) return t("voteGuide.entry.address");
  if (phase === "ended") return t("voteGuide.entry.ended");
  if (!plan || plan.methods.length === 0) {
    return t("voteGuide.entry.contacts");
  }
  if (phase === "electionDay") return t("voteGuide.entry.today");
  return t("voteGuide.entry.ways");
}
