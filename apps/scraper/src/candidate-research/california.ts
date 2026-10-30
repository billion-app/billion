import { createHash, randomUUID } from "node:crypto";
import { z } from "zod/v4";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  CandidateBrief,
  CandidateEvidenceDossier,
  CandidateModelAttestation,
  CandidateResearchCollectionDocument,
  ResearchSource,
} from "@acme/validators";
import { evidenceHashKey } from "@acme/api/lib/candidate-brief-publication";
import {
  candidateModelAttestationSchema,
  candidateResearchCollectionSchema,
  researchSourceSchema,
} from "@acme/validators";

import {
  authorCaliforniaBrief,
  californiaAuthorPromptVersion,
  californiaModelInput,
  CaliforniaModelInvocationError,
  californiaReviewerPromptVersion,
  configuredCaliforniaModels,
  reviewCaliforniaBrief,
} from "./california-ai.js";
import { appendReviewedClaritySanJoseRoster } from "./california-clarity.js";
import {
  californiaResearchVersion,
  evidenceDigest,
} from "./california-dossier.js";
import {
  CaliforniaBudgetReached,
  CaliforniaCitedSourceFailure,
  collectCaliforniaEvidence,
  fetchBoundedCaliforniaSource,
} from "./california-evidence.js";
import {
  appendReviewedSanJoseRoster,
  decodeCaliforniaRoster,
  refreshReviewedSanJoseRoster,
} from "./california-roster.js";

