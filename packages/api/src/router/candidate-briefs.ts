import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, eq, inArray, sql } from "@acme/db";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
} from "@acme/db/schema";
import {
  californiaOfficeFamilySchema,
  candidateBriefIdentitySchema,
  candidateRaceManifestSchema,
} from "@acme/validators";

import type { PublishedCandidateRace } from "../lib/candidate-race-release";
import type { createTRPCContext } from "../trpc";
import {
  californiaCandidateCatalog,
  candidateInPublishedRace,
  CatalogCursorError,
  resolveRosterCandidate,
  rosterCandidateMetadata,
} from "../lib/california-catalog";
import { readCaliforniaCatalogStatuses } from "../lib/california-catalog-status";
import { getLatestPublicCaliforniaRoster } from "../lib/california-public-roster";
import { readCandidateRace } from "../lib/candidate-race-release";
import { activeResearchPolicy } from "../lib/candidate-research-store";
import {
  localizeCandidateCatalog,
  localizeCandidateRace,
} from "../lib/candidate-translation";
import { getCaliforniaGuide } from "../lib/civic";
import {
  guideResearchOfficeIds,
  resolveGuideCandidateResearch,
} from "../lib/guide-candidate-research";
import { publicProcedure } from "../trpc";

interface Policy {
  approved: boolean;
  version: string;
}
type PolicyInput =
  | Policy
  | ((
      database: Pick<
        Awaited<ReturnType<typeof createTRPCContext>>["db"],
        "select"
      >,
    ) => Promise<Policy>);
