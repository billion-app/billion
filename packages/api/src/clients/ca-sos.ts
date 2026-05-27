/**
 * California Secretary of State Election Results API Client
 *
 * This client interfaces with the CA SOS API for election data.
 * API Documentation: https://calicodev.sos.ca.gov/
 *
 * Note: The production API (api.sos.ca.gov) requires subscription.
 * For development, this uses publicly available election data endpoints.
 */

// =============================================================================
// Types
// =============================================================================

/** California county codes and names */
export const CA_COUNTIES = {
  ALA: "Alameda",
  ALP: "Alpine",
  AMA: "Amador",
  BUT: "Butte",
  CAL: "Calaveras",
  CC: "Contra Costa",
  COL: "Colusa",
  DN: "Del Norte",
  ED: "El Dorado",
  FRE: "Fresno",
  GLE: "Glenn",
  HUM: "Humboldt",
  IMP: "Imperial",
  INY: "Inyo",
  KER: "Kern",
  KIN: "Kings",
  LAK: "Lake",
  LAS: "Lassen",
  LA: "Los Angeles",
  MAD: "Madera",
  MRN: "Marin",
  MPA: "Mariposa",
  MEN: "Mendocino",
  MER: "Merced",
  MOD: "Modoc",
  MNO: "Mono",
  MON: "Monterey",
  NAP: "Napa",
  NEV: "Nevada",
  ORA: "Orange",
  PLA: "Placer",
  PLU: "Plumas",
  RIV: "Riverside",
  SAC: "Sacramento",
  SBT: "San Benito",
  SBD: "San Bernardino",
  SD: "San Diego",
  SF: "San Francisco",
  SJ: "San Joaquin",
  SLO: "San Luis Obispo",
  SM: "San Mateo",
  SB: "Santa Barbara",
  SCL: "Santa Clara",
  SCR: "Santa Cruz",
  SHA: "Shasta",
  SIE: "Sierra",
  SIS: "Siskiyou",
  SOL: "Solano",
  SON: "Sonoma",
  STA: "Stanislaus",
  SUT: "Sutter",
  TEH: "Tehama",
  TRI: "Trinity",
  TUL: "Tulare",
  TUO: "Tuolumne",
  VEN: "Ventura",
  YOL: "Yolo",
  YUB: "Yuba",
} as const;

export type CountyCode = keyof typeof CA_COUNTIES;

/** Election types */
export type ElectionType =
  | "primary"
  | "general"
  | "special"
  | "recall"
  | "runoff";

/** Contest types */
export type ContestType =
  | "president"
  | "us_senate"
  | "us_house"
  | "governor"
  | "state_senate"
  | "state_assembly"
  | "proposition"
  | "local"
  | "judicial"
  | "other";

/** Election metadata */
export interface Election {
  id: string;
  name: string;
  date: string; // ISO date string
  type: ElectionType;
  isActive: boolean;
  isCertified: boolean;
  lastUpdated: string; // ISO datetime string
}

/** Candidate in a contest */
export interface Candidate {
  id: string;
  name: string;
  party?: string;
  isIncumbent: boolean;
  ballotDesignation?: string;
}

/** Contest (race) in an election */
export interface Contest {
  id: string;
  electionId: string;
  name: string;
  type: ContestType;
  district?: string;
  districtNumber?: number;
  candidates: Candidate[];
  isProposition: boolean;
  propositionNumber?: string;
}

/** Vote totals for a candidate/choice */
export interface VoteTotal {
  candidateId: string;
  candidateName: string;
  party?: string;
  votes: number;
  percentage: number;
}

/** Contest results */
export interface ContestResult {
  contestId: string;
  contestName: string;
  contestType: ContestType;
  totalVotes: number;
  precinctsReporting: number;
  precinctsTotal: number;
  percentReporting: number;
  results: VoteTotal[];
  lastUpdated: string;
}

