import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import type { CandidateEvidenceDossier } from "@acme/validators";

import {
  authorCaliforniaBrief,
  californiaFinanceRefreshPromptVersion,
} from "./california-ai.js";
import {
  buildCaliforniaDossier,
  evidenceDigest,
} from "./california-dossier.js";
import { fixtureDossier } from "./california-dossier.test.js";
import {
  qualifyPublishedFinanceNarrative,
  refreshableUnusedDiscoverySource,
} from "./california-finance-refresh.js";

const output = () => ({
  priorities: {
    claims: [
      {
        kind: "promise",
        text: "Morgan Lee proposes funding public libraries.",
        evidenceIds: ["platform"],
        promiseDetails: null,
      },
    ],
  },
  record: { claims: [] },
  mechanisms: { claims: [] },
  effects: { claims: [] },
  tradeoffs: { claims: [] },
  unknowns: { claims: [] },
  terms: [{ term: "Libraries", plain: "Public libraries." }],
});
const model = (value: unknown) => ({
  output: value,
  configuredModel: "fixture",
  actualModel: "fixture",
  provider: "fixture",
  requestId: randomUUID(),
  usage: { inputTokens: 10, outputTokens: 10 },
  costUsd: null,
});
async function fixture() {
  const old = buildCaliforniaDossier({
    ...fixtureDossier(),
    officeKind: "federal_legislative",
  });
  const authored = await authorCaliforniaBrief(
    { dossier: old, policyVersion: "policy" },
    { invoke: async () => model(output()) },
  );
  const member = {
    candidateId: old.identity.candidateId,
    revisionId: authored.brief.revisionId,
    collectionId: "collection",
    brief: authored.brief,
    author: authored.attestation,
    reviewer: {
      ...authored.attestation,
      role: "reviewer" as const,
      actorId: "ai-service:reviewer:independent",
      runId: randomUUID(),
    },
  };
  const unavailable = {
    status: "unavailable" as const,
    reason: "Not filed.",
    evidenceIds: ["finance"],
  };
  const dossier = buildCaliforniaDossier({
    ...old,
    sources: [
      ...old.sources,
      {
        ...old.sources[0]!,
        id: "financial",
        url: "https://www.fec.gov/example",
      },
    ],
    evidence: [
      ...old.evidence,
      {
        ...old.evidence[0]!,
        id: "finance",
        sourceId: "financial",
        role: "finance",
        identityQualification: "exact_election_office",
      },
    ],
    finance: {
      committeeId: "C00592154",
      committeeName: "Committee",
      periodStart: "2025-01-01",
      periodEnd: "2026-10-14",
      currency: "USD",
      coverage: "partial",
      coverageNote: "Committee has no report.",
      updatedAt: old.createdAt,
      filingEvidenceIds: ["finance"],
      receipts: null,
      donors: [],
      donorCoverage: "unavailable",
      outsideSpending: null,
      observation: {
        schemaVersion: 1,
        summary: unavailable,
        donorSelection: unavailable,
        independentExpenditures: unavailable,
        filingStatus: unavailable,
      },
    },
  });
  return { old, dossier, member, authored };
}
test("published finance refresh preserves narrative and compiles current finance with fresh authorship", async () => {
  const { old, dossier, member } = await fixture();
  const retainedNarrative = qualifyPublishedFinanceNarrative({
    member,
    previousDossier: old,
    dossier,
    policyVersion: "policy",
  });
  assert(retainedNarrative);
  const calls: string[] = [];
  const refreshed = await authorCaliforniaBrief(
    { dossier, policyVersion: "policy", retainedNarrative },
    {
      invoke: async (call) => {
        calls.push(call.prompt);
        return model(output());
      },
    },
  );
  assert.deepEqual(
    refreshed.brief.sections.map((s) => s.claims),
    member.brief.sections.map((s) => s.claims),
  );
  assert.deepEqual(
    refreshed.brief.research?.terms,
    member.brief.research?.terms,
  );
  assert.deepEqual(refreshed.brief.research?.finance, dossier.finance);
  assert.equal(refreshed.brief.authorship?.kind, "generated");
  assert(refreshed.brief.authorship?.kind === "generated");
  assert.equal(
    refreshed.brief.authorship.promptVersion,
    californiaFinanceRefreshPromptVersion,
  );
  assert.equal(
    refreshed.attestation.promptVersion,
    californiaFinanceRefreshPromptVersion,
  );
  assert.notEqual(refreshed.attestation.runId, member.author.runId);
  assert(calls[0]?.includes('"retainedNarrative"'));
  assert(
    !refreshed.brief.research?.financeGap?.includes(
      "No campaign-finance record is presented",
    ),
  );
});
test("publication mismatches and changed nonfinancial context cannot qualify", async () => {
  const { old, dossier, member } = await fixture();
  const qualify = (
    overrides: Partial<Parameters<typeof qualifyPublishedFinanceNarrative>[0]>,
  ) =>
    qualifyPublishedFinanceNarrative({
      member,
      previousDossier: old,
      dossier,
      policyVersion: "policy",
      ...overrides,
    });
  assert.equal(
    qualify({ member: { ...member, revisionId: randomUUID() } }),
    undefined,
  );
  assert.equal(
    qualify({
      member: {
        ...member,
        author: { ...member.author, revisionDigest: "a".repeat(64) },
      },
    }),
    undefined,
  );
  assert.equal(qualify({ policyVersion: "other-policy" }), undefined);
  assert.equal(qualify({ member: { ...member, brief: null } }), undefined);
  const changed = buildCaliforniaDossier({
    ...dossier,
    evidence: dossier.evidence.map((e) =>
      e.id === "platform" ? { ...e, locator: "Changed context" } : e,
    ),
  });
  assert.equal(qualify({ dossier: changed }), undefined);
  const added = buildCaliforniaDossier({
    ...dossier,
    sources: [
      ...dossier.sources,
      {
        ...dossier.sources[0]!,
        id: "new-context",
        url: "https://example.org/new",
      },
    ],
  });
  assert.equal(qualify({ dossier: added }), undefined);
  const changedArchive = buildCaliforniaDossier({
    ...dossier,
    sources: dossier.sources.map((s) =>
      s.id === "official" ? { ...s, publisher: "Different publisher" } : s,
    ),
  });
  assert.equal(qualify({ dossier: changedArchive }), undefined);
});
test("acquisition time and publication run changes do not change semantic retention identity", async () => {
  const { old, dossier, member } = await fixture();
  const initial = qualifyPublishedFinanceNarrative({
    member,
    previousDossier: old,
    dossier,
    policyVersion: "policy",
  });
  assert(initial);
  const later: CandidateEvidenceDossier = buildCaliforniaDossier({
    ...dossier,
    createdAt: "2026-10-31T12:00:00.000Z",
    sources: dossier.sources.map((s) => ({
      ...s,
      fetchedAt: "2026-10-31T12:00:00.000Z",
    })),
  });
  const next = qualifyPublishedFinanceNarrative({
    member,
    previousDossier: old,
    dossier: later,
    policyVersion: "policy",
  });
  assert(next);
  assert.equal(initial.semanticDigest, next.semanticDigest);
  const fresh = await authorCaliforniaBrief(
    { dossier, policyVersion: "policy", retainedNarrative: initial },
    { invoke: async () => model(output()) },
  );
  const newMember = {
    ...member,
    revisionId: fresh.brief.revisionId,
    brief: fresh.brief,
    author: fresh.attestation,
    reviewer: {
      ...fresh.attestation,
      role: "reviewer" as const,
      actorId: "ai-service:reviewer:next",
      runId: randomUUID(),
    },
  };
  const again = qualifyPublishedFinanceNarrative({
    member: newMember,
    previousDossier: dossier,
    dossier: later,
    policyVersion: "policy",
  });
  assert(again);
  assert.equal(initial.semanticDigest, again.semanticDigest);
});
test("actual refresh model output cannot silently replace the retained narrative", async () => {
  const { old, dossier, member } = await fixture();
  const retainedNarrative = qualifyPublishedFinanceNarrative({
    member,
    previousDossier: old,
    dossier,
    policyVersion: "policy",
  });
  assert(retainedNarrative);
  const changed = output();
  changed.priorities.claims[0]!.text = "Morgan Lee proposes more libraries.";
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier, policyVersion: "policy", retainedNarrative },
      { invoke: async () => model(changed) },
    ),
    (error: unknown) =>
      error instanceof Error && error.name === "CaliforniaModelInvocationError",
  );
  const correction = {
    kind: "review_rejection" as const,
    previousBrief: member.brief,
    overallReason: "Repair this wording",
    findings: [
      { claimId: "priorities-1", supported: false, reason: "Repair wording" },
    ],
  };
  const repaired = await authorCaliforniaBrief(
    { dossier, policyVersion: "policy", retainedNarrative, correction },
    { invoke: async () => model(changed) },
  );
  assert.equal(
    repaired.brief.sections[0]?.claims[0]?.text,
    changed.priorities.claims[0]?.text,
  );
  assert.equal(
    repaired.attestation.revisionDigest,
    evidenceDigest(repaired.brief),
  );
});

