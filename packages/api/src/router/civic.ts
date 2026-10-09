import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { caSosResultsClient } from "../clients/ca-sos-results";
import { BallotProviderError } from "../clients/democracy-works";
import { getDevBallot } from "../lib/ballot-dev-mocks";
import { getBallotAvailability } from "../lib/ballot-launch";
import { getCandidateBackground } from "../lib/candidate-background";
import {
  getCaliforniaGuide,
  getDistrictElectionResults,
  getElectionResults,
  getElections,
  getVoterInfo,
} from "../lib/civic";
import { CivicReadUnavailableError } from "../lib/civic-read-guard";
import { getElectedOfficials } from "../lib/elected-officials";
import {
  publicPropositionConsequences,
  publishedPropositionConsequences,
} from "../lib/proposition-consequences";
import { publicProcedure } from "../trpc";

const STATEWIDE_OFFICE = z.enum(
  caSosResultsClient.STATEWIDE_OFFICES as [string, ...string[]],
);

const DISTRICT_CHAMBER = z.enum(
  caSosResultsClient.DISTRICT_CHAMBERS as [string, ...string[]],
);

const DISTRICT_REF = z.object({
  chamber: DISTRICT_CHAMBER,
  number: z.string().regex(/^\d+$/, "district number must be numeric"),
});

export const civicRouter = {
  /** Public release state; does not expose credentials or infer provider coverage. */
  getBallotAvailability: publicProcedure.query(() => getBallotAvailability()),
  /**
   * Cited biography from the shared candidate-enrichment cache. The same merge
   * runs for every named candidate: state, district, and county keep same-name
   * people apart. A miss stays empty. This is not a vote record.
   */
  getCandidateBackground: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        office: z.string().trim().min(1).max(200),
        state: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{2}$/)
          .optional(),
        district: z.string().trim().min(1).max(200).optional(),
        county: z.string().trim().min(1).max(200).optional(),
        party: z.string().trim().min(1).max(100).optional(),
        roles: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
        level: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
        electionYear: z.number().int().min(2000).max(2100),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getCandidateBackground({
          name: input.name,
          office: input.office,
          stateAbbrev: input.state,
          district: input.district,
          county: input.county,
          party: input.party,
          roles: input.roles,
          level: input.level,
          electionYear: input.electionYear,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch candidate background",
          cause: error,
        });
      }
    }),

  getCaliforniaGuide: publicProcedure.query(async () => {
    const guide = await getCaliforniaGuide();
    if (!guide) return null;
    return {
      ...guide,
      measures: guide.measures.map((measure) => ({
        ...measure,
        consequences: publicPropositionConsequences(
          publishedPropositionConsequences(guide.electionDate, measure),
        ),
      })),
    };
  }),

  /**
   * Get a list of upcoming elections
   */
  getElections: publicProcedure
    .input(z.object({ address: z.string().trim().min(1).max(300) }).optional())
    .query(async ({ input }) => {
      try {
        return await getElections(input?.address);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch elections",
          cause: error,
        });
      }
    }),

  /**
   * Get live California statewide election results (Secretary of State feed).
   * Defaults to the marquee races (governor + secretary of state) when no
   * offices are specified.
   */
  getElectionResults: publicProcedure
    .input(
      z
        .object({
          offices: z.array(STATEWIDE_OFFICE).min(1).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        return await getElectionResults(
          input?.offices as
            | Parameters<typeof getElectionResults>[0]
            | undefined,
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch election results",
          cause: error,
        });
      }
    }),

  /**
   * Get live results for specific district races (US House / State Senate /
   * State Assembly) on a voter's ballot. The caller supplies the district refs
   * derived from the ballot, so results are scoped to the voter.
   */
  getDistrictResults: publicProcedure
    .input(z.object({ refs: z.array(DISTRICT_REF).max(10) }))
    .query(async ({ input }) => {
      try {
        return await getDistrictElectionResults(
          input.refs as Parameters<typeof getDistrictElectionResults>[0],
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch district results",
          cause: error,
        });
      }
    }),

  /**
   * Get voter info (polling places, ballot info) for an address
   */
  getVoterInfo: publicProcedure
    .input(
      z.object({
        address: z.string().trim().min(1, "Address is required").max(300),
        electionId: z.string().max(100).optional(),
        includeEnrichment: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const mock = getDevBallot(input.address);
        if (mock) return mock;
        return await getVoterInfo(input.address, input.electionId, {
          includeEnrichment: input.includeEnrichment,
        });
      } catch (error) {
        throw new TRPCError({
          code:
            error instanceof CivicReadUnavailableError ||
            error instanceof BallotProviderError
              ? "SERVICE_UNAVAILABLE"
              : "INTERNAL_SERVER_ERROR",
          message:
            "Ballot information is temporarily unavailable. Please try again.",
          cause: error,
        });
      }
    }),

  /** Current federal and state lawmakers for a residential address. */
  getElectedOfficials: publicProcedure
    .input(z.object({ address: z.string().trim().min(5).max(300) }))
    .query(async ({ input }) => {
      try {
        return await getElectedOfficials(input.address);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch elected officials",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
