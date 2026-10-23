import type { TRPCRouterRecord } from "@trpc/server";

import { getAppStoreRelease } from "../lib/app-store-release";
import { publicProcedure } from "../trpc";

export const appReleaseRouter = {
  latestIos: publicProcedure.query(() => getAppStoreRelease()),
} satisfies TRPCRouterRecord;
