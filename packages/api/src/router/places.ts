import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { getAddressSuggestions } from "../lib/places";
import { publicProcedure } from "../trpc";

export const placesRouter = {
  /**
   * Autocomplete US address suggestions for a partial query, for the ballot
   * address lookup. Returns [] for queries shorter than 3 characters.
   */
  autocomplete: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      try {
        return await getAddressSuggestions(input.query);
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
} satisfies TRPCRouterRecord;