test("uncited nonfinancial FEC archives remain part of the retention context", async () => {
  const { old, dossier, member } = await fixture();
  const added = buildCaliforniaDossier({
    ...dossier,
    sources: [
      ...dossier.sources,
      {
        ...dossier.sources[0]!,
        id: "unclassified-fec-context",
        url: "https://www.fec.gov/nonfinancial-context",
      },
    ],
  });
  assert.equal(
    qualifyPublishedFinanceNarrative({
      member,
      previousDossier: old,
      dossier: added,
      policyVersion: "policy",
    }),
    undefined,
  );
});
test("nested promise readings survive extraction and finance recompilation", async () => {
  const { old, dossier, member } = await fixture();
  const point = {
    title: "Libraries",
    text: "Morgan Lee proposes funding public libraries.",
    evidenceIds: ["platform"],
  };
  const details = {
    title: "Library proposal",
    brief: { change: point, authority: point, unknowns: point },
    benefits: [point],
    costs: [],
    affected: [],
    perspectives: [],
    steps: [],
    alternatives: [],
    unknowns: [point],
  };
  const narrative = {
    ...output(),
    priorities: {
      claims: [{ ...output().priorities.claims[0]!, promiseDetails: details }],
    },
  };
  const authored = await authorCaliforniaBrief(
    { dossier: old, policyVersion: "policy" },
    { invoke: async () => model(narrative) },
  );
  const base = {
    ...member,
    revisionId: authored.brief.revisionId,
    brief: authored.brief,
    author: authored.attestation,
    reviewer: {
      ...member.reviewer,
      revisionDigest: authored.attestation.revisionDigest,
    },
  };
  const retainedNarrative = qualifyPublishedFinanceNarrative({
    member: base,
    previousDossier: old,
    dossier,
    policyVersion: "policy",
  });
  assert(retainedNarrative);
  const refreshed = await authorCaliforniaBrief(
    { dossier, policyVersion: "policy", retainedNarrative },
    { invoke: async () => model(narrative) },
  );
  assert.deepEqual(
    refreshed.brief.research?.promises,
    authored.brief.research?.promises,
  );
});

