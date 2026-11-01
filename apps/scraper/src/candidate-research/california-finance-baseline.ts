import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { ResearchDatabase } from "@acme/api/lib/candidate-research-store";
import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
} from "@acme/validators";
import {
  briefDigest,
  evidenceHashKey,
} from "@acme/api/lib/candidate-brief-publication";
import {
  researchAutomationPolicySchema,
  researchReviewAttestationSchema,
  validResearchAttestation,
} from "@acme/api/lib/candidate-research-attestation";
import {
  candidateBriefSchema,
  candidateRaceManifestSchema,
  candidateResearchCollectionSchema,
  deriveCandidateResearchQuality,
} from "@acme/validators";

import type { CaliforniaPublishedCoverage } from "./california.js";
import {
  californiaResearchVersion,
  validateBriefAgainstDossier,
  validateCaliforniaDossier,
} from "./california-dossier.js";
import { qualifyPublishedFinanceNarrative } from "./california-finance-refresh.js";

export interface CaliforniaReviewedNarrativeCoverage {
  snapshotId: string;
  races: CaliforniaPublishedCoverage["races"];
}
interface BaselineRelease {
  id: string;
  document: unknown;
  revokedReason: string | null;
  createdAt: Date;
}
interface BaselineReview {
  revisionId: string;
  action: string;
  actorId: string;
  policyVersion: string;
  attestation: unknown;
  createdAt: Date;
}
export function qualifyFinanceNarrativeBaseline(input: {
  release: BaselineRelease;
  collection: { id: string; document: unknown; failure: string | null };
  revisions: { id: string; document: unknown; revisionDigest: string }[];
  events: BaselineReview[];
  snapshotId: string;
  race: CaliforniaRaceTarget;
  policy: { approved: boolean; version: string; automation?: unknown };
  now: string;
}): CaliforniaPublishedCoverage["races"][number] | null {
  try {
    const { release, race, policy } = input;
    const manifest = candidateRaceManifestSchema.parse(release.document);
    const collection = candidateResearchCollectionSchema.parse(
      input.collection.document,
    );
    const automation = researchAutomationPolicySchema.parse(policy.automation);
    const now = Date.parse(input.now);
    if (
      !Number.isFinite(now) ||
      !policy.approved ||
      release.revokedReason !== null ||
      input.collection.failure ||
      manifest.id !== release.id ||
      manifest.collectionId !== input.collection.id ||
      manifest.policyVersion !== policy.version ||
      manifest.rosterSnapshotId !== input.snapshotId ||
      manifest.rosterDigest !== race.rosterDigest ||
      manifest.contestId !== race.contestId ||
      manifest.electionDate !== race.electionDate ||
      manifest.jurisdiction !== race.jurisdiction ||
      Date.parse(manifest.sourceCheckedAt) > now ||
      Date.parse(manifest.rosterVerifiedAt) > now ||
      release.createdAt.getTime() > now ||
      collection.problems.length ||
      collection.sources.some(
        (source) =>
          createHash("sha256").update(source.text).digest("hex") !==
            source.contentHash ||
          (source.binaryBase64 &&
            createHash("sha256")
              .update(Buffer.from(source.binaryBase64, "base64"))
              .digest("hex") !== source.byteHash),
      ) ||
      collection.researchVersion !== californiaResearchVersion ||
      automation.researchVersion !== californiaResearchVersion ||
      collection.rosterSnapshotId !== input.snapshotId ||
      collection.rosterDigest !== race.rosterDigest ||
      collection.manifest.policyVersion !== policy.version ||
      collection.manifest.contestId !== race.contestId ||
      collection.manifest.electionDate !== race.electionDate ||
      collection.manifest.jurisdiction !== race.jurisdiction ||
      manifest.members.length !== race.members.length ||
      race.members.some(
        (member) =>
          !manifest.members.some(
            (saved) =>
              saved.candidateId === member.candidateId &&
              saved.name === member.name &&
              saved.ballotStatus === member.ballotStatus,
          ),
      )
    )
      return null;
    const members = manifest.members.map((member) => {
      const revision = input.revisions.find(
        (entry) => entry.id === member.revisionId,
      );
      const brief = candidateBriefSchema.parse(revision?.document);
      const artifact = collection.candidateArtifacts?.find(
        (entry) => entry.candidateId === member.candidateId,
      );
      const dossier = validateCaliforniaDossier(artifact?.dossier);
      const bound = manifest.reviewedDossiers?.[member.candidateId];
      const quality = deriveCandidateResearchQuality(brief, dossier);
      if (
        !artifact ||
        !bound ||
        !quality ||
        brief.revisionId !== member.revisionId ||
        brief.identity.candidateId !== member.candidateId ||
        brief.identity.contestId !== race.contestId ||
        brief.identity.jurisdiction !== race.jurisdiction ||
        brief.identity.electionDate !== race.electionDate ||
        brief.evidence.some(
          (entry) =>
            manifest.currentHashes[
              evidenceHashKey(brief.identity, entry.id)
            ] !== entry.contentHash || Date.parse(entry.retrievedAt) > now,
        ) ||
        revision?.revisionDigest !== briefDigest(brief) ||
        !collection.briefs.some(
          (entry) =>
            entry.revisionId === member.revisionId &&
            briefDigest(entry) === briefDigest(brief),
        ) ||
        dossier.rosterDigest !== race.rosterDigest ||
        dossier.researchVersion !== californiaResearchVersion ||
        dossier.dossierDigest !== artifact.dossierDigest ||
        dossier.sourceSetDigest !== artifact.sourceSetDigest ||
        bound.dossierDigest !== dossier.dossierDigest ||
        bound.sourceSetDigest !== dossier.sourceSetDigest ||
        JSON.stringify(bound.quality) !== JSON.stringify(quality) ||
        dossier.sources.some(
          (source) =>
            !collection.sources.some(
              (saved) => JSON.stringify(saved) === JSON.stringify(source),
            ),
        )
      )
        throw new Error(
          "Historical narrative provenance does not match its immutable collection",
        );
      validateBriefAgainstDossier(brief, dossier);
      if (
        input.events.some(
          (event) =>
            event.revisionId === member.revisionId &&
            ["withdraw", "reject"].includes(event.action),
        )
      )
        throw new Error(
          "Historical narrative revision was rejected or withdrawn",
        );
      const event = input.events.find(
        (entry) =>
          entry.revisionId === member.revisionId &&
          entry.action === "approve" &&
          entry.policyVersion === policy.version &&
          entry.createdAt.getTime() <= now &&
          (entry.attestation as { collectionId?: string } | null)
            ?.collectionId === input.collection.id &&
          validResearchAttestation({
            value: entry.attestation,
            brief,
            policyVersion: policy.version,
            automation,
            dossier: { ...bound, quality },
            now: input.now,
          }),
      );
      const attestation = researchReviewAttestationSchema.parse(
        event?.attestation,
      );
      if (
        event?.actorId !== attestation.reviewer.actorId ||
        !isDeepStrictEqual(attestation.author, artifact.author) ||
        bound.authorRunId !== attestation.author.runId
      )
        throw new Error(
          "Historical narrative review does not match its author",
        );
      const retained = {
        candidateId: member.candidateId,
        revisionId: member.revisionId,
        collectionId: input.collection.id,
        brief,
        author: attestation.author,
        reviewer: attestation.reviewer,
      };
      if (
        !qualifyPublishedFinanceNarrative({
          member: retained,
          previousDossier: dossier,
          dossier,
          policyVersion: policy.version,
        })
      )
        throw new Error("Historical narrative cannot be retained");
      return retained;
    });
    return {
      contestId: race.contestId,
      jurisdiction: race.jurisdiction,
      electionDate: race.electionDate,
      releaseId: release.id,
      sourceCheckedAt: manifest.sourceCheckedAt,
      policyVersion: manifest.policyVersion,
      members,
    };
  } catch {
    return null;
  }
}

