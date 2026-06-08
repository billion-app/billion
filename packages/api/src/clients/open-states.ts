/**
 * Open States API v3 Client
 * https://v3.openstates.org/
 *
 * Provides access to California state legislation data
 */

const BASE_URL = "https://v3.openstates.org";
const DEFAULT_JURISDICTION = "ocd-jurisdiction/country:us/state:ca/government";

function buildJurisdiction(stateCode?: string): string {
  if (!stateCode) return DEFAULT_JURISDICTION;
  const code = stateCode.toLowerCase();
  if (code === "dc") {
    return "ocd-jurisdiction/country:us/district:dc/government";
  }
  return `ocd-jurisdiction/country:us/state:${code}/government`;
}

// ============================================================================
// Types
// ============================================================================

export interface OpenStatesJurisdiction {
  id: string;
  name: string;
  classification: string;
}

export interface OpenStatesPerson {
  id: string;
  name: string;
  party: string;
  current_role?: {
    title: string;
    org_classification: string;
    district: string;
    division_id: string;
  };
  given_name?: string;
  family_name?: string;
  image?: string;
  email?: string;
  links?: { url: string; note?: string }[];
  offices?: {
    name: string;
    address?: string;
    voice?: string;
    fax?: string;
  }[];
}

export interface OpenStatesOrganization {
  id: string;
  name: string;
  classification: string;
}

export interface OpenStatesBillAbstract {
  abstract: string;
  note: string;
}

export interface OpenStatesBillAction {
  date: string;
  description: string;
  classification: string[];
  organization?: OpenStatesOrganization;
}

export interface OpenStatesBillSponsorship {
  name: string;
  entity_type: string;
  classification: string;
  primary: boolean;
  person?: OpenStatesPerson;
}

export interface OpenStatesBillVersion {
  note: string;
  date: string;
  links: {
    url: string;
    media_type?: string;
  }[];
}

export interface OpenStatesBillDocument {
  note: string;
  date?: string;
  links: {
    url: string;
    media_type?: string;
  }[];
}

export interface OpenStatesVote {
  id: string;
  identifier: string;
  motion_text: string;
  start_date: string;
  result: string;
  organization?: OpenStatesOrganization;
  counts: {
    option: string;
    value: number;
  }[];
  votes?: {
    option: string;
    voter_name: string;
    voter?: OpenStatesPerson;
  }[];
}

export interface OpenStatesBill {
  id: string;
  identifier: string;
  title: string;
  session: string;
  classification: string[];
  subject?: string[];
  from_organization?: OpenStatesOrganization;
  jurisdiction: OpenStatesJurisdiction;
  abstracts?: OpenStatesBillAbstract[];
  actions?: OpenStatesBillAction[];
  sponsorships?: OpenStatesBillSponsorship[];
  versions?: OpenStatesBillVersion[];
  documents?: OpenStatesBillDocument[];
  votes?: OpenStatesVote[];
  created_at: string;
  updated_at: string;
  openstates_url: string;
}

export interface OpenStatesBillSearchResult {
  results: OpenStatesBill[];
  pagination: {
    page: number;
    max_page: number;
    per_page: number;
    total_items: number;
  };
}

export interface OpenStatesPersonSearchResult {
  results: OpenStatesPerson[];
  pagination: {
    page: number;
    max_page: number;
    per_page: number;
    total_items: number;
  };
}

// ============================================================================
// Client
// ============================================================================

function getApiKey(): string {
  const key = process.env.OPEN_STATES_API_KEY;
  if (!key) {
    throw new Error(
      "OPEN_STATES_API_KEY is not set. Get one at https://openstates.org/accounts/profile/",
    );
  }
  return key;
}

