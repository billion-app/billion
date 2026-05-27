import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  getElections,
  getRepresentatives,
  getRepresentativesEnriched,
  getVoterInfo,
} from "../lib/civic";
import { publicProcedure } from "../trpc";

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
          error instanceof Error
            ? error.message
            : "Failed to fetch elections",
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

  /**
   * Get elected officials/representatives for an address
   */
  getRepresentatives: publicProcedure
    .input(
      z.object({
        address: z.string().min(1, "Address is required"),
        levels: z
          .array(
            z.enum([
              "country",
              "administrativeArea1",
              "administrativeArea2",
              "locality",
              "regional",
              "special",
              "subLocality1",
              "subLocality2",
            ]),
          )
          .optional(),
        roles: z
          .array(
            z.enum([
              "headOfState",
              "headOfGovernment",
              "deputyHeadOfGovernment",
              "governmentOfficer",
              "executiveCouncil",
              "legislatorUpperBody",
              "legislatorLowerBody",
              "highestCourtJudge",
              "judge",
              "schoolBoard",
              "specialPurposeOfficer",
            ]),
          )
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getRepresentatives(input.address, {
          levels: input.levels,
          roles: input.roles,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch representatives",
          cause: error,
        });
      }
    }),

  /**
   * Get representatives with office info merged (convenience endpoint)
   */
  getRepresentativesEnriched: publicProcedure
    .input(
      z.object({
        address: z.string().min(1, "Address is required"),
        levels: z
          .array(
            z.enum([
              "country",
              "administrativeArea1",
              "administrativeArea2",
              "locality",
              "regional",
              "special",
              "subLocality1",
              "subLocality2",
            ]),
          )
          .optional(),
        roles: z
          .array(
            z.enum([
              "headOfState",
              "headOfGovernment",
              "deputyHeadOfGovernment",
              "governmentOfficer",
              "executiveCouncil",
              "legislatorUpperBody",
              "legislatorLowerBody",
              "highestCourtJudge",
              "judge",
              "schoolBoard",
              "specialPurposeOfficer",
            ]),
          )
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getRepresentativesEnriched(input.address, {
          levels: input.levels,
          roles: input.roles,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch representatives",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