export async function readFinanceNarrativeBaselines(input: {
  database: ResearchDatabase;
  snapshot: CaliforniaRosterSnapshot;
  raceKeys: string[];
  policy: { approved: boolean; version: string; automation?: unknown };
  now: string;
}): Promise<CaliforniaReviewedNarrativeCoverage> {
  const { and, desc, eq, inArray, sql } = await import("@acme/db");
  const {
    CandidateRaceRelease,
    CandidateResearchCollection,
    CandidateBriefRevision,
    CandidateBriefReviewEvent,
  } = await import("@acme/db/schema");
  const { researchSourceDigest } =
    await import("@acme/api/lib/candidate-research-store");
  return input.database.transaction(
    async (tx) => {
      const selectedRaces = input.snapshot.races.filter((entry) =>
        input.raceKeys.includes(entry.raceKey),
      );
      if (!selectedRaces.length)
        return { snapshotId: input.snapshot.id, races: [] };
      const releases = await tx
        .select()
        .from(CandidateRaceRelease)
        .where(
          and(
            eq(
              sql`${CandidateRaceRelease.document}->>'electionDate'`,
              input.snapshot.electionDate,
            ),
            inArray(
              sql`${CandidateRaceRelease.document}->>'contestId'`,
              selectedRaces.map((race) => race.contestId),
            ),
          ),
        )
        .orderBy(
          desc(CandidateRaceRelease.createdAt),
          desc(CandidateRaceRelease.id),
        );
      const races: CaliforniaReviewedNarrativeCoverage["races"] = [];
      for (const race of selectedRaces) {
        const release = releases.find(
          (entry) =>
            entry.document.contestId === race.contestId &&
            entry.document.jurisdiction === race.jurisdiction,
        );
        if (
          !release ||
          release.revokedReason !== null ||
          !release.document.collectionId
        )
          continue;
        const [collection] = await tx
          .select()
          .from(CandidateResearchCollection)
          .where(
            eq(CandidateResearchCollection.id, release.document.collectionId),
          );
        if (!collection || collection.pilotKey !== race.raceKey) continue;
        if (
          release.document.sourceDigest !== collection.sourceDigest ||
          researchSourceDigest(collection.document) !== collection.sourceDigest
        )
          continue;
        const revisionIds = release.document.members.map(
          (member) => member.revisionId,
        );
        const [revisions, events] = await Promise.all([
          tx
            .select()
            .from(CandidateBriefRevision)
            .where(inArray(CandidateBriefRevision.id, revisionIds)),
          tx
            .select()
            .from(CandidateBriefReviewEvent)
            .where(inArray(CandidateBriefReviewEvent.revisionId, revisionIds))
            .orderBy(desc(CandidateBriefReviewEvent.createdAt)),
        ]);
        const qualified = qualifyFinanceNarrativeBaseline({
          ...input,
          race,
          release,
          collection,
          revisions,
          events,
          snapshotId: input.snapshot.id,
        });
        if (qualified) races.push(qualified);
      }
      return { snapshotId: input.snapshot.id, races };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
