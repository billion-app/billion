import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { getAddressSuggestions, getPlaceDetails } from "../lib/places";
import { publicProcedure } from "../trpc";

export const placesRouter = {
  /**
   * Autocomplete US address suggestions for a partial query, for the ballot
   * address lookup. Returns [] for queries shorter than 3 characters. Pass a
   * stable sessionToken across one address-entry to bundle billing.
   */
  autocomplete: publicProcedure
    .input(z.object({ query: z.string(), sessionToken: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        return await getAddressSuggestions(input.query, input.sessionToken);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch address suggestions",
          cause: error,
        });
      }
    }),

  /**
   * Resolve a placeId to its full formatted address and close the autocomplete
   * billing session. Returns null when running on the mock (no API key).
   */
  details: publicProcedure
    .input(
      z.object({ placeId: z.string(), sessionToken: z.string().optional() }),
    )
    .mutation(async ({ input }) => {
      try {
        return await getPlaceDetails(input.placeId, input.sessionToken);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch place details",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
