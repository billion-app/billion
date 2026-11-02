import { createHash, randomUUID } from "node:crypto";

import type { CandidateRaceManifest } from "@acme/validators";
import { and, desc, eq, inArray, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  CandidateBriefReviewEvent,
  CandidateBriefRevision,
  CandidateRaceRelease,
  CandidateResearchCollection,
  CandidateResearchPolicy,
} from "@acme/db/schema";
import {
  campaignFinanceSchema,
  candidateDossierSemanticProjection,
  candidateDossierSourceProjection,
  candidateEvidenceAttributionSchema,
  candidateEvidenceDossierSchema,
  candidateFinanceSemanticProjection,
  candidateModelAttestationSchema,
  candidateRaceManifestSchema,
  deriveCandidateResearchQuality,
} from "@acme/validators";

import type {
  ResearchDatabase,
  ResearchTransaction,
  ResearchWorkLease,
} from "./candidate-research-store";
import { verifyStoredCampaignContactProof } from "./california-campaign-contact";
import { assertCaliforniaSemanticReviewClear } from "./california-review-history";
import {
  campaignOwnershipDigest,
  validateCampaignOwnership,
} from "./campaign-ownership";
import { validateCampaignRenderSources } from "./campaign-render-archive";
import {
  briefDigest,
  briefIdentityKey,
  ResearchReviewCollectionConflict,
} from "./candidate-brief-publication";
import { readCandidateRace } from "./candidate-race-release";
import {
  researchAutomationPolicySchema,
  researchReviewAttestationSchema,
  validResearchAttestation,
} from "./candidate-research-attestation";
import {
  activeResearchPolicy,
  assertResearchWorkLease,
  lockPilot,
  lockResearchElection,
  lockResearchRace,
  researchSourceDigest,
  resolveCurrentResearchRoster,
} from "./candidate-research-store";

