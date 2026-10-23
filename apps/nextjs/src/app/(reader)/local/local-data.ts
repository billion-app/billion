import "server-only";

import { cache } from "react";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createCaller } from "@acme/api";
import { db } from "@acme/db/client";

import { auth } from "~/auth/server";

export const localCaller = createCaller({
  authApi: auth.api,
  session: null,
  db,
});
export const getLocalCities = cache(() =>
  localCaller.legistar.listJurisdictions(),
);
export const getLocalDecision = cache(
  async (jurisdiction: string, id: string) => {
    if (!z.uuid().safeParse(id).success) return null;
    try {
      const decision = await localCaller.legistar.getDecision({ id });
      return decision.jurisdictionKey === jurisdiction ? decision : null;
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  },
);
