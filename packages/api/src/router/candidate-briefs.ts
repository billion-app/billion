import { candidateBriefIdentitySchema } from "@acme/validators";

import { publicProcedure } from "../trpc";

/** Deliberately closed until the editorial policy and reviewed race release exist. */
export const candidateBriefsRouter = {
  get: publicProcedure.input(candidateBriefIdentitySchema).query(() => ({
    status: "policy_pending" as const,
    brief: null,
    coverage: {
      reviewedCandidates: 0,
      rosterCandidates: null,
      completeRace: false,
    },
  })),
};