export async function currentResearchCollection(
  tx: ResearchTransaction,
  id: string,
) {
  const [selected] = await tx
    .select()
    .from(CandidateResearchCollection)
    .where(eq(CandidateResearchCollection.id, id));
  if (!selected) throw new Error("Unknown research collection");
  await lockResearchElection(tx, selected.document.manifest.electionDate);
  await lockPilot(tx, selected.pilotKey);
  await lockResearchRace(tx, selected.document.manifest);
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
    throw new Error("Collection was superseded; reload the latest sources");
  return latest;
}
function assertFresh(
  row: typeof CandidateResearchCollection.$inferSelect,
  now: Date,
) {
  if (
    row.failure ||
    row.document.problems.length ||
    now.getTime() - row.checkedAt.getTime() > 86_400_000 ||
    row.checkedAt > now
  )
    throw new Error("Sources are incomplete or stale");
}
async function currentRoster(
  tx: ResearchTransaction,
  document: (typeof CandidateResearchCollection.$inferSelect)["document"],
) {
  if (!document.rosterSnapshotId) return undefined;
  await lockPilot(tx, `roster:${document.manifest.electionDate}`);
  const roster = await resolveCurrentResearchRoster(tx, document.manifest);
  if (roster?.snapshotId !== document.rosterSnapshotId)
    throw new Error("Roster snapshot was superseded");
  if (roster.rosterDigest !== document.rosterDigest)
    throw new Error("Race roster changed");
  return roster;
}
export async function recordResearchAiReview(
  input: {
    collectionId: string;
    revisionId: string;
    attestation: unknown;
    workLease?: ResearchWorkLease;
    policy?: { approved: true; version: string; automation: unknown };
  },
  database: ResearchDatabase = db,
) {
  let attestation = researchReviewAttestationSchema.parse({
    ...researchReviewAttestationSchema.parse(input.attestation),
    collectionId: input.collectionId,
  });
  return database.transaction(async (tx) => {
    const row = await currentResearchCollection(tx, input.collectionId);
    await assertResearchWorkLease(tx, input.workLease, row.document);
    const now = new Date();
    assertFresh(row, now);
    await currentRoster(tx, row.document);
    const policy = input.policy ?? (await activeResearchPolicy(tx));
    const automation = researchAutomationPolicySchema.parse(policy.automation);
    const brief = row.document.briefs.find(
      (b) => b.revisionId === input.revisionId,
    );
    if (!brief) throw new Error("Revision is not in the current collection");
    const artifact = row.document.candidateArtifacts?.find(
      (a) => a.candidateId === brief.identity.candidateId,
    );
    if (!artifact) throw new Error("Missing immutable author artifact");
    const dossier = candidateEvidenceDossierSchema.parse(artifact.dossier);
    validateCampaignOwnership(dossier);
    validateCampaignRenderSources(
      dossier.sources,
      dossier.campaignOwnershipProof
        ? {
            candidateId: dossier.identity.candidateId,
            ownershipDigest: campaignOwnershipDigest(
              dossier.campaignOwnershipProof,
            ),
          }
        : undefined,
    );
    await verifyStoredCampaignContactProof(
      tx,
      row.document.rosterSnapshotId,
      dossier,
    );
    if (
      dossier.dossierDigest !== artifact.dossierDigest ||
      dossier.sourceSetDigest !== artifact.sourceSetDigest ||
      briefIdentityKey(dossier.identity) !== briefIdentityKey(brief.identity) ||
      dossier.sources.some(
        (source) =>
          !row.document.sources.some(
            (archived) =>
              archived.id === source.id &&
              archived.url === source.url &&
              archived.contentHash === source.contentHash &&
              archived.text === source.text &&
              archived.format === source.format &&
              (source.id !==
                dossier.campaignContactProof?.destinationSourceId ||
                JSON.stringify(archived.retrievalUrls ?? null) ===
                  JSON.stringify(source.retrievalUrls ?? null)) &&
              JSON.stringify(archived.acquisition ?? null) ===
                JSON.stringify(source.acquisition ?? null) &&
              (!(
                source.format === "image" ||
                source.acquisition !== undefined ||
                dossier.campaignOwnershipProof !== undefined
              ) ||
                (archived.byteHash === source.byteHash &&
                  archived.binaryBase64 === source.binaryBase64 &&
                  (!dossier.campaignOwnershipProof ||
                    (JSON.stringify(archived.httpObservation ?? null) ===
                      JSON.stringify(source.httpObservation ?? null) &&
                      JSON.stringify(archived.retrievalUrls ?? null) ===
                        JSON.stringify(source.retrievalUrls ?? null))))),
          ),
      )
    )
      throw new Error(
        "Author dossier does not match this candidate and archived source set",
      );
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    if (
      hash(candidateDossierSemanticProjection(dossier)) !==
        dossier.dossierDigest ||
      hash(candidateDossierSourceProjection(dossier.sources)) !==
        dossier.sourceSetDigest
    )
      throw new Error("Author dossier digest is invalid");
    if (
      JSON.stringify(
        candidateFinanceSemanticProjection(
          brief.research?.finance
            ? campaignFinanceSchema.parse(brief.research.finance)
            : null,
        ),
      ) !==
        JSON.stringify(
          candidateFinanceSemanticProjection(dossier.finance ?? null),
        ) ||
      dossier.rosterDigest !== row.document.rosterDigest ||
      dossier.researchVersion !== row.document.researchVersion ||
      dossier.evidence.some((entry) => {
        const source = dossier.sources.find((s) => s.id === entry.sourceId);
        return (
          !source?.text.includes(entry.excerpt) ||
          (entry.identityQualification === "official_roster" &&
            entry.role !== "roster") ||
          (dossier.officeKind !== "federal_legislative" &&
            entry.role === "finance" &&
            /(^|\.)fec\.gov$/.test(new URL(source.url).hostname))
        );
      }) ||
      brief.evidence.some(
        (entry) =>
          !dossier.evidence.some(
            (e) =>
              e.id === entry.id &&
              e.origin === entry.origin &&
              e.excerpt === entry.excerpt &&
              JSON.stringify(
                candidateEvidenceAttributionSchema
                  .optional()
                  .parse(entry.attribution),
              ) ===
                JSON.stringify(
                  candidateEvidenceAttributionSchema
                    .optional()
                    .parse(e.attribution),
                ) &&
              dossier.sources.some(
                (s) =>
                  s.id === e.sourceId &&
                  s.url === entry.url &&
                  s.contentHash === entry.contentHash,
              ),
          ),
      ) ||
      dossier.gaps.some(
        (gap) => gap.required && gap.code === "source_unavailable",
      )
    )
      throw new Error(
        "Dossier evidence does not support this exact brief and current roster",
      );
    const quality = deriveCandidateResearchQuality(brief, dossier);
    if (attestation.verdict === "approve" && !quality)
      throw new Error(
        "Candidate research requires substantive Record, Priorities or reconciled finance evidence",
      );
    attestation = researchReviewAttestationSchema.parse({
      ...attestation,
      quality: quality ?? undefined,
    });
    const author = candidateModelAttestationSchema.parse(artifact.author);
    if (JSON.stringify(author) !== JSON.stringify(attestation.author))
      throw new Error(
        "Review author provenance does not match persisted artifact",
      );
    if (
      attestation.verdict === "approve" &&
      !validResearchAttestation({
        value: attestation,
        brief,
        policyVersion: policy.version,
        automation,
        dossier: {
          ...artifact,
          authorRunId: author.runId,
          quality: quality ?? undefined,
        },
        now: now.toISOString(),
      })
    )
      throw new Error(
        "Independent review is not bound to the exact revision, dossier and policy",
      );
    if (
      attestation.reviewer.revisionDigest !== briefDigest(brief) ||
      attestation.reviewer.policyVersion !== policy.version
    )
      throw new Error("Review revision or policy does not match");
    if (attestation.verdict === "approve")
      await assertCaliforniaSemanticReviewClear(
        tx,
        {
          raceKey: row.pilotKey,
          candidateId: brief.identity.candidateId,
          dossierDigest: dossier.dossierDigest,
          sourceSetDigest: dossier.sourceSetDigest,
          policyVersion: policy.version,
          identity: brief.identity,
        },
        brief,
        artifact.author,
      );
    const reused = await tx
      .select()
      .from(CandidateBriefReviewEvent)
      .where(
        and(
          eq(CandidateBriefReviewEvent.revisionId, brief.revisionId),
          sql`${CandidateBriefReviewEvent.attestation}->'reviewer'->>'runId' = ${attestation.reviewer.runId}`,
        ),
      );
    if (
      reused.some(
        (event) =>
          (event.attestation as { collectionId?: string } | null)
            ?.collectionId !== row.id,
      )
    )
      throw new ResearchReviewCollectionConflict(
        row.id,
        brief.revisionId,
        attestation.reviewer.runId,
      );
    const prior = reused.find((event) => {
      const parsed = researchReviewAttestationSchema.safeParse(
        event.attestation,
      );
      return (
        parsed.success &&
        JSON.stringify(parsed.data) === JSON.stringify(attestation)
      );
    });
    if (prior) return { eventId: prior.id };
    const eventId = randomUUID();
    await tx.insert(CandidateBriefReviewEvent).values({
      id: eventId,
      revisionId: brief.revisionId,
      actorId: attestation.reviewer.actorId,
      action: attestation.verdict === "approve" ? "approve" : "reject",
      policyVersion: policy.version,
      reason: JSON.stringify(attestation.findings),
      createdAt: new Date(),
      attestation,
    });
    return { eventId };
  });
}
async function publishInTransaction(
  tx: ResearchTransaction,
  collectionId: string,
  actorId: string,
  policy: Awaited<ReturnType<typeof activeResearchPolicy>>,
  workLease?: ResearchWorkLease,
  cutover = false,
) {
  const row = await currentResearchCollection(tx, collectionId);
  if (!cutover) await assertResearchWorkLease(tx, workLease, row.document);
  const now = new Date();
  assertFresh(row, now);
  const roster = await currentRoster(tx, row.document);
  const automation =
    policy.automation == null
      ? null
      : researchAutomationPolicySchema.parse(policy.automation);
  if (row.document.candidateArtifacts && !automation)
    throw new Error(
      "Automated research requires an explicitly authorized automation policy",
    );
  if (
    automation &&
    (actorId !== automation.serviceActorId ||
      row.document.researchVersion !== automation.researchVersion ||
      !roster)
  )
    throw new Error(
      "Service actor, research version and current roster are required",
    );
  const reviewedDossiers = Object.fromEntries(
    (row.document.candidateArtifacts ?? []).map((a) => {
      const brief = row.document.briefs.find(
        (entry) => entry.identity.candidateId === a.candidateId,
      );
      const quality =
        brief &&
        deriveCandidateResearchQuality(
          brief,
          candidateEvidenceDossierSchema.parse(a.dossier),
        );
      if (!quality)
        throw new Error(
          "Candidate research requires substantive Record, Priorities or reconciled finance evidence",
        );
      return [
        a.candidateId,
        {
          dossierDigest: a.dossierDigest,
          sourceSetDigest: a.sourceSetDigest,
          authorRunId: candidateModelAttestationSchema.parse(a.author).runId,
          quality,
        },
      ];
    }),
  );
  const manifest: CandidateRaceManifest = {
    ...row.document.manifest,
    collectionId: row.id,
    id: randomUUID(),
    policyVersion: policy.version,
    sourceDigest: researchSourceDigest(row.document),
    rosterSnapshotId: row.document.rosterSnapshotId,
    rosterDigest: row.document.rosterDigest,
    reviewedDossiers,
    sourceCheckedAt: row.checkedAt.toISOString(),
    expiresAt: new Date(row.checkedAt.getTime() + 86_400_000).toISOString(),
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
      now: now.toISOString(),
      currentRoster: roster,
    })
  )
    throw new Error(
      "Policy and independent approval for every exact revision are required",
    );
  for (const artifact of row.document.candidateArtifacts ?? []) {
    const brief = row.document.briefs.find(
      (entry) => entry.identity.candidateId === artifact.candidateId,
    );
    if (!brief)
      throw new Error(
        "Missing candidate brief for final semantic history admission",
      );
    await assertCaliforniaSemanticReviewClear(
      tx,
      {
        raceKey: row.pilotKey,
        candidateId: artifact.candidateId,
        dossierDigest: artifact.dossierDigest,
        sourceSetDigest: artifact.sourceSetDigest,
        policyVersion: policy.version,
        identity: brief.identity,
      },
      brief,
      artifact.author,
    );
  }
  const [existing] = await tx
    .select()
    .from(CandidateRaceRelease)
    .where(
      and(
        sql`${CandidateRaceRelease.document}->>'contestId' = ${manifest.contestId}`,
        sql`${CandidateRaceRelease.document}->>'electionDate' = ${manifest.electionDate}`,
        sql`${CandidateRaceRelease.document}->>'jurisdiction' = ${manifest.jurisdiction}`,
      ),
    )
    .orderBy(
      desc(CandidateRaceRelease.createdAt),
      desc(CandidateRaceRelease.id),
    )
    .limit(1);
  if (
    existing &&
    !existing.revokedReason &&
    existing.document.policyVersion === policy.version &&
    existing.document.sourceDigest === manifest.sourceDigest &&
    JSON.stringify(existing.document.members) ===
      JSON.stringify(manifest.members)
  ) {
    await tx
      .update(CandidateRaceRelease)
      .set({ document: { ...manifest, id: existing.id } })
      .where(eq(CandidateRaceRelease.id, existing.id));
    return { releaseId: existing.id };
  }
  await tx
    .insert(CandidateRaceRelease)
    .values({ id: manifest.id, document: manifest });
  return { releaseId: manifest.id };
}
export async function publishResearchCollection(
  input: {
    collectionId: string;
    actorId: string;
    workLease?: ResearchWorkLease;
  },
  database: ResearchDatabase = db,
) {
  return database.transaction(async (tx) => {
    await lockPilot(tx, "policy");
    return publishInTransaction(
      tx,
      input.collectionId,
      input.actorId,
      await activeResearchPolicy(tx),
      input.workLease,
    );
  });
}
export async function publishResearchManifest(
  value: unknown,
  database: ResearchDatabase = db,
) {
  const manifest = candidateRaceManifestSchema.parse(value);
  const [row] = await database
    .select()
    .from(CandidateResearchCollection)
    .where(
      and(
        sql`${CandidateResearchCollection.document}->'manifest'->>'contestId' = ${manifest.contestId}`,
        sql`${CandidateResearchCollection.document}->'manifest'->>'electionDate' = ${manifest.electionDate}`,
        sql`${CandidateResearchCollection.document}->'manifest'->>'jurisdiction' = ${manifest.jurisdiction}`,
      ),
    )
    .orderBy(
      desc(CandidateResearchCollection.createdAt),
      desc(CandidateResearchCollection.id),
    )
    .limit(1);
  if (
    !row ||
    JSON.stringify(
      row.document.manifest.members
        .map((m) => [m.candidateId, m.revisionId, m.ballotStatus])
        .sort(),
    ) !==
      JSON.stringify(
        manifest.members
          .map((m) => [m.candidateId, m.revisionId, m.ballotStatus])
          .sort(),
      )
  )
    throw new Error("Manifest does not match the latest collected race");
  const policy = await activeResearchPolicy(database);
  if (policy.automation != null)
    throw new Error(
      "Automated publication requires the authorized service actor",
    );
  return publishResearchCollection(
    { collectionId: row.id, actorId: "trusted-operator" },
    database,
  );
}

