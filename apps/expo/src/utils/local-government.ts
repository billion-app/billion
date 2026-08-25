/**
 * Jurisdiction-neutral presentation logic for local-government decisions.
 *
 * Everything here is a pure function over API-shaped data so it can be unit
 * tested without React Native. Types come from the real tRPC outputs — do not
 * hand-mock shapes here.
 */
import type { RouterOutputs } from "~/utils/api";

export type DecisionListPage = RouterOutputs["legistar"]["listDecisions"];
export type DecisionRow = DecisionListPage[number];
export type DecisionDetail = RouterOutputs["legistar"]["getDecision"];
export type DecisionOccurrence = DecisionDetail["occurrences"][number];
export type DecisionVote = DecisionDetail["votes"][number];

/** First-release jurisdictions wired into the ingestion pipeline. */
export const LOCAL_JURISDICTIONS = [
  "sanjose",
  "santaclara",
  "sunnyvale",
] as const;
export type LocalJurisdictionKey = (typeof LOCAL_JURISDICTIONS)[number];

/**
 * Best-effort jurisdiction detection from a saved address string. Falls back
 * to the first-release default rather than pretending every address is
 * covered. City names are matched conservatively; county wording maps to the
 * county record.
 */
export function detectJurisdictionKey(
  address: string | null | undefined,
): LocalJurisdictionKey {
  if (!address) return "sanjose";
  const normalized = address.toLowerCase();
  // City names are checked before street parsing so a street like
  // "Santa Clara St, San Jose" stays San José.
  if (/san jose|san jos[eé]/.test(normalized)) return "sanjose";
  if (normalized.includes("sunnyvale")) return "sunnyvale";
  if (/santa clara county|unincorporated/.test(normalized)) return "santaclara";
  return "sanjose";
}

/** Best-effort display name while the DB record loads. */
export const JURISDICTION_FALLBACK_NAMES: Record<LocalJurisdictionKey, string> =
  {
    sanjose: "San José",
    santaclara: "Santa Clara County",
    sunnyvale: "Sunnyvale",
  };

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

const TOPIC_LABELS: Record<string, string> = {
  "housing-land-use": "Housing & land use",
  transportation: "Transportation",
  "public-safety": "Public safety",
  "budget-finance": "Budget, fees & contracts",
  "environment-utilities": "Environment & utilities",
  "community-services": "Neighborhood services",
  "ethics-government": "Ethics & open government",
  other: "Other",
};

/** Plain-language topic label; unknown keys pass through de-jargonized. */
export function topicLabel(topic: string | null | undefined): string | null {
  if (!topic) return null;
  return TOPIC_LABELS[topic] ?? titleCase(topic);
}

