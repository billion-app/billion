/**
 * Google Civic Information API Client
 *
 * API Reference: https://developers.google.com/civic-information/docs/v2
 */

const CIVIC_API_BASE = "https://www.googleapis.com/civicinfo/v2";

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_CIVIC_API_KEY environment variable is not set. " +
        "Get an API key from https://console.cloud.google.com/apis/credentials",
    );
  }
  return apiKey;
}

// ============================================================================
// Types
// ============================================================================

export interface Election {
  id: string;
  name: string;
  electionDay: string;
  ocdDivisionId: string;
}

export interface ElectionsResponse {
  kind: string;
  elections: Election[];
}

export interface Address {
  locationName?: string;
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  state: string;
  zip: string;
}

export interface PollingLocation {
  address: Address;
  notes?: string;
  pollingHours?: string;
  name?: string;
  voterServices?: string;
  startDate?: string;
  endDate?: string;
  sources?: Source[];
}

export interface Source {
  name: string;
  official: boolean;
}

export interface Contest {
  type: string;
  primaryParty?: string;
  electorateSpecifications?: string;
  special?: string;
  ballotTitle?: string;
  office?: string;
  level?: string[];
  roles?: string[];
  district?: ElectoralDistrict;
  numberElected?: string;
  numberVotingFor?: string;
  ballotPlacement?: string;
  candidates?: Candidate[];
  referendumTitle?: string;
  referendumSubtitle?: string;
  referendumUrl?: string;
  referendumBrief?: string;
  referendumText?: string;
  referendumProStatement?: string;
  referendumConStatement?: string;
  referendumPassageThreshold?: string;
  referendumEffectOfAbstain?: string;
  sources?: Source[];
}

export interface Candidate {
  name: string;
  party?: string;
  candidateUrl?: string;
  phone?: string;
  photoUrl?: string;
  email?: string;
  orderOnBallot?: string;
  channels?: Channel[];
}

export interface Channel {
  type: string;
  id: string;
}

export interface ElectoralDistrict {
  name: string;
  scope?: string;
  id?: string;
}

export interface AdministrationRegion {
  name: string;
  electionAdministrationBody?: AdministrationBody;
  localJurisdiction?: AdministrationRegion;
  sources?: Source[];
}

export interface AdministrationBody {
  name?: string;
  electionInfoUrl?: string;
  electionRegistrationUrl?: string;
  electionRegistrationConfirmationUrl?: string;
  absenteeVotingInfoUrl?: string;
  votingLocationFinderUrl?: string;
  ballotInfoUrl?: string;
  electionRulesUrl?: string;
  voterServices?: string[];
  hoursOfOperation?: string;
  correspondenceAddress?: Address;
  physicalAddress?: Address;
  electionOfficials?: ElectionOfficial[];
}

export interface ElectionOfficial {
  name?: string;
  title?: string;
  officePhoneNumber?: string;
  faxNumber?: string;
  emailAddress?: string;
}

export interface VoterInfoResponse {
  kind: string;
  election: Election;
  normalizedInput: Address;
  pollingLocations?: PollingLocation[];
  earlyVoteSites?: PollingLocation[];
  dropOffLocations?: PollingLocation[];
  contests?: Contest[];
  state?: AdministrationRegion[];
  mailOnly?: boolean;
}

export interface Official {
  name: string;
  address?: Address[];
  party?: string;
  phones?: string[];
  urls?: string[];
  photoUrl?: string;
  emails?: string[];
  channels?: Channel[];
}

export interface Office {
  name: string;
  divisionId: string;
  levels?: string[];
  roles?: string[];
  officialIndices: number[];
}

export interface Division {
  name: string;
  alsoKnownAs?: string[];
  officeIndices?: number[];
}

export interface RepresentativesResponse {
  kind: string;
  normalizedInput: Address;
  divisions: Record<string, Division>;
  offices: Office[];
  officials: Official[];
}

// Enriched types that combine office info with officials
export interface Representative extends Official {
  office: string;
  divisionId: string;
  levels?: string[];
  roles?: string[];
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchCivicApi<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${CIVIC_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Google Civic API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Get a list of upcoming elections
 *
 * @returns List of elections visible to the API
 */
export async function getElections(): Promise<Election[]> {
  const response = await fetchCivicApi<ElectionsResponse>("elections");
  return response.elections;
}

/**
 * Get voter info for a specific address
 *
 * @param address - The registered address of the voter
 * @param electionId - Optional election ID (from getElections). If not provided,
 *                     returns info for the most relevant upcoming election.
 * @returns Polling locations, ballot info, and contests for the address
 */
export async function getVoterInfo(
  address: string,
  electionId?: string,
): Promise<VoterInfoResponse> {
  const params: Record<string, string> = { address };

  if (electionId) {
    params.electionId = electionId;
  }

  return fetchCivicApi<VoterInfoResponse>("voterinfo", params);
}

/**
 * Get elected officials (representatives) for an address
 *
 * @param address - The address to look up
 * @param levels - Optional filter by government level: country, administrativeArea1 (state),
 *                 administrativeArea2 (county), locality, regional, special, subLocality1, subLocality2
 * @param roles - Optional filter by role: headOfState, headOfGovernment, deputyHeadOfGovernment,
 *                governmentOfficer, executiveCouncil, legislatorUpperBody, legislatorLowerBody,
 *                highestCourtJudge, judge, schoolBoard, specialPurposeOfficer
 * @returns Representatives with their offices and contact information
 */
export async function getRepresentatives(
  address: string,
  options?: {
    levels?: string[];
    roles?: string[];
    includeOffices?: boolean;
  },
): Promise<RepresentativesResponse> {
  const params: Record<string, string> = { address };

  if (options?.levels?.length) {
    params.levels = options.levels.join(",");
  }

  if (options?.roles?.length) {
    params.roles = options.roles.join(",");
  }

  if (options?.includeOffices === false) {
    params.includeOffices = "false";
  }

  return fetchCivicApi<RepresentativesResponse>("representatives", params);
}

/**
 * Get representatives with office info merged (convenience function)
 *
 * @param address - The address to look up
 * @returns Array of representatives with their office information included
 */
export async function getRepresentativesEnriched(
  address: string,
  options?: {
    levels?: string[];
    roles?: string[];
  },
): Promise<Representative[]> {
  const response = await getRepresentatives(address, options);

  const representatives: Representative[] = [];

  for (const office of response.offices) {
    for (const index of office.officialIndices) {
      const official = response.officials[index];
      if (official) {
        representatives.push({
          ...official,
          office: office.name,
          divisionId: office.divisionId,
          levels: office.levels,
          roles: office.roles,
        });
      }
    }
  }

  return representatives;
}
