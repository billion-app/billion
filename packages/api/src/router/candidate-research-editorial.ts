import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { desc, eq, inArray } from "@acme/db";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
  CandidateResearchCollection,
  CandidateResearchEditor,
  CandidateResearchPolicy,
} from "@acme/db/schema";
import {
  candidateBriefSchema,
  candidateResearchCollectionSchema,
} from "@acme/validators";

import type { ResearchTransaction } from "../lib/candidate-research-store";
import {
  briefDigest,
  briefIdentityKey,
  evidenceHashKey,
} from "../lib/candidate-brief-publication";
import { readCandidateRace } from "../lib/candidate-race-release";
import {
  activeResearchPolicy,
  invalidateRace,
  lockPilot,
} from "../lib/candidate-research-store";
import { protectedProcedure } from "../trpc";

export const editorialProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const [role] = await ctx.db
      .select()
      .from(CandidateResearchEditor)
      .where(eq(CandidateResearchEditor.userId, ctx.session.user.id));
    if (!role)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Candidate research editor access required",
      });
    return next({ ctx: { ...ctx, editor: role } });
  },
);
async function currentCollection(tx: ResearchTransaction, id: string) {
  const [selected] = await tx
    .select()
    .from(CandidateResearchCollection)
    .where(eq(CandidateResearchCollection.id, id));
  if (!selected) throw new TRPCError({ code: "NOT_FOUND" });
  await lockPilot(tx, selected.pilotKey);
  const [latest] = await tx
    .select()
    .from(CandidateResearchCollection)
    .where(eq(CandidateResearchCollection.pilotKey, selected.pilotKey))
    .orderBy(
      desc(CandidateResearchCollection.createdAt),
      desc(CandidateResearchCollection.id),
    )
    .limit(1);
  if (latest?.id !== id)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Collection was superseded; reload the latest sources",
    });
  return latest;
}
const reason = z.string().trim().min(10).max(2000);
export const candidateResearchEditorialRouter = {
  list: editorialProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinctOn([CandidateResearchCollection.pilotKey])
      .from(CandidateResearchCollection)
      .orderBy(
        CandidateResearchCollection.pilotKey,
        desc(CandidateResearchCollection.createdAt),
        desc(CandidateResearchCollection.id),
      )
      .limit(50);
    const seen = new Set<string>();
    return {
      canPublish: ctx.editor.canPublish,
      policy: await activeResearchPolicy(ctx.db),
      collections: rows
        .filter((r) => {
          if (seen.has(r.pilotKey)) return false;
          seen.add(r.pilotKey);
          return true;
        })
        .map((r) => ({
          id: r.id,
          pilotKey: r.pilotKey,
          office: r.document.manifest.office,
          jurisdiction: r.document.manifest.jurisdictionLabel,
          candidates: r.document.briefs.length,
          checkedAt: r.checkedAt,
          failure: r.failure,
          problems: r.document.problems,
        })),
    };
  }),
  collection: editorialProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(CandidateResearchCollection)
        .where(eq(CandidateResearchCollection.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const ids = row.document.briefs.map((b) => b.revisionId);
      const events = await ctx.db
        .select()
        .from(CandidateBriefReviewEvent)
        .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
      return { ...row, events };
    }),
  preview: editorialProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(CandidateResearchCollection)
        .where(eq(CandidateResearchCollection.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        manifest: row.document.manifest,
        briefs: row.document.briefs,
        reviewedAt: row.checkedAt.toISOString(),
        failure: row.failure,
      };
    }),
  save: editorialProcedure
    .input(
      z.object({ collectionId: z.uuid(), brief: candidateBriefSchema, reason }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const row = await currentCollection(tx, input.collectionId);
        const prior = row.document.briefs.find(
          (b) =>
            briefIdentityKey(b.identity) ===
            briefIdentityKey(input.brief.identity),
        );
        if (input.brief.revisionId !== prior?.revisionId)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Draft identity or revision changed",
          });
        const brief = candidateBriefSchema.parse({
          ...input.brief,
          revisionId: randomUUID(),
          authorId: ctx.session.user.id,
          createdAt: new Date().toISOString(),
          supersedes: prior.revisionId,
          correction: {
            previousRevisionId: prior.revisionId,
            reason: input.reason,
          },
        });
        const briefs = row.document.briefs.map((b) =>
          b.revisionId === prior.revisionId ? brief : b,
        );
        const document = candidateResearchCollectionSchema.parse({
          ...row.document,
          briefs,
          manifest: {
            ...row.document.manifest,
            id: randomUUID(),
            members: row.document.manifest.members.map((m) =>
              m.revisionId === prior.revisionId
                ? { ...m, revisionId: brief.revisionId }
                : m,
            ),
            currentHashes: Object.fromEntries(
              briefs.flatMap((b) =>
                b.evidence.map((e) => [
                  evidenceHashKey(b.identity, e.id),
                  e.contentHash,
                ]),
              ),
            ),
          },
        });
        await tx.insert(CandidateBriefRevision).values({
          id: brief.revisionId,
          identityKey: briefIdentityKey(brief.identity),
          revisionDigest: briefDigest(brief),
          document: brief,
        });
        await invalidateRace(
          tx,
          document.manifest,
          "Editorial correction awaits independent approval",
        );
        const id = randomUUID();
        await tx.insert(CandidateResearchCollection).values({
          id,
          pilotKey: row.pilotKey,
          sourceDigest: row.sourceDigest,
          document,
          checkedAt: row.checkedAt,
          failure: row.failure,
        });
        return { collectionId: id };
      }),
    ),
  review: editorialProcedure
    .input(
      z.object({
        collectionId: z.uuid(),
        revisionId: z.uuid(),
        action: z.enum(["approve", "withdraw"]),
        policyVersion: z.string().trim().min(1).max(100),
        reason,
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const row = await currentCollection(tx, input.collectionId);
        const brief = row.document.briefs.find(
          (b) => b.revisionId === input.revisionId,
        );
        if (!brief) throw new TRPCError({ code: "NOT_FOUND" });
        if (input.action === "approve") {
          if (
            row.failure ||
            row.document.problems.length ||
            Date.now() - row.checkedAt.getTime() > 86_400_000
          )
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Refresh all sources successfully before approval",
            });
          if (brief.authorId === ctx.session.user.id)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "An independent editor must review this revision",
            });
        }
        await tx.insert(CandidateBriefReviewEvent).values({
          id: randomUUID(),
          revisionId: brief.revisionId,
          actorId: ctx.session.user.id,
          action: input.action,
          policyVersion: input.policyVersion,
          reason: input.reason,
        });
        if (input.action === "withdraw")
          await invalidateRace(tx, row.document.manifest, input.reason);
        return { revisionDigest: briefDigest(brief) };
      }),
    ),
  approvePolicy: editorialProcedure
    .input(
      z.object({
        version: z.string().trim().min(1).max(100),
        statement: z.string().trim().min(80).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.editor.canPublish) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db
        .insert(CandidateResearchPolicy)
        .values({ ...input, approvedBy: ctx.session.user.id });
      return { version: input.version };
    }),
  revokePolicy: editorialProcedure
    .input(z.object({ version: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.editor.canPublish) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db
        .update(CandidateResearchPolicy)
        .set({ revokedAt: new Date() })
        .where(eq(CandidateResearchPolicy.version, input.version));
      return { revoked: true };
    }),
  publish: editorialProcedure
    .input(z.object({ collectionId: z.uuid() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        if (!ctx.editor.canPublish) throw new TRPCError({ code: "FORBIDDEN" });
        const row = await currentCollection(tx, input.collectionId);
        if (
          row.failure ||
          row.document.problems.length ||
          Date.now() - row.checkedAt.getTime() > 86_400_000
        )
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Sources are incomplete or stale",
          });
        const policy = await activeResearchPolicy(tx);
        const manifest = {
          ...row.document.manifest,
          id: randomUUID(),
          policyVersion: policy.version,
          sourceCheckedAt: row.checkedAt.toISOString(),
          expiresAt: new Date(
            row.checkedAt.getTime() + 86_400_000,
          ).toISOString(),
        };
        const ids = manifest.members.map((m) => m.revisionId);
        const revisions = await tx
          .select()
          .from(CandidateBriefRevision)
          .where(inArray(CandidateBriefRevision.id, ids));
        const events = await tx
          .select()
          .from(CandidateBriefReviewEvent)
          .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
        if (
          !readCandidateRace({
            manifest,
            revokedReason: null,
            revisions,
            events,
            policy,
            now: new Date().toISOString(),
          })
        )
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Policy and independent approval for every exact revision are required",
          });
        await tx
          .insert(CandidateRaceRelease)
          .values({ id: manifest.id, document: manifest });
        return { releaseId: manifest.id };
      }),
    ),
};
