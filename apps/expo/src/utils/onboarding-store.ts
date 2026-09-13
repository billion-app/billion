/**
 * What the reader told us during onboarding, kept on the device.
 *
 * None of this requires an account. The flow deliberately asks for tracking
 * vectors and sectors *before* offering registration, so the answers have to
 * survive without a server to hold them — and they stay useful if the reader
 * never registers at all.
 *
 * The reducers are pure so the selection rules can be tested without a device;
 * the async pair at the bottom is the thin layer that puts them on disk.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Versioned so a future change to the stored shape can be migrated — or
 * ignored — rather than mis-parsed. Bump the suffix, never reuse it.
 */
const STORAGE_KEY = "billion.onboarding.v1";

/**
 * Two of these are jurisdictions and two are content types. They are one list
 * here because the reader picks them as one question; `contentJurisdictionFor`
 * splits them back apart for the parts of the app that care.
 */
export type TrackingVector = "congress" | "state" | "executive" | "courts";

export type Sector =
  | "defense"
  | "technology"
  | "fiscal"
  | "energy"
  | "healthcare"
  | "infrastructure";

export interface OnboardingState {
  /** The flow ran to the end — the reader is not sent back through it. */
  completed: boolean;
  vectors: TrackingVector[];
  sectors: Sector[];
  /** Sub-topics pulled out of a sector (e.g. AI under Technology). */
  topics: string[];
  alerts: { instant: boolean; digest: boolean };
  /** Dismissed the registration wall with "Explore First". */
  deferredClaim: boolean;
}

export const EMPTY_ONBOARDING: OnboardingState = {
  completed: false,
  vectors: [],
  sectors: [],
  topics: [],
  alerts: { instant: true, digest: true },
  deferredClaim: false,
};

/** Screen 3 asks for three so the feed has enough signal to rank against. */
export const MIN_SECTORS = 3;

/**
 * Short names, read one at a time during the curation ceremony. The choice
 * screens use the full titles; a moving line needs a word, not a phrase.
 */
export const VECTOR_SHORT: Record<TrackingVector, string> = {
  congress: "Congress",
  state: "State legislature",
  executive: "Executive orders",
  courts: "Federal courts",
};

export const SECTOR_SHORT: Record<Sector, string> = {
  defense: "Defense",
  technology: "Technology",
  fiscal: "Economy",
  energy: "Energy",
  healthcare: "Health",
  infrastructure: "Infrastructure",
};

/* ---------- the rules ---------- */

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function canLeaveVectors(state: OnboardingState): boolean {
  return state.vectors.length > 0;
}

export function canLeaveSectors(state: OnboardingState): boolean {
  return state.sectors.length >= MIN_SECTORS;
}

/**
 * The feed still tracks a single jurisdiction, so a reader who picked their
 * state legislature gets that; everyone else gets federal.
 *
 * GAP: "executive" and "courts" are content types, and the feed does not yet
 * filter by stored type preferences. They are recorded, not yet applied.
 */
export function contentJurisdictionFor(
  vectors: TrackingVector[],
): "federal" | "state" {
  return vectors.includes("state") ? "state" : "federal";
}

/** Tolerates anything on disk: a bad read starts the reader fresh. */
export function parseOnboarding(raw: string | null): OnboardingState {
  if (!raw) return EMPTY_ONBOARDING;
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      completed: parsed.completed === true,
      vectors: Array.isArray(parsed.vectors) ? parsed.vectors : [],
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      alerts: {
        instant: parsed.alerts?.instant !== false,
        digest: parsed.alerts?.digest !== false,
      },
      deferredClaim: parsed.deferredClaim === true,
    };
  } catch {
    return EMPTY_ONBOARDING;
  }
}

/* ---------- the disk ---------- */

export async function loadOnboarding(): Promise<OnboardingState> {
  try {
    return parseOnboarding(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_ONBOARDING;
  }
}

export async function saveOnboarding(state: OnboardingState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* a dropped preference is not worth interrupting the flow for */
  }
}

/** Development affordance: replay the flow from the first screen. */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
