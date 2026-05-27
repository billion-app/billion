import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type {
  CASOSClientConfig,
  ContestType,
  CountyCode,
} from "../clients/ca-sos";
import { CA_COUNTIES, createCASOSClient } from "../clients/ca-sos";
import { publicProcedure } from "../trpc";

// Schema for county code validation
const CountyCodeSchema = z.enum(
  Object.keys(CA_COUNTIES) as [CountyCode, ...CountyCode[]],
);

// Schema for contest type validation
const ContestTypeSchema = z.enum([
  "president",
  "us_senate",
  "us_house",
  "governor",
  "state_senate",
  "state_assembly",
  "proposition",
  "local",
  "judicial",
  "other",
] as const satisfies readonly ContestType[]);

// Check if CA SOS API is configured
function isConfigured(): boolean {
  return !!process.env.CA_SOS_API_KEY;
}

// Get client with optional API key from environment
function getClient(): ReturnType<typeof createCASOSClient> {
  const config: CASOSClientConfig = {};

  // Use API key from environment if available
  const apiKey = process.env.CA_SOS_API_KEY;
  if (apiKey) {
    config.apiKey = apiKey;
  }

  return createCASOSClient(config);
}

// Wrapper that returns null when API not configured
function withConfigCheck<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!isConfigured()) {
    return Promise.resolve(null);
  }
  return fn();
}

// Wrapper that returns empty array when API not configured
function withConfigCheckArray<T>(fn: () => Promise<T[]>): Promise<T[]> {
  if (!isConfigured()) {
    return Promise.resolve([]);
  }
  return fn();
}

export const electionsRouter = {
  // ==========================================================================
  // Elections
  // ==========================================================================

  /** Check if CA SOS API is configured */
  isConfigured: publicProcedure.query(() => isConfigured()),

  /** Get all available elections */
  list: publicProcedure.query(async () => {
    return withConfigCheckArray(() => getClient().getElections());
  }),

  /** Get current/active election */
  current: publicProcedure.query(async () => {
    return withConfigCheck(() => getClient().getCurrentElection());
  }),

  /** Get election by ID */
  byId: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheck(() => getClient().getElection(input.electionId));
    }),

  /** Get election status/reporting progress */
  status: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheck(() =>
        getClient().getElectionStatus(input.electionId),
      );
    }),

  // ==========================================================================
  // Contests
  // ==========================================================================

  /** Get all contests for an election */
  contests: publicProcedure
    .input(
      z.object({
        electionId: z.string(),
        type: ContestTypeSchema.optional(),
      }),
    )
    .query(async ({ input }) => {
      return withConfigCheckArray(() => {
        const client = getClient();
        if (input.type) {
          return client.getContestsByType(input.electionId, input.type);
        }
        return client.getContests(input.electionId);
      });
    }),

  /** Get a specific contest */
  contest: publicProcedure
    .input(
      z.object({
        electionId: z.string(),
        contestId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return withConfigCheck(() =>
        getClient().getContest(input.electionId, input.contestId),
      );
    }),

  /** Get all propositions for an election */
  propositions: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheckArray(() =>
        getClient().getPropositions(input.electionId),
      );
    }),

  // ==========================================================================
  // Results
  // ==========================================================================

  /** Get all results for an election */
  allResults: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheckArray(() =>
        getClient().getAllResults(input.electionId),
      );
    }),

  /** Get results for a specific contest */
  contestResults: publicProcedure
    .input(
      z.object({
        electionId: z.string(),
        contestId: z.string(),
        includeCounties: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input }) => {
      return withConfigCheck(() => {
        const client = getClient();
        if (input.includeCounties) {
          return client.getContestResultsWithCounties(
            input.electionId,
            input.contestId,
          );
        }
        return client.getContestResults(input.electionId, input.contestId);
      });
    }),

  /** Get county-level results for a contest */
  countyResults: publicProcedure
    .input(
      z.object({
        electionId: z.string(),
        contestId: z.string(),
        countyCode: CountyCodeSchema.optional(),
      }),
    )
    .query(async ({ input }) => {
      if (!isConfigured()) return input.countyCode ? null : [];
      const client = getClient();
      if (input.countyCode) {
        return client.getCountyResult(
          input.electionId,
          input.contestId,
          input.countyCode,
        );
      }
      return client.getCountyResults(input.electionId, input.contestId);
    }),

  // ==========================================================================
  // Statewide Races
  // ==========================================================================

  /** Get presidential race results */
  presidential: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheck(() =>
        getClient().getPresidentialResults(input.electionId),
      );
    }),

  /** Get gubernatorial race results */
  governor: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheck(() =>
        getClient().getGovernorResults(input.electionId),
      );
    }),

  /** Get US Senate race results */
  usSenate: publicProcedure
    .input(z.object({ electionId: z.string() }))
    .query(async ({ input }) => {
      return withConfigCheckArray(() =>
        getClient().getUSSenateResults(input.electionId),
      );
    }),

  /** Get US House race results */
  usHouse: publicProcedure
    .input(
      z.object({
        electionId: z.string(),
        district: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      return withConfigCheckArray(() =>
        getClient().getUSHouseResults(input.electionId, input.district),
      );
    }),

  /** Get proposition results */
  propositionResults: publicProcedure
    .input(
      z.object({
        electionId: z.string(),
        propositionNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return withConfigCheck(() =>
        getClient().getPropositionResults(
          input.electionId,
          input.propositionNumber,
        ),
      );
    }),

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /** Get list of California counties */
  counties: publicProcedure.query(() => {
    return Object.entries(CA_COUNTIES).map(([code, name]) => ({
      code: code as CountyCode,
      name,
    }));
  }),
} satisfies TRPCRouterRecord;
