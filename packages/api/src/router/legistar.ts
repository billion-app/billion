import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { legistar } from "../integrations/legistar";
import { publicProcedure } from "../trpc";

export const legistarRouter = {
  getLocalBills: publicProcedure.query(async () => {
    try {
      const [sanjose, santaclara] = await Promise.all([
        legistar.getLegislation("sanjose", {}).catch(() => []),
        legistar.getLegislation("santaclara", {}).catch(() => []),
      ]);

      const allBills = [
        ...sanjose.map((b) => ({ ...b, jurisdiction: "San Jose" as const })),
        ...santaclara.map((b) => ({
          ...b,
          jurisdiction: "Santa Clara County" as const,
        })),
      ];

      return allBills
        .sort(
          (a, b) =>
            new Date(b.MatterLastModifiedUtc).getTime() -
            new Date(a.MatterLastModifiedUtc).getTime(),
        )
        .slice(0, 10);
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch local bills",
        cause: error,
      });
    }
  }),
} satisfies TRPCRouterRecord;
