/**
 * Voting-logistics derivation — the "how do I cast my ballot" model behind the
 * How to Vote screen.
 *
 * Everything here is derived from data Google Civic actually returned. Nothing
 * is inferred from the election date: this module deliberately has no
 * "registration closes 15 days before" style arithmetic, because a deadline we
 * computed is not a deadline any authority published. Where we don't have a
 * fact, the model says so (`status: "unknown"`) and the UI renders an honest
 * "not published" variant instead of a guess.
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
 * `unknown` is load-bearing and must never collapse into `unavailable`: the
 * former means "the county hasn't published this yet", the latter means "an
 * official source says this isn't offered". Telling a voter a method doesn't
 * exist when we simply don't know is the exact failure this screen exists to
 * avoid.
 */
export type MethodStatus =
  | "available" // usable today
  | "upcoming" // published start date is in the future
  | "closed" // published end date has passed
  | "unknown" // offered, but the county hasn't published the details
  | "limited"; // offered in a reduced form (e.g. in person during a mail-only election)

export interface MethodChip {
  label: string;
  /** Which semantic colour the chip takes. Never the only signal — see label. */
  tone: "positive" | "urgent" | "neutral" | "negative";
  /** `IconName` from the shared icon set. */
  icon: "check" | "clock" | "calendar" | "info" | "block";
}

export interface VotingMethod {
  id: VotingMethodId;
  title: string;
  status: MethodStatus;
  chip: MethodChip;
  /** One-line status under the title. Empty string when we have nothing to say. */
  subtitle: string;
  /** Locations this method applies to, if any were published. */
  locations: PollingLocation[];
  /** Numbered checklist. Titles carry the instruction; details add consequence. */
  steps: VotingStep[];
  /** Published window for the method, when the feed carried one. */
  startDate?: string;
  endDate?: string;
}