export interface CaliforniaBounds {
  maxRaces: number;
  maxCandidates: number;
  maxSourceRequests: number;
  maxModelCalls: number;
  maxInputTokens: number;
  maxSourceBytes: number;
  concurrency: number;
}
export interface CaliforniaWorkCheckpoint {
  collectionId?: string;
  releaseId?: string;
  sourceCheckedAt?: string;
  classification?: Record<string, "supported" | "evidence_gap">;
  dossierDigests?: Record<string, string>;
  candidateProvenance?: Record<
    string,
    {
      dossierDigest: string;
      classification: "supported" | "evidence_gap";
      sourceCheckedAt: string;
      revisionId?: string;
      author?: CandidateModelAttestation;
      reviewer?: CandidateModelAttestation;
      verdict?: "approve" | "reject";
    }
  >;
  reason?: string;
  attemptedAt?: string;
  rosterCheckArtifactKey?: string;
}
export interface CaliforniaPreparationPolicy {
  approved: true;
  version: string;
  automation: unknown;
  approvedBy: string;
  statement: string;
}
const preparationPolicySchema = z.object({
  approved: z.literal(true),
  version: z.string().trim().min(1).max(100),
  automation: z.unknown(),
  approvedBy: z.string().trim().min(1),
  statement: z.string().trim().min(80).max(4000),
});
export function parseCaliforniaPreparationPolicy(
  value: unknown,
): CaliforniaPreparationPolicy {
  return preparationPolicySchema.parse(value);
}
interface Lease {
  reviewEpoch: number;
  key: string;
  owner: string;
  generation: number;
  checkpoint: unknown;
}
export interface CaliforniaPublishedCoverage {
  snapshotId: string | null;
  races: {
    contestId: string;
    jurisdiction: string;
    electionDate: string;
    releaseId: string;
    sourceCheckedAt: string | null;
    policyVersion: string | null;
    members: {
      candidateId: string;
      revisionId: string;
      collectionId: string | null;
      author: CandidateModelAttestation | null;
      reviewer: CandidateModelAttestation | null;
    }[];
  }[];
}
export interface CaliforniaDependencies {
  now(): string;
  readPublishedCoverage(
    snapshotId: string,
    electionDate: string,
  ): Promise<CaliforniaPublishedCoverage>;
  modelConfigurationKey?: string;
  authorConfigurationKey?: string;
  reviewerConfigurationKey?: string;
  authorizedPolicy(policyVersion: string): Promise<boolean>;
  loadSnapshot(id: string): Promise<CaliforniaRosterSnapshot | null>;
  saveSnapshot(
    snapshot: CaliforniaRosterSnapshot,
    sourceEpoch?: { key: string; generation: number },
  ): Promise<unknown>;
  beginSourceCheck(
    electionDate: string,
  ): Promise<{ key: string; generation: number } | null>;
  fetchProof?: typeof fetchBoundedCaliforniaSource;
  fetchRoster(
    electionDate: string,
    budget?: { request(): void; bytes(amount: number): void },
  ): Promise<CaliforniaRosterSnapshot>;
  listWork(
    snapshotId: string,
  ): Promise<{ raceKey: string; status: string; checkpoint: unknown }[]>;
  claim(input: {
    snapshotId: string;
    raceKey: string;
    rosterDigest: string;
    policyVersion: string;
    researchVersion: string;
    owner: string;
    expectedSourceEpoch?: { key: string; generation: number };
  }): Promise<Lease | null>;
  checkpoint(
    lease: Lease,
    status: "pending" | "blocked" | "complete",
    value: CaliforniaWorkCheckpoint,
  ): Promise<boolean>;
  artifact(key: string): Promise<unknown | null>;
  saveArtifact(input: {
    key: string;
    kind: string;
    raceKey: string;
    candidateId?: string;
    document: unknown;
  }): Promise<unknown>;
  investigate(
    input: {
      snapshot: CaliforniaRosterSnapshot;
      race: CaliforniaRaceTarget;
      member: CaliforniaRaceTarget["members"][number];
      previousDossier?: CandidateEvidenceDossier;
    },
    budget: {
      request(): void;
      bytes(amount: number): void;
      discovery?(): void;
    },
  ): Promise<CandidateEvidenceDossier>;
  author: typeof authorCaliforniaBrief;
  review: typeof reviewCaliforniaBrief;
  saveCollection(
    document: CandidateResearchCollectionDocument,
    lease?: Lease,
  ): Promise<{ collectionId: string; changed: boolean }>;
  attest(input: {
    collectionId: string;
    revisionId: string;
    author: CandidateModelAttestation;
    review: Awaited<ReturnType<typeof reviewCaliforniaBrief>>;
    dossier: CandidateEvidenceDossier;
    workLease?: Lease;
  }): Promise<unknown>;
  publish(collectionId: string, lease: Lease): Promise<{ releaseId: string }>;
  fail(raceKey: string, reason: string, lease?: Lease): Promise<void>;
  invalidateElection(input: {
    electionDate: string;
    snapshotId?: string;
    reason: string;
  }): Promise<unknown>;
}
export async function fetchCaliforniaPlan(
  electionDate: string,
  budget?: { request(): void; bytes(amount: number): void },
): Promise<CaliforniaRosterSnapshot> {
  if (electionDate !== "2026-11-03")
    throw new Error(
      "No verified California roster adapter for this election date",
    );
  budget?.request();
  const response = await fetch("https://media.sos.ca.gov/media/C26GG.txt", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`SOS roster request failed (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SOS roster response has no body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.byteLength;
    try {
      budget?.bytes(part.value.byteLength);
    } catch (error) {
      await reader.cancel();
      throw error;
    }
    if (length > 2_000_000) {
      await reader.cancel();
      throw new Error("SOS roster exceeds byte budget");
    }
    chunks.push(part.value);
  }
  budget?.request();
  const certification = await fetchBoundedCaliforniaSource(
    "certified-roster",
    "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
    "California Secretary of State",
    "pdf",
    budget ?? { request() {}, bytes() {} },
  );
  return decodeCaliforniaRoster({
    bytes: Buffer.concat(chunks),
    fetchedAt: new Date().toISOString(),
    certification,
    electionDate,
  });
}
async function dependencies(
  preparationPolicy?: CaliforniaPreparationPolicy,
): Promise<CaliforniaDependencies> {
  const [
    { db },
    store,
    collection,
    service,
    { createResearchLibrary },
    { generateWebSearch },
  ] = await Promise.all([
    import("@acme/db/client"),
    import("@acme/api/lib/california-roster-store"),
    import("@acme/api/lib/candidate-research-store"),
    import("@acme/api/lib/candidate-research-service"),
    import("../research/library.js"),
    import("../utils/ai/provider.js"),
  ]);
  let configuredModels:
    | Awaited<ReturnType<typeof configuredCaliforniaModels>>
    | undefined;
  const sharedSources = new Map<string, Promise<ResearchSource>>();
  const legacyPilotSources = new Map<string, Promise<ResearchSource[]>>();
  const library = createResearchLibrary({
    namespace: "california-candidate-research-v1",
    discover: async (query) => {
      if (
        !["searxng", "tavily"].includes(
          process.env.SCRAPER_SEARCH_PROVIDER ?? "",
        )
      )
        throw new Error(
          "California discovery requires a bounded SearXNG or Tavily provider; hosted model search is not an uncounted call",
        );
      const result = await generateWebSearch(query);
      return {
        text: result.text,
        sources: result.sources
          .filter((source) => source.sourceType === "url")
          .map((source) => ({
            sourceType: "url" as const,
            url: source.url,
            title: source.title,
          })),
      };
    },
  });
  return {
    get authorConfigurationKey() {
      return configuredModels
        ? JSON.stringify(configuredModels.author)
        : undefined;
    },
    get reviewerConfigurationKey() {
      return configuredModels
        ? JSON.stringify(configuredModels.reviewer)
        : undefined;
    },
    readPublishedCoverage: async (snapshotId, electionDate) => {
      const [
        { readCaliforniaCatalogStatuses },
        { CandidateRaceRelease, CandidateBriefReviewEvent },
        { inArray, eq, and, desc, sql },
      ] = await Promise.all([
        import("@acme/api/lib/california-catalog-status"),
        import("@acme/db/schema"),
        import("@acme/db"),
      ]);
      const live = await readCaliforniaCatalogStatuses(
        db,
        collection.activeResearchPolicy,
        electionDate,
      );
      if (live.snapshot?.id !== snapshotId)
        return { snapshotId: live.snapshot?.id ?? null, races: [] };
      const releaseIds = live.races.map((race) => race.manifest.id);
      const revisionIds = live.races.flatMap((race) =>
        race.manifest.members.map((member) => member.revisionId),
      );
      if (!releaseIds.length)
        return { snapshotId: live.snapshot.id, races: [] };
      const [releases, reviews] = await Promise.all([
        db
          .select({
            id: CandidateRaceRelease.id,
            collectionId: sql<
              string | null
            >`${CandidateRaceRelease.document}->>'collectionId'`,
            checkedAt: sql<
              string | null
            >`${CandidateRaceRelease.document}->>'sourceCheckedAt'`,
            policyVersion: sql<
              string | null
            >`${CandidateRaceRelease.document}->>'policyVersion'`,
          })
          .from(CandidateRaceRelease)
          .where(inArray(CandidateRaceRelease.id, releaseIds)),
        db
          .select({
            revisionId: CandidateBriefReviewEvent.revisionId,
            policyVersion: CandidateBriefReviewEvent.policyVersion,
            collectionId: sql<
              string | null
            >`${CandidateBriefReviewEvent.attestation}->>'collectionId'`,
            author: sql<unknown>`${CandidateBriefReviewEvent.attestation}->'author'`,
            reviewer: sql<unknown>`${CandidateBriefReviewEvent.attestation}->'reviewer'`,
          })
          .from(CandidateBriefReviewEvent)
          .where(
            and(
              inArray(CandidateBriefReviewEvent.revisionId, revisionIds),
              eq(CandidateBriefReviewEvent.action, "approve"),
            ),
          )
          .orderBy(desc(CandidateBriefReviewEvent.createdAt)),
      ]);
      return {
        snapshotId: live.snapshot.id,
        races: live.races.map((race) => {
          const release = releases.find((row) => row.id === race.manifest.id);
          return {
            contestId: race.manifest.contestId,
            jurisdiction: race.manifest.jurisdiction,
            electionDate: race.manifest.electionDate,
            releaseId: race.manifest.id,
            sourceCheckedAt: release?.checkedAt ?? null,
            policyVersion: release?.policyVersion ?? null,
            members: race.manifest.members.map((member) => {
              const event = reviews.find(
                (row) =>
                  row.revisionId === member.revisionId &&
                  row.policyVersion === release?.policyVersion &&
                  row.collectionId === release?.collectionId,
              );
              const author = candidateModelAttestationSchema.safeParse(
                event?.author,
              );
              const reviewer = candidateModelAttestationSchema.safeParse(
                event?.reviewer,
              );
              return {
                candidateId: member.candidateId,
                revisionId: member.revisionId,
                collectionId: release?.collectionId ?? null,
                author: author.success ? author.data : null,
                reviewer: reviewer.success ? reviewer.data : null,
              };
            }),
          };
        }),
      };
    },
    now: () => new Date().toISOString(),
    authorizedPolicy: async (version) => {
      const policy =
        preparationPolicy ?? (await collection.activeResearchPolicy());
      const parsedAutomation = service.researchAutomationPolicySchema.safeParse(
        "automation" in policy ? policy.automation : null,
      );
      const automation = parsedAutomation.success
        ? parsedAutomation.data
        : null;
      if (
        !(
          policy.approved &&
          policy.version === version &&
          automation &&
          automation.serviceActorId === "california-research-service" &&
          automation.researchVersion === californiaResearchVersion
        )
      )
        return false;
      const models = await configuredCaliforniaModels();
      configuredModels = models;
      return (
        automation.allowedAuthorModels.includes(models.author.modelId) &&
        automation.allowedReviewerModels.includes(models.reviewer.modelId)
      );
    },
    loadSnapshot: async (id) =>
      id === "latest"
        ? store.getLatestCaliforniaRoster(db, "2026-11-03")
        : store.getCaliforniaRoster(db, id),
    saveSnapshot: (snapshot, sourceEpoch) =>
      store.saveCaliforniaRoster(db, snapshot, {
        expectedSourceEpoch: sourceEpoch,
      }),
    beginSourceCheck: (electionDate) =>
      store.beginCaliforniaSourceCheck(db, electionDate),
    fetchRoster: fetchCaliforniaPlan,
    listWork: (id) => store.listCaliforniaRaceWork(db, id),
    claim: (input) => store.claimCaliforniaRaceWork(db, input),
    checkpoint: (lease, status, value) =>
      store.saveCaliforniaRaceCheckpoint(db, {
        ...lease,
        status,
        checkpoint: value,
      }),
    artifact: (key) => store.getCaliforniaResearchArtifact(db, key),
    saveArtifact: (input) => store.saveCaliforniaResearchArtifact(db, input),
    investigate: async (input, budget) => {
      let supplementalSources: ResearchSource[] | undefined;
      if (
        preparationPolicy &&
        ["ca-house-17-2026", "ca-lieutenant-governor-2026"].includes(
          input.race.raceKey,
        )
      ) {
        let pending = legacyPilotSources.get(input.race.raceKey);
        if (!pending) {
          pending = (async () => {
            const legacyFetch = async (
              id: string,
              url: string,
              publisher: string,
              format: ResearchSource["format"],
              apiKey?: string,
            ) => {
              let source = sharedSources.get(url);
              if (!source) {
                budget.request();
                source = fetchBoundedCaliforniaSource(
                  id,
                  url,
                  publisher,
                  format,
                  budget,
                  apiKey,
                );
                sharedSources.set(url, source);
              }
              const fetched = await source;
              const text = fetched.text.split(
                "\nLinked source navigation (discovery only):\n",
              )[0]!;
              return {
                ...fetched,
                id,
                text,
                contentHash: createHash("sha256").update(text).digest("hex"),
              };
            };
            const collected =
              input.race.raceKey === "ca-house-17-2026"
                ? await (await import("./collect.js")).collectPilot(legacyFetch)
                : await (
                    await import("./statewide.js")
                  ).collectLieutenantGovernor(legacyFetch);
            return collected.sources;
          })();
          legacyPilotSources.set(input.race.raceKey, pending);
        }
        try {
          supplementalSources = await pending;
        } catch (error) {
          if (error instanceof CaliforniaBudgetReached) throw error;
          throw new RequiredCaliforniaSourceFailure(
            error instanceof Error
              ? error.message
              : "Existing pilot sources could not be refreshed for policy preparation",
          );
        }
      }
      return collectCaliforniaEvidence(
        { ...input, supplementalSources },
        {
          fetch: (id, url, publisher, format, apiKey) =>
            fetchBoundedCaliforniaSource(
              id,
              url,
              publisher,
              format,
              budget,
              apiKey,
            ),
          search: (query, discover) => library.search(query, discover),
          budget: {
            request: () => budget.request(),
            bytes: () => {},
            discovery: () => budget.discovery?.(),
          },
          now: () => new Date().toISOString(),
          sharedSources,
        },
      );
    },
    author: authorCaliforniaBrief,
    review: reviewCaliforniaBrief,
    saveCollection: (document, lease) =>
      collection.saveResearchCollection(document, db, {
        workLease: lease,
        stagedPolicyVersion: preparationPolicy?.version,
      }),
    attest: async (input) =>
      service.recordResearchAiReview({
        collectionId: input.collectionId,
        revisionId: input.revisionId,
        workLease: input.workLease,
        policy: preparationPolicy,
        attestation: {
          author: input.author,
          reviewer: input.review.attestation,
          verdict: input.review.verdict,
          findings: input.review.findings,
        },
      }),
    publish: (id, lease) =>
      service.publishResearchCollection({
        workLease: lease,
        collectionId: id,
        actorId: "california-research-service",
      }),
    invalidateElection: (input) =>
      collection.invalidateResearchElection(input, db),
    fail: (key, reason, lease) =>
      collection.failResearchRefresh(key, reason, db, { workLease: lease }),
  };
}
function positiveBounds(bounds: CaliforniaBounds) {
  for (const [key, value] of Object.entries(bounds))
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      (key === "concurrency" && value !== 1)
    )
      throw new Error(
        `Invalid ${key}; California worker currently uses one race lease at a time`,
      );
}
const localSourceLocation = z.object({
  url: z.url(),
  publisher: z.string().min(1),
  format: z.enum(["html", "pdf", "json", "text", "image"]),
});
const pdfLocalPlanManifest = z.object({
  roster: localSourceLocation,
  writeIns: localSourceLocation.optional(),
  proofSources: z.array(localSourceLocation).max(32),
  crosswalk: z.unknown(),
});
const clarityLocalPlanManifest = z.object({
  mode: z.literal("clarity"),
  definition: localSourceLocation,
  settings: localSourceLocation,
  currentVersion: localSourceLocation,
  proofSources: z.array(localSourceLocation).max(32),
  scopeCrosswalk: z.unknown(),
  identityCrosswalk: z.unknown(),
  historicalSources: z.array(researchSourceSchema).max(8).optional(),
});
const localPlanManifest = z.union([
  pdfLocalPlanManifest,
  clarityLocalPlanManifest,
]);
export async function plan(
  input: {
    electionDate: string;
    apply?: boolean;
    sanJoseManifest?: unknown;
    stateScopeOnly?: boolean;
    maxSourceBytes?: number;
  },
  provided?: CaliforniaDependencies,
) {
  const applyDeps = input.apply
    ? (provided ?? (await dependencies()))
    : undefined;
  const sourceEpoch = applyDeps
    ? await applyDeps.beginSourceCheck(input.electionDate)
    : null;
  const maxSourceBytes = input.maxSourceBytes ?? 100_000_000;
  if (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes <= 0)
    throw new Error("Invalid planning source byte bound");
  let bytes = 0;
  const budget = {
    request() {},
    bytes(amount: number) {
      bytes += amount;
      if (bytes > maxSourceBytes)
        throw new CaliforniaBudgetReached("planning source bytes");
    },
  };
  let snapshot = await (provided?.fetchRoster ?? fetchCaliforniaPlan)(
    input.electionDate,
    budget,
  );
  if (input.sanJoseManifest) {
    const manifest = localPlanManifest.parse(input.sanJoseManifest);
    const fetcher = provided?.fetchProof ?? fetchBoundedCaliforniaSource;
    const get = (id: string, location: z.infer<typeof localSourceLocation>) =>
      fetcher(id, location.url, location.publisher, location.format, budget);
    const proofSources: ResearchSource[] = [];
    for (const [index, location] of manifest.proofSources.entries())
      proofSources.push(await get(`san-jose-territory-${index}`, location));
    if ("mode" in manifest) {
      const currentVersion = await get(
        "san-jose-clarity-version",
        manifest.currentVersion,
      );
      const definition = await get(
        "san-jose-clarity-definition",
        manifest.definition,
      );
      const settings = await get(
        "san-jose-clarity-settings",
        manifest.settings,
      );
      snapshot = appendReviewedClaritySanJoseRoster(snapshot, {
        definition,
        settings,
        currentVersion,
        proofSources,
        scopeCrosswalk: manifest.scopeCrosswalk,
        identityCrosswalk: manifest.identityCrosswalk,
        historicalSources: manifest.historicalSources,
      });
    } else {
      const source = await get("san-jose-qualified-roster", manifest.roster);
      const writeInSource = manifest.writeIns
        ? await get("san-jose-qualified-write-ins", manifest.writeIns)
        : undefined;
      snapshot = appendReviewedSanJoseRoster(snapshot, {
        source,
        writeInSource,
        proofSources,
        crosswalk: manifest.crosswalk,
      });
    }
  }
  if (input.apply) {
    const deps = applyDeps!;
    const latest = await deps.loadSnapshot("latest");
    if (
      latest?.scope === "ca_sos_certified_and_san_jose" &&
      snapshot.scope === "ca_sos_certified" &&
      !input.stateScopeOnly
    )
      throw new Error(
        "A combined San José snapshot is active; provide its reviewed local manifest or explicitly select stateScopeOnly before replacing scope",
      );
    await deps.saveSnapshot(snapshot, sourceEpoch ?? undefined);
  }
  return {
    snapshotId: snapshot.id,
    scopeLabel: snapshot.scopeLabel,
    counts: {
      races: snapshot.races.length,
      candidates: snapshot.races.reduce(
        (total, race) => total + race.members.length,
        0,
      ),
    },
    countyCoverage: { enumerated: 0, total: snapshot.countyCoverage.length },
    localCoverage: snapshot.localCoverage ?? null,
    persisted: !!input.apply,
  };
}

function manifest(
  snapshot: CaliforniaRosterSnapshot,
  race: CaliforniaRaceTarget,
  briefs: CandidateBrief[],
  sources: ResearchSource[],
  policyVersion: string,
  now: string,
): CandidateResearchCollectionDocument {
  const currentHashes = Object.fromEntries(
    briefs.flatMap((brief) =>
      brief.evidence.map((entry) => [
        evidenceHashKey(brief.identity, entry.id),
        entry.contentHash,
      ]),
    ),
  );
  return candidateResearchCollectionSchema.parse({
    pilotKey: race.raceKey,
    researchVersion: californiaResearchVersion,
    manifest: {
      id: randomUUID(),
      contestId: race.contestId,
      electionDate: race.electionDate,
      jurisdiction: race.jurisdiction,
      jurisdictionLabel: race.jurisdictionLabel,
      office: race.office,
      rosterSourceUrl: race.rosterSourceUrl ?? snapshot.source.url,
      rosterHash: race.sourceProof?.contentHash ?? snapshot.source.textHash,
      rosterSnapshotId: snapshot.id,
      rosterDigest: race.rosterDigest,
      rosterVerifiedAt: snapshot.source.fetchedAt,
      rosterVerifiedBy: "ca-sos-certified-roster-decoder-v1",
      members: race.members.map((member) => ({
        candidateId: member.candidateId,
        revisionId: briefs.find(
          (brief) => brief.identity.candidateId === member.candidateId,
        )!.revisionId,
        name: member.name,
        description: null,
        ballotStatus: member.ballotStatus,
      })),
      policyVersion,
      sourceCheckedAt: now,
      expiresAt: new Date(Date.parse(now) + 86_400_000).toISOString(),
      currentHashes,
    },
    briefs,
    sources,
    problems: [],
  });
}
export async function reconcile(
  input: {
    snapshotId: string;
    policyVersion: string;
    bounds: CaliforniaBounds;
    includePilotRaces?: boolean;
    raceKeys?: string[];
    preparationPolicy?: CaliforniaPreparationPolicy;
  },
  provided?: CaliforniaDependencies,
) {
  positiveBounds(input.bounds);
  const deps = provided ?? (await dependencies(input.preparationPolicy));
  if (
    input.preparationPolicy &&
    (input.preparationPolicy.version !== input.policyVersion ||
      !input.preparationPolicy.approvedBy.trim() ||
      input.preparationPolicy.statement.trim().length < 80)
  )
    throw new Error(
      "Preparation requires the exact explicitly authorized versioned policy and accountable approver statement",
    );
  if (!(await deps.authorizedPolicy(input.policyVersion)))
    throw new Error(
      "An active explicit automation policy is required before research source or model work",
    );
  let snapshot = await deps.loadSnapshot(input.snapshotId);
  if (!snapshot)
    throw new Error(
      "Unknown California roster snapshot; run plan --apply first",
    );
  if (input.bounds.maxSourceRequests < 2)
    throw new Error(
      "At least two source requests are required for fresh roster validation",
    );
  const sourceEpoch = await deps.beginSourceCheck(snapshot.electionDate);
  const usage = {
    races: 0,
    candidates: 0,
    sourceRequests: 0,
    sourceBytes: 0,
    modelCalls: 0,
    inputTokenReservations: 0,
    actualInputTokens: 0 as number | null,
    actualOutputTokens: 0 as number | null,
    discoveryRequests: 0,
    costUsd: null as number | null,
  };
  const outcomes: {
    raceKey: string;
    status:
      | "published"
      | "prepared"
      | "blocked"
      | "pending"
      | "leased"
      | "current"
      | "legacy_pilot";
    reason?: string;
    releaseId?: string;
    collectionId?: string;
  }[] = [];
  const budget = {
    discovery() {
      usage.discoveryRequests++;
    },
    request() {
      if (usage.sourceRequests >= input.bounds.maxSourceRequests)
        throw new CaliforniaBudgetReached("source requests");
      usage.sourceRequests++;
    },
    bytes(amount: number) {
      usage.sourceBytes += amount;
      if (usage.sourceBytes > input.bounds.maxSourceBytes)
        throw new CaliforniaBudgetReached("source bytes");
    },
  };
  let fresh: CaliforniaRosterSnapshot;
  try {
    fresh = await deps.fetchRoster(snapshot.electionDate, budget);
    if (
      snapshot.scope === "ca_sos_certified_and_san_jose" &&
      fresh.scope === "ca_sos_certified"
    )
      fresh = await refreshReviewedSanJoseRoster(
        snapshot,
        fresh,
        async (id, url, publisher, format) => {
          budget.request();
          return fetchBoundedCaliforniaSource(
            id,
            url,
            publisher,
            format,
            budget,
          );
        },
      );
  } catch (error) {
    if (!(error instanceof CaliforniaBudgetReached))
      await deps.invalidateElection({
        electionDate: snapshot.electionDate,
        snapshotId: snapshot.id,
        reason:
          "Required authoritative roster or reviewed local source refresh failed",
      });
    throw error;
  }
  if (fresh.id !== snapshot.id) {
    await deps.saveSnapshot(fresh, sourceEpoch ?? undefined);
    await deps.invalidateElection({
      electionDate: snapshot.electionDate,
      snapshotId: fresh.id,
      reason:
        "Official roster changed; current snapshot reconciliation required",
    });
    throw new Error(`Official roster changed; reconcile snapshot ${fresh.id}`);
  }
  snapshot = fresh;
  const rosterCheckArtifactKey = `roster-check:${snapshot.id}:${sourceEpoch?.generation ?? "bootstrap"}`;
  await deps.saveArtifact({
    key: rosterCheckArtifactKey,
    kind: "roster_check",
    raceKey: "__roster_check__",
    document: {
      snapshotId: snapshot.id,
      checkedAt: deps.now(),
      sourceEpoch,
      sources: [
        {
          url: snapshot.source.url,
          contentHash: snapshot.source.textHash,
          fetchedAt: snapshot.source.fetchedAt,
        },
        {
          url: snapshot.certification.url,
          contentHash: snapshot.certification.textHash,
          fetchedAt: snapshot.certification.fetchedAt,
        },
        ...(snapshot.additionalSources ?? []).map((source) => ({
          url: source.url,
          contentHash: source.contentHash,
          byteHash: source.byteHash,
          fetchedAt: source.fetchedAt,
        })),
      ],
    },
  });

  const [work, liveCoverage] = await Promise.all([
    deps.listWork(snapshot.id),
    deps.readPublishedCoverage(snapshot.id, snapshot.electionDate),
  ]);
  const checkpoints = new Map(
    work.map((row) => [
      row.raceKey,
      row.checkpoint as CaliforniaWorkCheckpoint,
    ]),
  );
  const due = (race: CaliforniaRaceTarget) => {
    const checkpoint = checkpoints.get(race.raceKey);
    return checkpoint?.releaseId
      ? Date.parse(checkpoint.sourceCheckedAt ?? "1970-01-01")
      : Date.parse(checkpoint?.attemptedAt ?? "1970-01-01");
  };
  if (
    input.raceKeys?.some(
      (key) => !snapshot.races.some((race) => race.raceKey === key),
    )
  )
    throw new Error(
      "Requested race key is absent from the authoritative snapshot",
    );
  const selectedRaces = input.raceKeys?.length
    ? snapshot.races.filter((race) => input.raceKeys!.includes(race.raceKey))
    : snapshot.races;
  const races = [...selectedRaces].sort(
    (a, b) =>
      Number(!checkpoints.get(a.raceKey)?.releaseId) -
        Number(!checkpoints.get(b.raceKey)?.releaseId) ||
      due(a) - due(b) ||
      a.raceKey.localeCompare(b.raceKey),
  );
  const modelBudget = (
    dossier: CandidateEvidenceDossier,
    brief?: CandidateBrief,
  ) => {
    const { inputTokenReservation: estimate } = californiaModelInput({
      dossier,
      brief,
      policyVersion: input.policyVersion,
    });
    if (
      usage.modelCalls >= input.bounds.maxModelCalls ||
      usage.inputTokenReservations + estimate > input.bounds.maxInputTokens
    )
      throw new CaliforniaBudgetReached("model calls or input tokens");
    usage.modelCalls++;
    usage.inputTokenReservations += estimate;
  };
  for (const race of races) {
    if (
      !input.includePilotRaces &&
      ["ca-house-17-2026", "ca-lieutenant-governor-2026"].includes(race.raceKey)
    ) {
      outcomes.push({ raceKey: race.raceKey, status: "legacy_pilot" });
      continue;
    }
    const prior = checkpoints.get(race.raceKey);
    if (
      prior?.releaseId &&
      Date.parse(deps.now()) - Date.parse(prior.sourceCheckedAt ?? "") <
        12 * 60 * 60 * 1000
    ) {
      outcomes.push({
        raceKey: race.raceKey,
        status: "current",
        releaseId: prior.releaseId,
      });
      continue;
    }
    if (
      usage.races >= input.bounds.maxRaces ||
      usage.candidates + race.members.length > input.bounds.maxCandidates
    ) {
      outcomes.push({
        raceKey: race.raceKey,
        status: "pending",
        reason: "Run race or candidate bound reached",
      });
      continue;
    }
    const lease = await deps.claim({
      snapshotId: snapshot.id,
      raceKey: race.raceKey,
      rosterDigest: race.rosterDigest,
      policyVersion: input.policyVersion,
      researchVersion: californiaResearchVersion,
      owner: randomUUID(),
      expectedSourceEpoch: sourceEpoch ?? undefined,
    });
    if (!lease) {
      outcomes.push({ raceKey: race.raceKey, status: "leased" });
      continue;
    }
    usage.races++;
    let savedCollectionId: string | undefined;
    let dispatchedModelKey: string | undefined;
    const candidateProvenance: NonNullable<
      CaliforniaWorkCheckpoint["candidateProvenance"]
    > = {};
    try {
      const investigated: {
        dossier: CandidateEvidenceDossier;
        authored: Awaited<ReturnType<typeof authorCaliforniaBrief>>;
        reviewed: Awaited<ReturnType<typeof reviewCaliforniaBrief>>;
      }[] = [];
      for (const member of race.members) {
        usage.candidates++;
        const liveRace = liveCoverage.races.find(
          (current) =>
            current.contestId === race.contestId &&
            current.jurisdiction === race.jurisdiction &&
            current.electionDate === race.electionDate,
        );
        const previousDossierDigest =
          liveRace?.members.find(
            (current) => current.candidateId === member.candidateId,
          )?.author?.dossierDigest ??
          prior?.dossierDigests?.[member.candidateId];
        const previousDossier = previousDossierDigest
          ? ((await deps.artifact(
              `dossier:${previousDossierDigest}`,
            )) as CandidateEvidenceDossier | null)
          : null;
        const dossier = await deps.investigate(
          {
            snapshot,
            race,
            member,
            previousDossier: previousDossier ?? undefined,
          },
          budget,
        );
        candidateProvenance[member.candidateId] = {
          dossierDigest: dossier.dossierDigest,
          classification: dossier.classification,
          sourceCheckedAt: dossier.createdAt,
        };
        await deps.saveArtifact({
          key: `dossier:${dossier.dossierDigest}`,
          kind: "dossier",
          raceKey: race.raceKey,
          candidateId: member.candidateId,
          document: dossier,
        });
        if (
          dossier.gaps.some(
            (gap) =>
              gap.required &&
              ["source_unavailable", "identity_unresolved"].includes(gap.code),
          )
        )
          throw new RequiredCaliforniaSourceFailure(
            "Required candidate source or office authority remains unresolved",
          );
        const authorKey = `author:${evidenceDigest([dossier.dossierDigest, input.policyVersion, californiaResearchVersion, californiaAuthorPromptVersion, deps.authorConfigurationKey ?? deps.modelConfigurationKey ?? "fixture"])}`;
        let authored = (await deps.artifact(authorKey)) as Awaited<
          ReturnType<typeof authorCaliforniaBrief>
        > | null;
        if (!authored) {
          if (await deps.artifact(`dispatch:${authorKey}`))
            throw new Error(
              "An author invocation has an uncertain outcome; reconcile its persisted reservation before retrying",
            );
          modelBudget(dossier);
          await deps.saveArtifact({
            key: `dispatch:${authorKey}`,
            kind: "model_dispatch",
            raceKey: race.raceKey,
            candidateId: member.candidateId,
            document: { startedAt: deps.now(), costUsd: null },
          });
          dispatchedModelKey = authorKey;
          authored = await deps.author({
            dossier,
            policyVersion: input.policyVersion,
          });
          usage.actualInputTokens =
            usage.actualInputTokens === null ||
            authored.attestation.usage.inputTokens === null
              ? null
              : usage.actualInputTokens +
                authored.attestation.usage.inputTokens;
          usage.actualOutputTokens =
            usage.actualOutputTokens === null ||
            authored.attestation.usage.outputTokens === null
              ? null
              : usage.actualOutputTokens +
                authored.attestation.usage.outputTokens;
          authored = (await deps.saveArtifact({
            key: authorKey,
            kind: "author",
            raceKey: race.raceKey,
            candidateId: member.candidateId,
            document: authored,
          })) as typeof authored;
        }
        Object.assign(candidateProvenance[member.candidateId]!, {
          revisionId: authored.brief.revisionId,
          author: authored.attestation,
        });
        const reviewKey = `review:${evidenceDigest([authored.attestation.revisionDigest, dossier.dossierDigest, input.policyVersion, californiaReviewerPromptVersion, deps.reviewerConfigurationKey ?? deps.modelConfigurationKey ?? "fixture", lease.reviewEpoch])}`;
        let reviewed = (await deps.artifact(reviewKey)) as Awaited<
          ReturnType<typeof reviewCaliforniaBrief>
        > | null;
        if (!reviewed) {
          if (await deps.artifact(`dispatch:${reviewKey}`))
            throw new Error(
              "A reviewer invocation has an uncertain outcome; reconcile its persisted reservation before retrying",
            );
          modelBudget(dossier, authored.brief);
          await deps.saveArtifact({
            key: `dispatch:${reviewKey}`,
            kind: "model_dispatch",
            raceKey: race.raceKey,
            candidateId: member.candidateId,
            document: { startedAt: deps.now(), costUsd: null },
          });
          dispatchedModelKey = reviewKey;
          reviewed = await deps.review({
            brief: authored.brief,
            dossier,
            policyVersion: input.policyVersion,
            authorAttestation: authored.attestation,
          });
          usage.actualInputTokens =
            usage.actualInputTokens === null ||
            reviewed.attestation.usage.inputTokens === null
              ? null
              : usage.actualInputTokens +
                reviewed.attestation.usage.inputTokens;
          usage.actualOutputTokens =
            usage.actualOutputTokens === null ||
            reviewed.attestation.usage.outputTokens === null
              ? null
              : usage.actualOutputTokens +
                reviewed.attestation.usage.outputTokens;
          reviewed = (await deps.saveArtifact({
            key: reviewKey,
            kind: "review",
            raceKey: race.raceKey,
            candidateId: member.candidateId,
            document: reviewed,
          })) as typeof reviewed;
        }
        Object.assign(candidateProvenance[member.candidateId]!, {
          reviewer: reviewed.attestation,
          verdict: reviewed.verdict,
        });
        if (reviewed.verdict !== "approve")
          throw new Error(
            "Independent candidate content review rejected this exact revision",
          );
        investigated.push({ dossier, authored, reviewed });
      }
      const sourceMap = new Map<string, ResearchSource>([
        [
          "certified-roster",
          {
            id: "certified-roster",
            url: snapshot.certification.url,
            publisher: "California Secretary of State",
            format: "pdf",
            text: snapshot.certification.text,
            contentHash: snapshot.certification.textHash,
            fetchedAt: snapshot.certification.fetchedAt,
          },
        ],
      ]);
      const requiredRoster = snapshot.additionalSources?.find(
        (source) =>
          source.url === race.rosterSourceUrl &&
          source.contentHash === race.sourceProof?.contentHash,
      );
      if (requiredRoster) sourceMap.set(requiredRoster.id, requiredRoster);
      for (const item of investigated)
        for (const source of item.dossier.sources) {
          const existing = sourceMap.get(source.id);
          if (
            existing &&
            (existing.contentHash !== source.contentHash ||
              existing.url !== source.url ||
              existing.text !== source.text)
          )
            throw new Error(
              "Race collection includes inconsistent shared source generations",
            );
          sourceMap.set(source.id, source);
        }
      const document = manifest(
        snapshot,
        race,
        investigated.map((item) => item.authored.brief),
        [...sourceMap.values()],
        input.policyVersion,
        deps.now(),
      );
      document.rosterSnapshotId = snapshot.id;
      document.rosterDigest = race.rosterDigest;
      document.candidateArtifacts = investigated.map((item) => ({
        candidateId: item.dossier.identity.candidateId,
        dossierDigest: item.dossier.dossierDigest,
        sourceSetDigest: item.dossier.sourceSetDigest,
        author: item.authored.attestation,
        dossier: item.dossier,
      }));
      const saved = await deps.saveCollection(document, lease);
      savedCollectionId = saved.collectionId;
      for (const item of investigated)
        await deps.attest({
          collectionId: saved.collectionId,
          revisionId: item.authored.brief.revisionId,
          author: item.authored.attestation,
          review: item.reviewed,
          dossier: item.dossier,
          workLease: lease,
        });
      if (input.preparationPolicy) {
        await deps.checkpoint(lease, "complete", {
          collectionId: saved.collectionId,
          rosterCheckArtifactKey,
          candidateProvenance,
          sourceCheckedAt: document.manifest.sourceCheckedAt,
          dossierDigests: Object.fromEntries(
            investigated.map((item) => [
              item.dossier.identity.candidateId,
              item.dossier.dossierDigest,
            ]),
          ),
          classification: Object.fromEntries(
            investigated.map((item) => [
              item.dossier.identity.candidateId,
              item.dossier.classification,
            ]),
          ),
        });
        outcomes.push({
          raceKey: race.raceKey,
          status: "prepared",
          collectionId: saved.collectionId,
        });
        continue;
      }
      const release = await deps.publish(saved.collectionId, lease);
      const checkpoint = {
        collectionId: saved.collectionId,
        rosterCheckArtifactKey,
        candidateProvenance,
        releaseId: release.releaseId,
        sourceCheckedAt: document.manifest.sourceCheckedAt,
        dossierDigests: Object.fromEntries(
          investigated.map((item) => [
            item.dossier.identity.candidateId,
            item.dossier.dossierDigest,
          ]),
        ),
        classification: Object.fromEntries(
          investigated.map((item) => [
            item.dossier.identity.candidateId,
            item.dossier.classification,
          ]),
        ),
      };
      if (!(await deps.checkpoint(lease, "complete", checkpoint)))
        throw new Error("Race lease expired before completion checkpoint");
      outcomes.push({
        raceKey: race.raceKey,
        status: "published",
        releaseId: release.releaseId,
      });
    } catch (error) {
      if (
        error instanceof CaliforniaModelInvocationError &&
        dispatchedModelKey
      ) {
        await deps.saveArtifact({
          key: `failure:${dispatchedModelKey}`,
          kind: "model_failure",
          raceKey: race.raceKey,
          document: error.diagnostic,
        });
        usage.actualInputTokens =
          usage.actualInputTokens === null ||
          error.diagnostic.usage.inputTokens === null
            ? null
            : usage.actualInputTokens + error.diagnostic.usage.inputTokens;
        usage.actualOutputTokens =
          usage.actualOutputTokens === null ||
          error.diagnostic.usage.outputTokens === null
            ? null
            : usage.actualOutputTokens + error.diagnostic.usage.outputTokens;
      }
      const reason =
        error instanceof Error ? error.message : "Unknown research failure";
      const status =
        error instanceof CaliforniaBudgetReached ? "pending" : "blocked";
      if (
        error instanceof RequiredCaliforniaSourceFailure ||
        error instanceof CaliforniaCitedSourceFailure
      )
        await deps.fail(race.raceKey, reason, lease);
      await deps.checkpoint(lease, status, {
        ...prior,
        rosterCheckArtifactKey,
        collectionId: savedCollectionId ?? prior?.collectionId,
        candidateProvenance: {
          ...prior?.candidateProvenance,
          ...candidateProvenance,
        },
        dossierDigests: {
          ...prior?.dossierDigests,
          ...Object.fromEntries(
            Object.entries(candidateProvenance).map(([id, item]) => [
              id,
              item.dossierDigest,
            ]),
          ),
        },
        classification: {
          ...prior?.classification,
          ...Object.fromEntries(
            Object.entries(candidateProvenance).map(([id, item]) => [
              id,
              item.classification,
            ]),
          ),
        },
        attemptedAt: deps.now(),
        reason,
      });
      outcomes.push({ raceKey: race.raceKey, status, reason });
    }
  }
  return {
    snapshotId: snapshot.id,
    scopeLabel: snapshot.scopeLabel,
    usage,
    outcomes,
    prepared: outcomes.filter((item) => item.status === "prepared").length,
    completed: outcomes.filter((item) => item.status === "published").length,
    blocked: outcomes.filter((item) => item.status === "blocked").length,
    remaining: outcomes.filter((item) =>
      ["pending", "leased"].includes(item.status),
    ).length,
  };
}
export async function coverage(
  input: { snapshotId: string },
  provided?: CaliforniaDependencies,
) {
  const deps = provided ?? (await dependencies());
  const snapshot = await deps.loadSnapshot(input.snapshotId);
  if (!snapshot) throw new Error("Unknown California roster snapshot");
  const [work, published] = await Promise.all([
    deps.listWork(snapshot.id),
    deps.readPublishedCoverage(snapshot.id, snapshot.electionDate),
  ]);
  const byRace = new Map(work.map((row) => [row.raceKey, row]));
  const races = snapshot.races.map((race) => {
    const row = byRace.get(race.raceKey);
    const checkpoint = row?.checkpoint as CaliforniaWorkCheckpoint | undefined;
    const live = published.races.find(
      (current) =>
        current.contestId === race.contestId &&
        current.jurisdiction === race.jurisdiction &&
        current.electionDate === race.electionDate,
    );
    return {
      raceKey: race.raceKey,
      contestId: race.contestId,
      candidateIds: race.members.map((member) => member.candidateId),
      workStatus: row?.status ?? "pending",
      publicationStatus: live
        ? ("published" as const)
        : ("unavailable" as const),
      releaseId: live?.releaseId ?? null,
      sourceCheckedAt: live?.sourceCheckedAt ?? null,
      policyVersion: live?.policyVersion ?? null,
      checkpoint: row?.checkpoint ?? null,
      members: race.members.map((member) => {
        const actual = live?.members.find(
          (item) => item.candidateId === member.candidateId,
        );
        return {
          identity: member.identity,
          name: member.name,
          publicationStatus: actual
            ? ("published" as const)
            : ("unavailable" as const),
          releaseId: actual ? live!.releaseId : null,
          revisionId: actual?.revisionId ?? null,
          collectionId: actual?.collectionId ?? null,
          sourceCheckedAt: actual ? live!.sourceCheckedAt : null,
          classification:
            actual?.author?.dossierDigest &&
            actual.author.dossierDigest ===
              checkpoint?.dossierDigests?.[member.candidateId]
              ? (checkpoint?.classification?.[member.candidateId] ?? null)
              : null,
          dossierDigest: actual?.author?.dossierDigest ?? null,
          latestResearch: {
            ...checkpoint?.candidateProvenance?.[member.candidateId],
            collectionId: checkpoint?.collectionId ?? null,
            dossierDigest:
              checkpoint?.dossierDigests?.[member.candidateId] ?? null,
            classification:
              checkpoint?.classification?.[member.candidateId] ?? null,
          },
          author: actual?.author ?? null,
          reviewer: actual?.reviewer ?? null,
        };
      }),
    };
  });
  return {
    snapshotId: snapshot.id,
    scopeLabel: snapshot.scopeLabel,
    expected: {
      races: races.length,
      candidates: snapshot.races.reduce(
        (sum, race) => sum + race.members.length,
        0,
      ),
    },
    currentSnapshotId: published.snapshotId,
    published: {
      races: races.filter((race) => race.publicationStatus === "published")
        .length,
      candidates: races.reduce(
        (sum, race) =>
          sum +
          race.members.filter(
            (member) => member.publicationStatus === "published",
          ).length,
        0,
      ),
    },
    countyCoverage: snapshot.countyCoverage,
    localCoverage: snapshot.localCoverage ?? null,
    unresolvedLocalContests:
      snapshot.localCrosswalk?.entries
        .filter((entry) => entry.status === "pending")
        .map((entry) => ({
          sourceContestId: entry.sourceContestId,
          reason: entry.reason,
        })) ?? [],
    races,
  };
}
export const californiaResearch = { plan, reconcile, coverage };

class RequiredCaliforniaSourceFailure extends Error {}
