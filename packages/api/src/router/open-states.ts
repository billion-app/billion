import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  getBillDetails as fetchBillDetails,
  getBills,
  getLegislators,
  getVotes,
} from "../clients/open-states";
import { publicProcedure } from "../trpc";

const stateCodeEnum = z.enum([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
  "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
  "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
  "dc",
]);

export const openStatesRouter = {
  searchBills: publicProcedure
    .input(
      z
        .object({
          stateCode: stateCodeEnum.default("ca"),
          query: z.string().optional(),
          session: z.string().optional(),
          page: z.number().min(1).default(1),
          perPage: z.number().min(1).max(50).default(20),
          classification: z.string().optional(),
          subject: z.string().optional(),
          sort: z
            .enum([
              "updated_desc",
              "updated_asc",
              "created_desc",
              "created_asc",
            ])
            .default("updated_desc"),
          includeAbstracts: z.boolean().default(true),
          includeSponsorships: z.boolean().default(true),
          includeActions: z.boolean().default(false),
          includeVersions: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        return await getBills({
          stateCode: input?.stateCode ?? "ca",
          query: input?.query,
          session: input?.session,
          page: input?.page,
          perPage: input?.perPage,
          classification: input?.classification,
          subject: input?.subject,
          sort: input?.sort,
          includeAbstracts: input?.includeAbstracts,
          includeSponsorships: input?.includeSponsorships,
          includeActions: input?.includeActions,
          includeVersions: input?.includeVersions,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to search bills",
          cause: error,
        });
      }
    }),

  getBillDetails: publicProcedure
    .input(
      z.object({
        billId: z.string().min(1, "Bill ID is required"),
        includeVersions: z.boolean().default(true),
        includeSponsorships: z.boolean().default(true),
        includeAbstracts: z.boolean().default(true),
        includeActions: z.boolean().default(true),
        includeDocuments: z.boolean().default(true),
        includeVotes: z.boolean().default(true),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await fetchBillDetails(input.billId, {
          includeVersions: input.includeVersions,
          includeSponsorships: input.includeSponsorships,
          includeAbstracts: input.includeAbstracts,
          includeActions: input.includeActions,
          includeDocuments: input.includeDocuments,
          includeVotes: input.includeVotes,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch bill details",
          cause: error,
        });
      }
    }),

  getLegislators: publicProcedure
    .input(
      z
        .object({
          stateCode: stateCodeEnum.default("ca"),
          district: z.string().optional(),
          name: z.string().optional(),
          party: z.string().optional(),
          orgClassification: z.enum(["upper", "lower"]).optional(),
          page: z.number().min(1).default(1),
          perPage: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      try {
        return await getLegislators({
          stateCode: input?.stateCode ?? "ca",
          district: input?.district,
          name: input?.name,
          party: input?.party,
          orgClassification: input?.orgClassification,
          page: input?.page,
          perPage: input?.perPage,
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch legislators",
          cause: error,
        });
      }
    }),

  getBillVotes: publicProcedure
    .input(
      z.object({
        billId: z.string().min(1, "Bill ID is required"),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getVotes(input.billId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch bill votes",
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;