export interface VotingStep {
  /** The instruction. Must stand alone — a reader who skips details is still correct. */
  title: string;
  /** Consequence or caveat only. Omitted when we'd be padding. */
  detail?: string;
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

export interface VotingPlan {
  methods: VotingMethod[];
  /** Methods a voter can act on today — drives the entry-point sublabel. */
  availableCount: number;
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

const CHIP: Record<MethodStatus, MethodChip> = {
  available: { label: "Available", tone: "positive", icon: "check" },
  upcoming: { label: "Not open yet", tone: "urgent", icon: "clock" },
  closed: { label: "Closed", tone: "negative", icon: "block" },
  unknown: { label: "Not published", tone: "neutral", icon: "clock" },
  limited: { label: "Limited", tone: "neutral", icon: "info" },
};

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
  if (start && daysUntil(start) > 0) return "upcoming";
  if (end && daysUntil(end) < 0) return "closed";
  return "available";
}

/** "18 vote centers" / "1 vote center" — count phrasing shared by in-person rows. */
function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Vote by mail.
 *
 * Steps are unconditional (they describe handling a ballot, not a jurisdiction
 * rule) except the postage line, which is California-specific and therefore
 * gated on the resolved state.
 */
function mailMethod(
  resp: VoterInfoResponse | undefined,
  isCalifornia: boolean,
): VotingMethod {
  const mailOnly = resp?.mailOnly === true;
  const steps: VotingStep[] = [
    {
      title: "Find the ballot mailed to you",
      detail: "Contact your county if it hasn't arrived.",
    },
    {
      title: "Mark your choices in ink",
      detail: "Skipping contests won't void your ballot.",
    },
    {
      title: "Seal it in the official return envelope",
      detail: "Any other envelope may not be counted.",
    },
    {
      title: "Sign the back — it must match your registration",
      detail: "The most common reason a ballot is rejected.",
    },
    isCalifornia
      ? {
          title: "Mail it — no stamp needed",
          detail: "Postage is prepaid in California.",
        }
      : { title: "Mail it back as early as you can" },
  ];

  return {
    id: "mail",
    title: mailOnly ? "Return your ballot by mail" : "Vote by mail",
    // Every registered voter in an all-mail election is sent a ballot; outside
    // one we can't confirm this voter gets one without a source, so the status
    // stays honest rather than optimistic.
    status: mailOnly ? "available" : "unknown",
    chip: mailOnly ? CHIP.available : CHIP.unknown,
    subtitle: mailOnly
      ? "Every registered voter is mailed a ballot"
      : "Return deadline not available",
    locations: [],
    steps,
  };
}

/** Ballot drop boxes. */
function dropBoxMethod(locations: PollingLocation[]): VotingMethod {
  const start = earliestStart(locations);
  const end = latestEnd(locations);
  const status = windowStatus(locations, start, end);

  return {
    id: "dropBox",
    title: "Return at a drop box",
    status,
    chip:
      status === "available"
        ? { ...CHIP.available, label: "Open now" }
        : CHIP[status],
    subtitle:
      locations.length > 0
        ? countLabel(locations.length, "location", "locations")
        : "Locations not published yet",
    locations,
    startDate: start,
    endDate: end,
    steps: [
      {
        title: "Mark, seal, and sign your ballot first",
        detail: "A drop box takes the same sealed return envelope.",
      },
      { title: "Drop it in any box in your county" },
      {
        title: "Arrive before your county's cutoff on Election Day",
        detail: "Boxes are locked at closing; later isn't counted.",
      },
    ],
  };
}

/** Early in-person voting / vote centers open before Election Day. */
function earlyMethod(locations: PollingLocation[]): VotingMethod {
  const start = earliestStart(locations);
  const end = latestEnd(locations);
  const status = windowStatus(locations, start, end);

  let chip = CHIP[status];
  if (status === "upcoming" && start) {
    const days = daysUntil(start);
    chip = {
      ...CHIP.upcoming,
      label: days === 1 ? "Opens tomorrow" : `Opens in ${days} days`,
    };
  }

  return {
    id: "earlyInPerson",
    title: "Vote early in person",
    status,
    chip,
    subtitle:
      locations.length > 0
        ? countLabel(locations.length, "early vote site", "early vote sites")
        : "Locations not published yet",
    locations,
    startDate: start,
    endDate: end,
    steps: [
      { title: "Go to any early vote site in your county" },
      {
        title: "Bring your mailed ballot if you have it",
        detail: "You can surrender it and vote in person instead.",
      },
      { title: "Check the site's hours before you go" },
    ],
  };
}

/** Election Day polling places / vote centers. */
function electionDayMethod(
  locations: PollingLocation[],
  mailOnly: boolean,
): VotingMethod {
  // In an all-mail election in-person service still exists — usually one
  // office for replacement ballots and assistance. Dropping the row entirely
  // would read as "you cannot vote in person", which isn't what mailOnly means.
  if (mailOnly) {
    return {
      id: "electionDay",
      title: "Vote in person",
      status: "limited",
      chip: CHIP.limited,
      subtitle: "In-person help is available for replacement ballots",
      locations,
      steps: [
        { title: "Contact your county election office" },
        {
          title: "Ask about in-person service for this election",
          detail: "All-mail elections still staff at least one location.",
        },
      ],
    };
  }

  const status: MethodStatus = locations.length > 0 ? "available" : "unknown";
  return {
    id: "electionDay",
    title: "Vote in person on Election Day",
    status,
    chip: status === "available" ? CHIP.available : CHIP.unknown,
    subtitle:
      locations.length > 0
        ? countLabel(locations.length, "polling place", "polling places")
        : "Locations not published yet",
    locations,
    steps: [
      { title: "Go to a polling place listed below" },
      {
        title: "Bring your mailed ballot if you received one",
        detail: "You can surrender it and vote in person instead.",
      },
      {
        title: "If you're in line when polls close, stay in line",
        detail: "Anyone already in line is entitled to vote.",
      },
    ],
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
  const isCalifornia = resp?.normalizedInput.state === "CA";
  const dropOff = resp?.dropOffLocations ?? [];
  const early = resp?.earlyVoteSites ?? [];
  const polling = resp?.pollingLocations ?? [];

  const methods: VotingMethod[] = [
    mailMethod(resp, isCalifornia),
    dropBoxMethod(dropOff),
    ...(mailOnly ? [] : [earlyMethod(early)]),
    electionDayMethod(polling, mailOnly),
  ];

  return {
    methods,
    availableCount: methods.filter((m) => m.status === "available").length,
    mailOnly,
    noLocationsPublished:
      dropOff.length === 0 && early.length === 0 && polling.length === 0,
    source: resolveOfficialSource(resp),
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
): string {
  if (!hasAddress) return "Add your address to see your options";
  if (phase === "ended") return "See results and what comes next";
  if (!plan || plan.methods.length === 0) {
    return "Deadlines and official election contacts";
  }
  if (phase === "electionDay") return "Polling places, hours, and directions";
  const n = plan.availableCount;
  if (n === 0) return "Ways to vote and where to go";
  return `${countLabel(n, "way", "ways")} to vote in this election`;
}
