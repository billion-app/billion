import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { caSosResultsClient } from "../clients/ca-sos-results";
import {
  getDistrictElectionResults,
  getElectionResults,
  getElections,
  getVoterInfo,
} from "../lib/civic";
import { getElectedOfficials } from "../lib/elected-officials";
import { getTexasCurrentElectionData } from "../lib/texas-election-data";
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
  /**
   * Get a list of upcoming elections
   */
  getElections: publicProcedure.query(async () => {
    try {
      return await getElections();
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to fetch elections",
        cause: error,
      });
    }
  }),

  /**
   * Current-cycle Texas statewide election data from the persisted SOS/TLC
   * handoff. This intentionally exposes no historical browsing parameter.
   */
  getTexasCurrentElection: publicProcedure.query(async () => {
    try {
      return await getTexasCurrentElectionData();
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to read current Texas election data",
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
        address: z.string().min(1, "Address is required"),
        electionId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getVoterInfo(input.address, input.electionId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch voter info",
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
