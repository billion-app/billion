/**
 * Google Civic Information API Client
 *
 * API Reference: https://developers.google.com/civic-information/docs/v2
 */

const CIVIC_API_BASE = "https://www.googleapis.com/civicinfo/v2";

function getApiKey(): string | null {
  return process.env.GOOGLE_CIVIC_API_KEY ?? null;
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
  if (!apiKey) {
    throw new Error("GOOGLE_CIVIC_API_KEY not configured");
  }
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

// ============================================================================
// Mock Data (used when GOOGLE_CIVIC_API_KEY is not configured)
// ============================================================================

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0]!;
}

const MOCK_ELECTIONS: Election[] = [
  {
    id: "9000",
    name: "California Primary Election",
    electionDay: futureDate(45),
    ocdDivisionId: "ocd-division/country:us/state:ca",
  },
  {
    id: "9001",
    name: "San Jose City Council Special Election",
    electionDay: futureDate(90),
    ocdDivisionId: "ocd-division/country:us/state:ca/place:san_jose",
  },
];

function getMockVoterInfo(address: string): VoterInfoResponse {
  return {
    kind: "civicinfo#voterInfoResponse",
    election: MOCK_ELECTIONS[0]!,
    normalizedInput: {
      line1: address.split(",")[0] ?? address,
      city: "San Jose",
      state: "CA",
      zip: "95112",
    },
    pollingLocations: [
      {
        address: {
          locationName: "Washington Elementary School",
          line1: "100 Oak St",
          city: "San Jose",
          state: "CA",
          zip: "95112",
        },
        pollingHours: "7:00 AM - 8:00 PM",
        name: "Washington Elementary School",
      },
    ],
    earlyVoteSites: [
      {
        address: {
          locationName: "Santa Clara County Registrar",
          line1: "1555 Berger Dr",
          city: "San Jose",
          state: "CA",
          zip: "95112",
        },
        pollingHours: "Mon-Fri 8:00 AM - 5:00 PM",
        name: "Santa Clara County Registrar of Voters",
        startDate: futureDate(-14),
        endDate: futureDate(44),
      },
    ],
    contests: [
      {
        type: "General",
        office: "U.S. Representative, District 17",
        level: ["country"],
        roles: ["legislatorLowerBody"],
        district: { name: "California's 17th Congressional District", scope: "congressional" },
        candidates: [
          { name: "Ro Khanna", party: "Democratic", candidateUrl: "https://example.com" },
          { name: "Anita Chen", party: "Republican" },
        ],
      },
      {
        type: "General",
        office: "State Senator, District 15",
        level: ["administrativeArea1"],
        roles: ["legislatorUpperBody"],
        district: { name: "California State Senate District 15", scope: "stateUpper" },
        candidates: [
          { name: "Dave Cortese", party: "Democratic" },
          { name: "Robert Singh", party: "Republican" },
        ],
      },
      {
        type: "General",
        office: "Mayor, City of San Jose",
        level: ["locality"],
        roles: ["headOfGovernment"],
        district: { name: "City of San Jose", scope: "citywide" },
        candidates: [
          { name: "Maria Gonzalez", party: "Nonpartisan" },
          { name: "Kevin Park", party: "Nonpartisan" },
          { name: "Lisa Tran", party: "Nonpartisan" },
        ],
      },
      {
        type: "General",
        office: "City Council, District 3",
        level: ["locality"],
        roles: ["legislatorLowerBody"],
        district: { name: "San Jose City Council District 3", scope: "cityCouncil" },
        candidates: [
          { name: "Omar Hernandez", party: "Nonpartisan" },
          { name: "Jennifer Wu", party: "Nonpartisan" },
        ],
      },
      {
        type: "Referendum",
        referendumTitle: "Measure A — Affordable Housing Bond",
        referendumSubtitle: "Shall the City of San Jose issue $450 million in general obligation bonds to fund affordable housing construction and rehabilitation?",
        referendumProStatement: "Addresses critical housing shortage. Creates thousands of affordable units for working families, seniors, and veterans.",
        referendumConStatement: "Increases property taxes by approximately $19.60 per $100,000 of assessed value. Adds to existing city debt obligations.",
      },
      {
        type: "Referendum",
        referendumTitle: "Measure B — Parks and Recreation Funding",
        referendumSubtitle: "Shall the City authorize a 1/8-cent sales tax increase to fund park maintenance, recreational programs, and new green spaces?",
        referendumProStatement: "Invests in neighborhood parks and youth programs. All funds stay local with independent oversight.",
        referendumConStatement: "Sales tax increases disproportionately affect lower-income residents. City should prioritize existing revenue for parks.",
      },
      {
        type: "Referendum",
        referendumTitle: "Measure C — Police Oversight Commission",
        referendumSubtitle: "Shall the City Charter be amended to establish an independent Police Oversight Commission with subpoena power?",
        referendumProStatement: "Creates accountability and transparency in policing. Commission would have independent investigative authority.",
        referendumConStatement: "Duplicates existing oversight structures. Could interfere with active investigations and officer due process rights.",
      },
    ],
    state: [
      {
        name: "California",
        electionAdministrationBody: {
          name: "Santa Clara County Registrar of Voters",
          electionInfoUrl: "https://www.sccgov.org/rov",
          electionRegistrationUrl: "https://registertovote.ca.gov",
          absenteeVotingInfoUrl: "https://www.sccgov.org/rov/vbm",
        },
      },
    ],
  };
}

const MOCK_REPRESENTATIVES: Representative[] = [
  {
    name: "Ro Khanna",
    office: "U.S. Representative, CA-17",
    party: "Democratic Party",
    divisionId: "ocd-division/country:us/state:ca/cd:17",
    levels: ["country"],
    roles: ["legislatorLowerBody"],
    urls: ["https://example.com"],
    phones: ["(202) 555-0117"],
  },
  {
    name: "Alex Padilla",
    office: "U.S. Senator",
    party: "Democratic Party",
    divisionId: "ocd-division/country:us/state:ca",
    levels: ["country"],
    roles: ["legislatorUpperBody"],
    phones: ["(202) 555-0100"],
  },
  {
    name: "Matt Mahan",
    office: "Mayor of San Jose",
    party: "Nonpartisan",
    divisionId: "ocd-division/country:us/state:ca/place:san_jose",
    levels: ["locality"],
    roles: ["headOfGovernment"],
    phones: ["(408) 555-0199"],
  },
];

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get a list of upcoming elections
 *
 * @returns List of elections visible to the API
 */
export async function getElections(): Promise<Election[]> {
  if (!getApiKey()) return MOCK_ELECTIONS;
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
  if (!getApiKey()) return getMockVoterInfo(address);
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
  if (!getApiKey()) {
    return {
      kind: "civicinfo#representativeInfoResponse",
      normalizedInput: { line1: address, city: "San Jose", state: "CA", zip: "95112" },
      divisions: {},
      offices: MOCK_REPRESENTATIVES.map((r, i) => ({
        name: r.office,
        divisionId: r.divisionId,
        levels: r.levels,
        roles: r.roles,
        officialIndices: [i],
      })),
      officials: MOCK_REPRESENTATIVES.map((r) => ({
        name: r.name,
        party: r.party,
        phones: r.phones,
        urls: r.urls,
      })),
    };
  }
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
  if (!getApiKey()) return MOCK_REPRESENTATIVES;
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