async function openStatesFetch<T>(
  path: string,
  params: Record<
    string,
    string | number | boolean | string[] | undefined
  > = {},
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    // Array values become repeated query params (?include=a&include=b) —
    // /people validates each `include` as a single enum, so it rejects the
    // comma-joined form the bills endpoints happen to tolerate.
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Open States API error (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// ============================================================================
// Public API Methods
// ============================================================================

export interface GetBillsOptions {
  stateCode?: string;
  query?: string;
  session?: string;
  page?: number;
  perPage?: number;
  classification?: string;
  subject?: string;
  updatedSince?: string;
  createdSince?: string;
  sort?: "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
  includeVersions?: boolean;
  includeSponsorships?: boolean;
  includeAbstracts?: boolean;
  includeActions?: boolean;
}

/**
 * Search California state bills
 */
export async function getBills(
  options: GetBillsOptions = {},
): Promise<OpenStatesBillSearchResult> {
  const {
    stateCode,
    query,
    session,
    page = 1,
    perPage = 20,
    classification,
    subject,
    updatedSince,
    createdSince,
    sort = "updated_desc",
    includeVersions = false,
    includeSponsorships = true,
    includeAbstracts = true,
    includeActions = false,
  } = options;

  const include: string[] = [];
  if (includeVersions) include.push("versions");
  if (includeSponsorships) include.push("sponsorships");
  if (includeAbstracts) include.push("abstracts");
  if (includeActions) include.push("actions");

  return openStatesFetch<OpenStatesBillSearchResult>("/bills", {
    jurisdiction: buildJurisdiction(stateCode),
    q: query,
    session,
    page,
    per_page: perPage,
    classification,
    subject,
    updated_since: updatedSince,
    created_since: createdSince,
    sort,
    include: include.length > 0 ? include.join(",") : undefined,
  });
}

export interface GetBillDetailsOptions {
  includeVersions?: boolean;
  includeSponsorships?: boolean;
  includeAbstracts?: boolean;
  includeActions?: boolean;
  includeDocuments?: boolean;
  includeVotes?: boolean;
}

/**
 * Get detailed information for a specific bill
 * @param billId - The Open States bill ID (e.g., "ocd-bill/abc123...")
 */
export async function getBillDetails(
  billId: string,
  options: GetBillDetailsOptions = {},
): Promise<OpenStatesBill> {
  const {
    includeVersions = true,
    includeSponsorships = true,
    includeAbstracts = true,
    includeActions = true,
    includeDocuments = true,
    includeVotes = true,
  } = options;

  const include: string[] = [];
  if (includeVersions) include.push("versions");
  if (includeSponsorships) include.push("sponsorships");
  if (includeAbstracts) include.push("abstracts");
  if (includeActions) include.push("actions");
  if (includeDocuments) include.push("documents");
  if (includeVotes) include.push("votes");

  // The bill ID needs to be URL-encoded
  const encodedId = encodeURIComponent(billId);

  return openStatesFetch<OpenStatesBill>(`/bills/${encodedId}`, {
    include: include.length > 0 ? include.join(",") : undefined,
  });
}

export interface GetLegislatorsOptions {
  stateCode?: string;
  district?: string;
  name?: string;
  party?: string;
  orgClassification?: "upper" | "lower";
  page?: number;
  perPage?: number;
}

/**
 * Get California state legislators
 * @param options.district - Filter by district (e.g., "1", "12")
 * @param options.orgClassification - "upper" for Senate, "lower" for Assembly
 */
export async function getLegislators(
  options: GetLegislatorsOptions = {},
): Promise<OpenStatesPersonSearchResult> {
  const {
    stateCode,
    district,
    name,
    party,
    orgClassification,
    page = 1,
    perPage = 50,
  } = options;

  return openStatesFetch<OpenStatesPersonSearchResult>("/people", {
    jurisdiction: buildJurisdiction(stateCode),
    district,
    name,
    party,
    org_classification: orgClassification,
    page,
    per_page: perPage,
    // /people omits offices + links unless explicitly included; the app uses
    // these for the Call / Website actions on each legislator card. Must be
    // repeated params (?include=offices&include=links) — /people validates each
    // `include` as a single enum and rejects the comma-joined form.
    include: ["offices", "links"],
  });
}

/**
 * Get votes for a specific bill
 * @param billId - The Open States bill ID
 */
export async function getVotes(billId: string): Promise<OpenStatesVote[]> {
  // Fetch the bill with votes included
  const bill = await getBillDetails(billId, {
    includeVersions: false,
    includeSponsorships: false,
    includeAbstracts: false,
    includeActions: false,
    includeDocuments: false,
    includeVotes: true,
  });

  return bill.votes ?? [];
}

// ============================================================================
// Convenience / Helper Methods
// ============================================================================

/**
 * Get all current sessions for California
 */
export async function getCurrentSessions(
  stateCode?: string,
): Promise<string[]> {
  const jurisdictionId = buildJurisdiction(stateCode);
  const jurisdiction = await openStatesFetch<{
    id: string;
    name: string;
    legislative_sessions: {
      identifier: string;
      name: string;
      classification: string;
      start_date?: string;
      end_date?: string;
    }[];
  }>(`/jurisdictions/${encodeURIComponent(jurisdictionId)}`);

  return jurisdiction.legislative_sessions
    .filter((s) => s.classification === "primary" || !s.end_date)
    .map((s) => s.identifier);
}

/**
 * Get a legislator by their Open States ID
 */
export async function getLegislatorById(
  personId: string,
): Promise<OpenStatesPerson> {
  const encodedId = encodeURIComponent(personId);
  return openStatesFetch<OpenStatesPerson>(`/people/${encodedId}`);
}

/**
 * Search bills by a specific legislator (sponsor)
 */
export async function getBillsBySponsor(
  sponsorName: string,
  options: Omit<GetBillsOptions, "query"> = {},
): Promise<OpenStatesBillSearchResult> {
  return getBills({
    ...options,
    query: `sponsor:"${sponsorName}"`,
  });
}

// Export the client as a namespace for convenience
export const openStatesClient = {
  getBills,
  getBillDetails,
  getLegislators,
  getVotes,
  getCurrentSessions,
  getLegislatorById,
  getBillsBySponsor,
};