test("normalized text tolerates transport metadata updates but rejects changed final destinations or content", async () => {
  const { old, dossier, member } = await fixture();
  const qualify = (current: CandidateEvidenceDossier) =>
    qualifyPublishedFinanceNarrative({
      member,
      previousDossier: old,
      dossier: current,
      policyVersion: "policy",
    });
  const transport = buildCaliforniaDossier({
    ...dossier,
    sources: dossier.sources.map((s) => ({
      ...s,
      byteHash: "b".repeat(64),
      retrievalUrls: [s.url],
    })),
  });
  assert(qualify(transport));
  const redirected = buildCaliforniaDossier({
    ...dossier,
    sources: dossier.sources.map((s) =>
      s.id === "official"
        ? { ...s, url: "https://other.example.org/roster" }
        : s,
    ),
  });
  assert.equal(qualify(redirected), undefined);
  const content = buildCaliforniaDossier({
    ...dossier,
    sources: dossier.sources.map((s) =>
      s.id === "official"
        ? {
            ...s,
            text: `${s.text} New substantive context.`,
            contentHash: createHash("sha256")
              .update(`${s.text} New substantive context.`)
              .digest("hex"),
          }
        : s,
    ),
  });
  assert.equal(qualify(content), undefined);
});

test("fresh unused discovery feeds may change while every cited, linked, official and binary source stays protected", async () => {
  const { old, dossier, member } = await fixture();
  const url = "https://news.example.org/feed";
  const archive = {
    id: `source-${createHash("sha256").update(url).digest("hex").slice(0, 24)}`,
    url,
    publisher: "news.example.org",
    format: "html" as const,
    text: "Old unrelated trending items.",
    contentHash: createHash("sha256")
      .update("Old unrelated trending items.")
      .digest("hex"),
    fetchedAt: old.createdAt,
  };
  for (const protectedBy of [
    "unused",
    "official",
    "link",
    "gap",
    "binary",
  ] as const) {
    const source =
      protectedBy === "official"
        ? {
            ...archive,
            url: "https://agency.gov/feed",
            publisher: "agency.gov",
          }
        : protectedBy === "binary"
          ? {
              ...archive,
              binaryBase64: Buffer.from("original archive").toString("base64"),
              byteHash: createHash("sha256")
                .update("original archive")
                .digest("hex"),
            }
          : archive;
    const sourceLinks =
      protectedBy === "link"
        ? [
            {
              fromSourceId: source.id,
              toSourceId: "official",
              url: old.sources[0]!.url,
              anchorText: "unrelated",
              relation: "official_contact" as const,
            },
          ]
        : old.sourceLinks;
    const gaps =
      protectedBy === "gap"
        ? [
            {
              dimension: "record" as const,
              code: "not_found_in_checked_sources" as const,
              message: "Bounded checked feed.",
              checkedSourceIds: [source.id],
              required: false,
            },
          ]
        : old.gaps;
    const previousDossier = buildCaliforniaDossier({
      ...old,
      sources: [...old.sources, source],
      sourceLinks,
      gaps,
    });
    const authored = await authorCaliforniaBrief(
      { dossier: previousDossier, policyVersion: "policy" },
      { invoke: async () => model(output()) },
    );
    const base = {
      ...member,
      revisionId: authored.brief.revisionId,
      brief: authored.brief,
      author: authored.attestation,
      reviewer: {
        ...authored.attestation,
        role: "reviewer" as const,
        actorId: member.reviewer.actorId,
        runId: member.reviewer.runId,
      },
    };
    const text = "Updated unrelated trending items.";
    const current = buildCaliforniaDossier({
      ...dossier,
      sources: [
        ...dossier.sources,
        {
          ...source,
          text,
          contentHash: createHash("sha256").update(text).digest("hex"),
        },
      ],
      sourceLinks,
      gaps,
    });
    const qualified = qualifyPublishedFinanceNarrative({
      member: base,
      previousDossier,
      dossier: current,
      policyVersion: "policy",
    });
    assert.equal(!!qualified, protectedBy === "unused", protectedBy);
  }
});

test("campaign contact destinations cannot become mutable unused discovery feeds", async () => {
  const { old } = await fixture();
  const url = "https://campaign.example.org/";
  const source = {
    ...old.sources[0]!,
    id: `source-${createHash("sha256").update(url).digest("hex").slice(0, 24)}`,
    url,
    publisher: "campaign.example.org",
  };
  const contactContext = {
    ...old,
    campaignContactProof: {
      kind: "historical_official_filing" as const,
      identity: old.identity,
      websiteUrl: url,
      destinationSourceId: source.id,
      retrievalUrls: [url],
      officialSource: {
        url: "https://example.gov/filing",
        contentHash: "a".repeat(64),
        fetchedAt: old.createdAt,
        locator: "Official filing",
        excerpt: "Campaign website",
        recordDigest: "b".repeat(64),
        officialRecordName: old.name,
      },
    },
  };
  assert.equal(refreshableUnusedDiscoverySource(contactContext, source), false);
});