export function topicLabelOrFallback(topic: string): string {
  return TOPIC_LABELS[topic] ?? titleCase(topic);
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Geographic scope
// ---------------------------------------------------------------------------

export interface ScopeInfo {
  kind: "citywide" | "district" | "place" | "unknown";
  /** Short badge label, or null when unknown. */
  label: string | null;
  /** Fuller sentence for detail screens. */
  sentence: string | null;
}

/** Normalize a row/detail's scope fields into display info. */
export function scopeInfo(
  scopeKind: string,
  districtNumbers: readonly number[] | null,
  geographicText: string | null | undefined,
): ScopeInfo {
  switch (scopeKind) {
    case "citywide":
      return {
        kind: "citywide",
        label: "Citywide",
        sentence: "Affects the whole city.",
      };
    case "district": {
      const districts = (districtNumbers ?? []).map((n) => `District ${n}`);
      const label = districts.length
        ? districts.join(" · ")
        : "Council district";
      return {
        kind: "district",
        label,
        sentence: `Affects ${districts.join(" and ")}.`,
      };
    }
    case "place": {
      const place = geographicText?.trim() ?? null;
      return {
        kind: "place",
        label: place ? truncate(place, 28) : "Specific location",
        sentence: place ? `Affects the area around ${place}.` : null,
      };
    }
    default:
      return { kind: "unknown", label: null, sentence: null };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle status
// ---------------------------------------------------------------------------

export type DecisionLifecycle =
  | "upcoming"
  | "awaiting_outcome"
  | "approved"
  | "rejected"
  | "deferred"
  | "withdrawn"
  | "cancelled"
  | "informational"
  | "decided_other"
  | "unknown";

interface LifecycleInput {
  status?: string | null;
  type?: string | null;
  outcome?: string | null;
  passed?: string | null;
  meetingCancelled?: boolean;
  meetingStartsAt?: Date | string | null;
}

const APPROVED_PATTERN =
  /adopt(?:ed)?|approv(?:ed|al)|pass(?:ed)?|confirm(?:ed)?|enact(?:ed)?|carried|authorized|accepted|granted/i;
const REJECTED_PATTERN =
  /\b(?:denied|rejected?|failed|denied to pass|not approved|did not pass|deny)\b|fail(?:ed)? to pass/i;
const DEFERRED_PATTERN =
  /continu(?:ed|e)|deferr?ed|tabled|held over|postponed/i;
const WITHDRAWN_PATTERN = /withdrawn|pulled|removed from agenda/i;
const INFORMATIONAL_PATTERN =
  /informational|report only|receive and file|presentation|briefing|update only/i;

/** Classify one decision row into a lifecycle state for presentation. */
export function classifyDecision(
  input: LifecycleInput,
  now: Date = new Date(),
): DecisionLifecycle {
  const outcome = input.outcome ?? "";
  const passed = input.passed ?? "";
  const combined = `${input.status ?? ""} ${outcome} ${passed}`;

  if (WITHDRAWN_PATTERN.test(combined)) return "withdrawn";
  if (input.meetingCancelled && !APPROVED_PATTERN.test(combined))
    return "cancelled";
  if (
    DEFERRED_PATTERN.test(outcome) ||
    DEFERRED_PATTERN.test(input.status ?? "")
  )
    return "deferred";
  if (
    INFORMATIONAL_PATTERN.test(outcome) ||
    INFORMATIONAL_PATTERN.test(input.type ?? "")
  )
    return "informational";

  const hasOutcome = Boolean(outcome.trim());
  if (!hasOutcome && APPROVED_PATTERN.test(input.status ?? "")) {
    // Matter-level status like "Adopted" with no recorded item action still
    // counts as decided — the source says so even if the item row lags.
    return "approved";
  }
  if (hasOutcome || passed.trim()) {
    if (REJECTED_PATTERN.test(combined)) return "rejected";
    if (DEFERRED_PATTERN.test(combined)) return "deferred";
    if (INFORMATIONAL_PATTERN.test(outcome)) return "informational";
    if (APPROVED_PATTERN.test(combined) || /^pass/i.test(passed.trim()))
      return "approved";
    // An action exists that matches neither approve nor reject language —
    // report what the source said instead of guessing a side.
    return "decided_other";
  }

  const startsAt = parseDate(input.meetingStartsAt);
  if (startsAt && startsAt.getTime() >= now.getTime()) return "upcoming";
  return "awaiting_outcome";
}

/** Plain-language status label. Never implies a vote happened when it didn't. */
export function lifecycleLabel(lifecycle: DecisionLifecycle): string {
  switch (lifecycle) {
    case "upcoming":
      return "Scheduled for a public meeting";
    case "awaiting_outcome":
      return "Heard — outcome not yet published";
    case "approved":
      return "Approved";
    case "rejected":
      return "Not approved";
    case "deferred":
      return "Deferred to a later meeting";
    case "withdrawn":
      return "Withdrawn";
    case "cancelled":
      return "Meeting cancelled";
    case "informational":
      return "Informational — no vote expected";
    case "decided_other":
      return "Action taken";
    default:
      return "Status unclear in official records";
  }
}

/** Screen-reader-friendly full status sentence. */
export function lifecycleAccessibilityLabel(
  lifecycle: DecisionLifecycle,
): string {
  return `Status: ${lifecycleLabel(lifecycle)}`;
}

/**
 * Visual treatment per lifecycle. Icon + shape + color so states stay
 * distinguishable without relying on hue alone.
 */
export function lifecycleVisual(lifecycle: DecisionLifecycle): {
  icon:
    | "calendar"
    | "clock"
    | "check"
    | "close"
    | "undo"
    | "info"
    | "block"
    | "help";
  tint: "accent" | "success" | "warning" | "danger" | "muted";
} {
  switch (lifecycle) {
    case "upcoming":
      return { icon: "calendar", tint: "accent" };
    case "awaiting_outcome":
      return { icon: "clock", tint: "warning" };
    case "approved":
      return { icon: "check", tint: "success" };
    case "rejected":
      return { icon: "close", tint: "danger" };
    case "deferred":
      return { icon: "undo", tint: "warning" };
    case "withdrawn":
      return { icon: "block", tint: "muted" };
    case "cancelled":
      return { icon: "block", tint: "danger" };
    case "informational":
      return { icon: "info", tint: "muted" };
    case "decided_other":
      return { icon: "check", tint: "muted" };
    default:
      return { icon: "help", tint: "muted" };
  }
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/** Occurrences ordered chronologically; undated rows keep stable position last. */
export function sortTimeline<T extends { startsAt?: Date | string | null }>(
  occurrences: readonly T[],
): T[] {
  return [...occurrences].sort((a, b) => {
    const ta = parseDate(a.startsAt)?.getTime();
    const tb = parseDate(b.startsAt)?.getTime();
    if (ta === undefined && tb === undefined) return 0;
    if (ta === undefined) return 1;
    if (tb === undefined) return -1;
    return ta - tb;
  });
}

export interface OccurrenceSummary {
  body: string;
  date: Date | null;
  agendaNumber: string | null;
  action: string | null;
  tally: string | null;
  cancelled: boolean;
}

/** Compact chronological summary used for card subtitles. */
export function timelineSummary(
  occurrences: readonly DecisionOccurrence[],
): OccurrenceSummary[] {
  return sortTimeline(occurrences).map((occurrence) => ({
    body: occurrence.body,
    date: parseDate(occurrence.startsAt),
    agendaNumber: occurrence.agendaNumber,
    action: occurrence.action,
    tally: occurrence.tally,
    cancelled: occurrence.cancelled,
  }));
}

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------

/** Group flat vote rows under their meeting-item occurrence id. */
export function groupVotesByOccurrence(
  votes: readonly DecisionVote[],
): Map<string, DecisionVote[]> {
  const grouped = new Map<string, DecisionVote[]>();
  for (const vote of votes) {
    const bucket = grouped.get(vote.meetingItemId);
    if (bucket) bucket.push(vote);
    else grouped.set(vote.meetingItemId, [vote]);
  }
  return grouped;
}

/** Canonical short label for a recorded vote value. */
export function voteValueLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("y")) return "Yes";
  if (normalized.startsWith("n")) return "No";
  if (normalized.includes("abstain")) return "Abstained";
  if (normalized.includes("absent")) return "Absent";
  if (normalized.includes("recus")) return "Recused";
  if (normalized.includes("excused")) return "Excused";
  return value.trim();
}

export function voteValueTone(value: string): "for" | "against" | "neutral" {
  const label = voteValueLabel(value);
  if (label === "Yes") return "for";
  if (label === "No") return "against";
  return "neutral";
}

/**
 * Honest copy for the votes section of an occurrence. A missing vote row
 * means the publication hasn't happened — never that nobody voted.
 */
export function voteAvailability(
  occurrence: Pick<DecisionOccurrence, "action" | "tally">,
  hasRecordedVotes: boolean,
): {
  visible: boolean;
  headline: string;
  detail: string | null;
} {
  if (hasRecordedVotes) {
    return {
      visible: true,
      headline: "How officials voted",
      detail: null,
    };
  }
  if (occurrence.tally?.trim()) {
    return {
      visible: false,
      headline: "Individual votes have not been published",
      detail: `The meeting record shows a ${occurrence.tally.trim()} result, but named votes aren’t available yet.`,
    };
  }
  if (occurrence.action?.trim()) {
    return {
      visible: false,
      headline: "Individual votes have not been published",
      detail:
        "The outcome above comes from the official record; named votes weren’t published with this item.",
    };
  }
  return {
    visible: false,
    headline: "No vote recorded yet",
    detail:
      "If this item was voted on, individual results will appear after the body publishes them.",
  };
}

/**
 * First non-cancelled occurrence at or after `now` (defaults to the current
 * time). Kept here so components stay free of impure render-time calls.
 */
export function nextUpcomingOccurrence(
  occurrences: readonly DecisionOccurrence[],
  now: Date = new Date(),
): DecisionOccurrence | null {
  const time = now.getTime();
  const ordered = sortTimeline(occurrences);
  return (
    ordered.find(
      (o) => !o.cancelled && (parseDate(o.startsAt)?.getTime() ?? -1) >= time,
    ) ?? null
  );
}

/** Chronologically last occurrence (the most recent state of the matter). */
export function latestOccurrence(
  occurrences: readonly DecisionOccurrence[],
): DecisionOccurrence | null {
  return sortTimeline(occurrences).at(-1) ?? null;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function parseDate(
  value: Date | string | null | undefined,
): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMeetingDate(
  date: Date | string | null | undefined,
): string {
  const parsed = parseDate(date);
  if (!parsed) return "Date not published";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMeetingDateTime(date: Date | string | null): string {
  const parsed = parseDate(date);
  if (!parsed) return "Time not published";
  const day = parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

export function relativeDay(
  date: Date | string | null,
  now = new Date(),
): string | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  const days = Math.round(
    (startOfDay(parsed).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 13) return `In ${days} days`;
  if (days < -1 && days >= -13) return `${Math.abs(days)} days ago`;
  return null;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const DOCUMENT_LABELS: Record<string, string> = {
  staff_report: "Staff report",
  ordinance: "Ordinance",
  resolution: "Resolution",
  fiscal: "Fiscal document",
  presentation: "Presentation",
  minutes_order: "Minutes order",
  reference: "Official reference",
  other: "Document",
};

export function documentCategoryLabel(category: string): string {
  return DOCUMENT_LABELS[category] ?? titleCase(category);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