async function readReleases(
  database: Awaited<ReturnType<typeof createTRPCContext>>["db"],
  policyInput: PolicyInput,
  selection?: {
    releaseId?: string;
    identity?: Pick<
      z.infer<typeof candidateBriefIdentitySchema>,
      "contestId" | "jurisdiction" | "electionDate"
    >;
    electionDate?: string;
  },
): Promise<{ policy: Policy; races: PublishedCandidateRace[] }> {
  if (typeof policyInput !== "function" && !policyInput.approved)
    return { policy: policyInput, races: [] };
  return database.transaction(
    async (tx) => {
      const policy =
        typeof policyInput === "function" ? await policyInput(tx) : policyInput;
      if (!policy.approved) return { policy, races: [] };
      const latest = tx
        .select({
          id: CandidateRaceRelease.id,
          document: CandidateRaceRelease.document,
          revokedReason: CandidateRaceRelease.revokedReason,
          rank: sql<number>`row_number() over (
          partition by ${CandidateRaceRelease.document}->>'jurisdiction', ${CandidateRaceRelease.document}->>'electionDate', ${CandidateRaceRelease.document}->>'contestId'
          order by ${CandidateRaceRelease.createdAt} desc, ${CandidateRaceRelease.id} desc
        )`.as("race_rank"),
        })
        .from(CandidateRaceRelease)
        .as("latest_races");
      const stored = await tx
        .select()
        .from(latest)
        .where(
          and(
            eq(latest.rank, 1),
            selection?.releaseId
              ? eq(latest.id, selection.releaseId)
              : undefined,
            selection?.electionDate
              ? sql`${latest.document}->>'electionDate' = ${selection.electionDate}`
              : undefined,
            selection?.identity
              ? and(
                  sql`${latest.document}->>'contestId' = ${selection.identity.contestId}`,
                  sql`${latest.document}->>'jurisdiction' = ${selection.identity.jurisdiction}`,
                  sql`${latest.document}->>'electionDate' = ${selection.identity.electionDate}`,
                )
              : undefined,
          ),
        );
      const releases = [];
      for (const release of stored) {
        const parsed = candidateRaceManifestSchema.safeParse(release.document);
        if (!parsed.success) continue;
        releases.push({ ...release, document: parsed.data });
      }
      const ids = releases.flatMap((r) =>
        r.document.members.map((m) => m.revisionId),
      );
      if (!ids.length) return { policy, races: [] };
      const revisions = await tx
        .select()
        .from(CandidateBriefRevision)
        .where(inArray(CandidateBriefRevision.id, ids));
      const events = await tx
        .select()
        .from(CandidateBriefReviewEvent)
        .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
      const snapshots = new Map(
        await Promise.all(
          [
            ...new Set(
              releases.map((release) => release.document.electionDate),
            ),
          ].map(
            async (electionDate) =>
              [
                electionDate,
                await getLatestPublicCaliforniaRoster(tx, electionDate),
              ] as const,
          ),
        ),
      );
      const races = releases.flatMap((release) => {
        const snapshot = snapshots.get(release.document.electionDate);
        const target = snapshot?.races.find(
          (race) =>
            race.contestId === release.document.contestId &&
            race.jurisdiction === release.document.jurisdiction,
        );
        if (snapshot && !target) return [];
        const race = readCandidateRace({
          manifest: release.document,
          revokedReason: release.revokedReason,
          revisions,
          events,
          now: new Date().toISOString(),
          policy,
          ...(snapshot && target
            ? {
                currentRoster: {
                  snapshotId: snapshot.id,
                  rosterDigest: target.rosterDigest,
                  candidateIds: target.members.map(
                    (member) => member.candidateId,
                  ),
                  contestId: target.contestId,
                  electionDate: target.electionDate,
                  jurisdiction: target.jurisdiction,
                },
              }
            : {}),
        });
        return race ? [race] : [];
      });
      return { policy, races };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
/** Dependency is server-owned; no request parameter or environment flag can approve policy. */
export function createCandidateBriefsRouter(policyInput: PolicyInput) {
  return {
    catalog: publicProcedure
      .input(
        z.object({
          electionDate: z.iso.date(),
          query: z.string().trim().max(200).optional(),
          officeFamily: californiaOfficeFamilySchema.optional(),
          cursor: z.string().max(2000).optional(),
          limit: z.number().int().min(1).max(100).default(20),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { snapshot, races } = await readCaliforniaCatalogStatuses(
          ctx.db,
          policyInput,
          input.electionDate,
        );
        try {
          return californiaCandidateCatalog(snapshot, races, input);
        } catch (error) {
          if (error instanceof CatalogCursorError)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          throw error;
        }
      }),
    forCandidate: publicProcedure
      .input(
        z.object({
          identity: candidateBriefIdentitySchema,
          language: z.enum(["en", "es", "zh"]).default("en"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const snapshot = await getLatestPublicCaliforniaRoster(
          ctx.db,
          input.identity.electionDate,
        );
        const candidate = rosterCandidateMetadata(snapshot, input.identity);
        const { races } = await readReleases(ctx.db, policyInput, {
          identity: input.identity,
        });
        const race = candidateInPublishedRace(input.identity, races);
        if (!race)
          return {
            status: "unavailable" as const,
            reason: candidate
              ? ("not_published" as const)
              : ("identity_unresolved" as const),
            candidate,
          };
        return {
          status: "published" as const,
          candidate,
          identity: input.identity,
          releaseId: race.manifest.id,
          race: await localizeCandidateRace(race, input.language),
        };
      }),
    forBallotCandidate: publicProcedure
      .input(
        z.object({
          electionDate: z.iso.date(),
          name: z.string().trim().min(1).max(200),
          office: z.string().trim().min(1).max(200),
          jurisdiction: z.string().min(1).max(300),
          district: z.string().max(100).optional(),
          providerIdentity: z
            .object({
              provider: z.literal("democracy_works"),
              candidateId: z.string().max(200),
              contestId: z.string().max(200),
            })
            .optional(),
          language: z.enum(["en", "es", "zh"]).default("en"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const snapshot = await getLatestPublicCaliforniaRoster(
          ctx.db,
          input.electionDate,
        );
        const identity = resolveRosterCandidate(snapshot, input);
        if (!identity)
          return {
            status: "unavailable" as const,
            reason: "identity_unresolved" as const,
          };
        const { races } = await readReleases(ctx.db, policyInput, { identity });
        const race = candidateInPublishedRace(identity, races);
        if (!race)
          return {
            status: "unavailable" as const,
            reason: "not_published" as const,
          };
        return {
          status: "published" as const,
          identity,
          releaseId: race.manifest.id,
          race: await localizeCandidateRace(race, input.language),
        };
      }),
    forGuideCandidate: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          officeSlug: z.enum(
            Object.keys(guideResearchOfficeIds) as [
              keyof typeof guideResearchOfficeIds,
              ...(keyof typeof guideResearchOfficeIds)[],
            ],
          ),
          language: z.enum(["en", "es", "zh"]).default("en"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const guide = await getCaliforniaGuide();
        const { races } = await readReleases(ctx.db, policyInput, {
          identity: {
            contestId: `ca-sos:${guide?.electionDate}:${guideResearchOfficeIds[input.officeSlug]}`,
            jurisdiction: "ocd-division/country:us/state:ca",
            electionDate: guide?.electionDate ?? "",
          },
        });
        const resolution = resolveGuideCandidateResearch(guide, races, input);
        if (resolution.status !== "published") return resolution;
        return {
          ...resolution,
          race: await localizeCandidateRace(resolution.race, input.language),
        };
      }),
    listRaces: publicProcedure
      .input(
        z
          .object({ language: z.enum(["en", "es", "zh"]).default("en") })
          .optional(),
      )
      .query(async ({ ctx, input }) =>
        localizeCandidateCatalog(
          (await readReleases(ctx.db, policyInput)).races.map((race) => ({
            id: race.manifest.id,
            office: race.manifest.office,
            jurisdiction: race.manifest.jurisdictionLabel,
            electionDate: race.manifest.electionDate,
            candidateCount: race.manifest.members.length,
          })),
          input?.language ?? "en",
        ),
      ),
    race: publicProcedure
      .input(
        z.object({
          releaseId: z.uuid(),
          language: z.enum(["en", "es", "zh"]).default("en"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const race = (
          await readReleases(ctx.db, policyInput, {
            releaseId: input.releaseId,
          })
        ).races[0];
        return race ? localizeCandidateRace(race, input.language) : null;
      }),
    get: publicProcedure
      .input(
        candidateBriefIdentitySchema.extend({
          language: z.enum(["en", "es", "zh"]).default("en"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { policy, races } = await readReleases(ctx.db, policyInput, {
          identity: input,
        });
        const race = races.find(
          (r) =>
            r.manifest.contestId === input.contestId &&
            r.manifest.jurisdiction === input.jurisdiction &&
            r.manifest.electionDate === input.electionDate &&
            r.manifest.members.some((m) => m.candidateId === input.candidateId),
        );
        const display = race
          ? await localizeCandidateRace(race, input.language)
          : null;
        return {
          translationState: display?.translationState,
          status: race
            ? ("published" as const)
            : policy.approved
              ? ("unavailable" as const)
              : ("policy_pending" as const),
          brief:
            display?.briefs.find(
              (b) => b.identity.candidateId === input.candidateId,
            ) ?? null,
          coverage: {
            reviewedCandidates: race?.briefs.length ?? 0,
            rosterCandidates: race?.manifest.members.length ?? null,
            completeRace: !!race,
          },
        };
      }),
  };
}
export const candidateBriefsRouter =
  createCandidateBriefsRouter(activeResearchPolicy);