/** County-level vote breakdown */
export interface CountyResult {
  countyCode: CountyCode;
  countyName: string;
  totalVotes: number;
  precinctsReporting: number;
  precinctsTotal: number;
  percentReporting: number;
  results: VoteTotal[];
}

/** Full contest results with county breakdown */
export interface ContestResultWithCounties extends ContestResult {
  countyResults: CountyResult[];
}

/** Reporting status for an election */
export interface ElectionStatus {
  electionId: string;
  electionName: string;
  lastUpdated: string;
  totalPrecinctsReporting: number;
  totalPrecincts: number;
  percentReporting: number;
  countiesReporting: number;
  totalCounties: number;
}

// =============================================================================
// Client Configuration
// =============================================================================

export interface CASOSClientConfig {
  /** API base URL - defaults to production */
  baseUrl?: string;
  /** API key if using authenticated endpoints */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

const DEFAULT_CONFIG: Required<CASOSClientConfig> = {
  baseUrl: "https://api.sos.ca.gov",
  apiKey: "",
  timeout: 30000,
};

// =============================================================================
// Client Implementation
// =============================================================================

export class CASOSClient {
  private config: Required<CASOSClientConfig>;

  constructor(config: CASOSClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Make an API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (this.config.apiKey) {
      headers["Ocp-Apim-Subscription-Key"] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new CASOSError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorText,
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ===========================================================================
  // Elections
  // ===========================================================================

  /**
   * Get list of all available elections
   */
  async getElections(): Promise<Election[]> {
    return this.request<Election[]>("/returns/elections");
  }

  /**
   * Get current/active election
   */
  async getCurrentElection(): Promise<Election | null> {
    const elections = await this.getElections();
    return elections.find((e) => e.isActive) ?? null;
  }

  /**
   * Get election by ID
   */
  async getElection(electionId: string): Promise<Election> {
    return this.request<Election>(`/returns/elections/${electionId}`);
  }

  /**
   * Get election status/reporting progress
   */
  async getElectionStatus(electionId: string): Promise<ElectionStatus> {
    return this.request<ElectionStatus>(`/returns/status/${electionId}`);
  }

  // ===========================================================================
  // Contests
  // ===========================================================================

  /**
   * Get all contests for an election
   */
  async getContests(electionId: string): Promise<Contest[]> {
    return this.request<Contest[]>(`/returns/contests/${electionId}`);
  }

  /**
   * Get contests filtered by type
   */
  async getContestsByType(
    electionId: string,
    type: ContestType,
  ): Promise<Contest[]> {
    const contests = await this.getContests(electionId);
    return contests.filter((c) => c.type === type);
  }

  /**
   * Get a specific contest
   */
  async getContest(electionId: string, contestId: string): Promise<Contest> {
    return this.request<Contest>(
      `/returns/contests/${electionId}/${contestId}`,
    );
  }

  // ===========================================================================
  // Results
  // ===========================================================================

  /**
   * Get results for all contests in an election
   */
  async getAllResults(electionId: string): Promise<ContestResult[]> {
    return this.request<ContestResult[]>(`/returns/results/${electionId}`);
  }

  /**
   * Get results for a specific contest
   */
  async getContestResults(
    electionId: string,
    contestId: string,
  ): Promise<ContestResult> {
    return this.request<ContestResult>(
      `/returns/results/${electionId}/${contestId}`,
    );
  }

  /**
   * Get results with county-level breakdown
   */
  async getContestResultsWithCounties(
    electionId: string,
    contestId: string,
  ): Promise<ContestResultWithCounties> {
    const [results, countyResults] = await Promise.all([
      this.getContestResults(electionId, contestId),
      this.getCountyResults(electionId, contestId),
    ]);

    return {
      ...results,
      countyResults,
    };
  }

  /**
   * Get county-level results for a contest
   */
  async getCountyResults(
    electionId: string,
    contestId: string,
  ): Promise<CountyResult[]> {
    return this.request<CountyResult[]>(
      `/returns/results/${electionId}/${contestId}/counties`,
    );
  }

  /**
   * Get results for a specific county in a contest
   */
  async getCountyResult(
    electionId: string,
    contestId: string,
    countyCode: CountyCode,
  ): Promise<CountyResult> {
    return this.request<CountyResult>(
      `/returns/results/${electionId}/${contestId}/counties/${countyCode}`,
    );
  }

  // ===========================================================================
  // Propositions
  // ===========================================================================

  /**
   * Get all propositions for an election
   */
  async getPropositions(electionId: string): Promise<Contest[]> {
    const contests = await this.getContests(electionId);
    return contests.filter((c) => c.isProposition);
  }

  /**
   * Get proposition results
   */
  async getPropositionResults(
    electionId: string,
    propositionNumber: string,
  ): Promise<ContestResult | null> {
    const props = await this.getPropositions(electionId);
    const prop = props.find((p) => p.propositionNumber === propositionNumber);
    if (!prop) return null;
    return this.getContestResults(electionId, prop.id);
  }

  // ===========================================================================
  // Statewide Races
  // ===========================================================================

  /**
   * Get presidential race results
   */
  async getPresidentialResults(
    electionId: string,
  ): Promise<ContestResult | null> {
    const contests = await this.getContestsByType(electionId, "president");
    const firstContest = contests[0];
    if (!firstContest) return null;
    return this.getContestResults(electionId, firstContest.id);
  }

  /**
   * Get gubernatorial race results
   */
  async getGovernorResults(electionId: string): Promise<ContestResult | null> {
    const contests = await this.getContestsByType(electionId, "governor");
    const firstContest = contests[0];
    if (!firstContest) return null;
    return this.getContestResults(electionId, firstContest.id);
  }

  /**
   * Get US Senate race results
   */
  async getUSSenateResults(electionId: string): Promise<ContestResult[]> {
    const contests = await this.getContestsByType(electionId, "us_senate");
    return Promise.all(
      contests.map((c) => this.getContestResults(electionId, c.id)),
    );
  }

  /**
   * Get US House race results for a specific district
   */
  async getUSHouseResults(
    electionId: string,
    district?: number,
  ): Promise<ContestResult[]> {
    const contests = await this.getContestsByType(electionId, "us_house");
    const filtered = district
      ? contests.filter((c) => c.districtNumber === district)
      : contests;
    return Promise.all(
      filtered.map((c) => this.getContestResults(electionId, c.id)),
    );
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Get the winning candidate for a contest
   */
  getWinner(result: ContestResult): VoteTotal | null {
    if (result.results.length === 0) return null;
    return result.results.reduce((max, curr) =>
      curr.votes > max.votes ? curr : max,
    );
  }

  /**
   * Check if a contest has been called (>50% reporting with clear lead)
   */
  isContestCalled(result: ContestResult, marginThreshold = 5): boolean {
    if (result.percentReporting < 50) return false;
    if (result.results.length < 2) return result.results.length === 1;

    const sorted = [...result.results].sort((a, b) => b.votes - a.votes);
    const first = sorted[0];
    const second = sorted[1];
    if (!first || !second) return true;
    const margin = first.percentage - second.percentage;
    return margin > marginThreshold;
  }

  /**
   * Get county name from code
   */
  getCountyName(code: CountyCode): string {
    return CA_COUNTIES[code];
  }

  /**
   * Get all county codes
   */
  getCountyCodes(): CountyCode[] {
    return Object.keys(CA_COUNTIES) as CountyCode[];
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class CASOSError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string,
  ) {
    super(message);
    this.name = "CASOSError";
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultClient: CASOSClient | null = null;

/**
 * Get the default CA SOS client instance
 */
export function getCASOSClient(config?: CASOSClientConfig): CASOSClient {
  if (!defaultClient || config) {
    defaultClient = new CASOSClient(config);
  }
  return defaultClient;
}

/**
 * Create a new CA SOS client instance
 */
export function createCASOSClient(config?: CASOSClientConfig): CASOSClient {
  return new CASOSClient(config);
}