export async function adoptResearchPolicy(
  input: {
    policy: {
      version: string;
      approvedBy: string;
      statement: string;
      automation?: unknown;
    };
    collectionIds: string[];
  },
  database: ResearchDatabase = db,
) {
  if (
    !input.policy.version.trim() ||
    !input.policy.approvedBy.trim() ||
    input.policy.statement.trim().length < 80
  )
    throw new Error("A versioned accountable policy decision is required");
  const automation =
    input.policy.automation == null
      ? null
      : researchAutomationPolicySchema.parse(input.policy.automation);
  return database.transaction(async (tx) => {
    await lockPilot(tx, "policy");
    const priorPolicy = await activeResearchPolicy(tx);
    let releases = await tx
      .selectDistinctOn([
        sql`${CandidateRaceRelease.document}->>'jurisdiction'`,
        sql`${CandidateRaceRelease.document}->>'electionDate'`,
        sql`${CandidateRaceRelease.document}->>'contestId'`,
      ])
      .from(CandidateRaceRelease)
      .orderBy(
        sql`${CandidateRaceRelease.document}->>'jurisdiction'`,
        sql`${CandidateRaceRelease.document}->>'electionDate'`,
        sql`${CandidateRaceRelease.document}->>'contestId'`,
        desc(CandidateRaceRelease.createdAt),
        desc(CandidateRaceRelease.id),
      );
    for (const electionDate of [
      ...new Set(releases.map((r) => r.document.electionDate)),
    ].sort())
      await lockResearchElection(tx, electionDate);
    if (releases.length)
      releases = await tx
        .select()
        .from(CandidateRaceRelease)
        .where(
          inArray(
            CandidateRaceRelease.id,
            releases.map((r) => r.id),
          ),
        );
    const currentlyLive: CandidateRaceManifest[] = [];
    for (const release of releases) {
      const ids = release.document.members.map((m) => m.revisionId);
      const revisions = await tx
        .select()
        .from(CandidateBriefRevision)
        .where(inArray(CandidateBriefRevision.id, ids));
      const events = await tx
        .select()
        .from(CandidateBriefReviewEvent)
        .where(inArray(CandidateBriefReviewEvent.revisionId, ids));
      if (
        readCandidateRace({
          manifest: release.document,
          revokedReason: release.revokedReason,
          revisions,
          events,
          policy: priorPolicy,
          now: new Date().toISOString(),
          currentRoster: await resolveCurrentResearchRoster(
            tx,
            release.document,
          ),
        })
      )
        currentlyLive.push(release.document);
    }
    const rows: (typeof CandidateResearchCollection.$inferSelect)[] = [];
    for (const id of [...new Set(input.collectionIds)].sort())
      rows.push(await currentResearchCollection(tx, id));
    const raceKey = (m: CandidateRaceManifest) =>
      JSON.stringify([m.jurisdiction, m.electionDate, m.contestId]);
    if (
      currentlyLive.some(
        (race) =>
          !rows.some((r) => raceKey(r.document.manifest) === raceKey(race)),
      )
    )
      throw new Error(
        "Policy cutover requires prepared replacements for every currently public race",
      );
    const policy = {
      approved: true,
      version: input.policy.version,
      automation,
    };
    const releaseIds = [];
    for (const row of rows)
      releaseIds.push(
        (
          await publishInTransaction(
            tx,
            row.id,
            automation?.serviceActorId ?? input.policy.approvedBy,
            policy,
            undefined,
            true,
          )
        ).releaseId,
      );
    await tx
      .insert(CandidateResearchPolicy)
      .values({ ...input.policy, automation });
    return { version: policy.version, releaseIds };
  });
}

export { researchAutomationPolicySchema } from "./candidate-research-attestation";
