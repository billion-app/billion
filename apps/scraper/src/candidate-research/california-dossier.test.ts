import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildCaliforniaDossier,
  validateCaliforniaDossier,
} from "./california-dossier.js";

export function fixtureDossier(candidateSpecific = true) {
  const text =
    "Official roster lists Morgan Lee for Assembly District 1. Morgan Lee proposes funding public libraries.";
  return buildCaliforniaDossier({
    identity: {
      candidateId: "ca-sos:2026-11-03:130000010000:1",
      contestId: "ca-sos:2026-11-03:130000010000",
      jurisdiction: "ocd-division/country:us/state:ca/sldl:1",
      electionDate: "2026-11-03",
    },
    name: "Morgan Lee",
    officeFamily: "state_assembly",
    officeKind: "state_legislative",
    rosterDigest: "a".repeat(64),
    researchVersion: "fixture-v1",
    createdAt: "2026-10-30T00:00:00.000Z",
    sources: [
      {
        id: "official",
        url: "https://example.ca.gov/roster",
        publisher: "California",
        format: "text",
        text,
        contentHash: createHash("sha256").update(text).digest("hex"),
        fetchedAt: "2026-10-30T00:00:00.000Z",
      },
    ],
    evidence: [
      {
        id: "roster",
        sourceId: "official",
        excerpt: "Official roster lists Morgan Lee for Assembly District 1.",
        locator: "District 1",
        origin: "primary_record",
        role: "roster",
        identityQualification: "official_roster",
      },
      ...(candidateSpecific
        ? [
            {
              id: "platform",
              sourceId: "official",
              excerpt: "Morgan Lee proposes funding public libraries.",
              locator: "Statement",
              origin: "candidate" as const,
              role: "candidate_statement" as const,
              identityQualification: "official_cross_link" as const,
            },
          ]
        : []),
    ],
    gaps: [],
  });
}

test("roster-only collection stays an evidence gap and candidate-specific archive supports research", () => {
  assert.equal(fixtureDossier(false).classification, "evidence_gap");
  assert.equal(fixtureDossier().classification, "supported");
});
test("wrong passages, hashes and roster-only identity research are rejected", () => {
  for (const mutate of [
    (d: ReturnType<typeof fixtureDossier>) => {
      d.evidence[1]!.excerpt = "Invented pledge";
    },
    (d: ReturnType<typeof fixtureDossier>) => {
      d.sources[0]!.contentHash = "b".repeat(64);
    },
    (d: ReturnType<typeof fixtureDossier>) => {
      d.evidence[1]!.identityQualification = "official_roster";
    },
  ]) {
    const dossier = fixtureDossier();
    mutate(dossier);
    assert.throws(() => validateCaliforniaDossier(dossier));
  }
});
test("fresh retrieval timestamps preserve semantic dossier identity", () => {
  const a = fixtureDossier();
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = a;
  input.createdAt = "2026-10-30T01:00:00.000Z";
  input.sources[0]!.fetchedAt = input.createdAt;
  const b = buildCaliforniaDossier(input);
  assert.equal(a.sourceSetDigest, b.sourceSetDigest);
  assert.equal(a.dossierDigest, b.dossierDigest);
});
test("state finance rejects federal FEC records", () => {
  const a = fixtureDossier();
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = a;
  input.sources[0]!.url = "https://www.fec.gov/data/candidate/H00000000/";
  input.evidence[1]!.role = "finance";
  assert.throws(() => buildCaliforniaDossier(input), /FEC/);
});

test("FEC mapping proof binds one actual archived index row and rejects unrelated or ambiguous rows", () => {
  const base = fixtureDossier();
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = base;
  input.officeKind = "federal_legislative";
  input.officeFamily = "us_house";
  input.identity.jurisdiction = "ocd-division/country:us/state:ca/cd:1";
  const row = {
    candidate_id: "H0CA01001",
    name: "LEE, MORGAN",
    office: "H",
    state: "CA",
    district: "01",
    cycles: [2026],
    election_years: [2026],
  };
  const build = (rows: unknown[]) => {
    const text = JSON.stringify({ results: rows });
    const contentHash = createHash("sha256").update(text).digest("hex");
    return buildCaliforniaDossier({
      ...input,
      sources: [
        ...input.sources,
        {
          id: "fec-index",
          url: "https://api.open.fec.gov/v1/candidates/",
          publisher: "Federal Election Commission",
          format: "json",
          text,
          contentHash,
          fetchedAt: input.createdAt,
        },
      ],
      financeIdentityProof: {
        candidateId: "H0CA01001",
        name: "LEE, MORGAN",
        office: "H",
        state: "CA",
        district: "1",
        cycle: 2026,
        sourceId: "fec-index",
        sourceHash: contentHash,
      },
    });
  };
  assert.equal(build([row]).financeIdentityProof!.candidateId, "H0CA01001");
  assert.throws(
    () => build([{ ...row, state: "NY" }]),
    /archived official index row/,
  );
  assert.throws(
    () => build([{ ...row, cycles: [2024] }]),
    /archived official index row/,
  );
  assert.throws(() => build([row, row]), /archived official index row/);
  assert.throws(
    () => build([{ ...row, candidate_id: "H0CA01002" }]),
    /archived official index row/,
  );
});

test("campaign discovery links bind archived anchor text and the same verified origin", () => {
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = fixtureDossier();
  input.sources[0]!.text += " Campaign issues";
  input.sources[0]!.contentHash = createHash("sha256")
    .update(input.sources[0]!.text)
    .digest("hex");
  const child = {
    ...input.sources[0]!,
    id: "issues",
    url: "https://example.ca.gov/issues",
  };
  const link = {
    fromSourceId: "official",
    toSourceId: "issues",
    url: child.url,
    anchorText: "Campaign issues",
    relation: "same_origin_campaign" as const,
  };
  const valid = {
    ...input,
    sources: [...input.sources, child],
    sourceLinks: [link],
  };
  assert.equal(buildCaliforniaDossier(valid).sourceLinks!.length, 1);
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...valid,
        sourceLinks: [{ ...link, anchorText: "Invented link" }],
      }),
    /anchor text/,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...valid,
        sources: [
          ...input.sources,
          { ...child, url: "https://unrelated.example/issues" },
        ],
        sourceLinks: [{ ...link, url: "https://unrelated.example/issues" }],
      }),
    /verified source origin/,
  );
});

test("finance observation timestamps preserve semantic dossier and dispatch keys but numbers and source bytes invalidate them", () => {
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = fixtureDossier();
  input.officeKind = "federal_legislative";
  input.evidence.push({
    ...input.evidence[0]!,
    id: "finance",
    role: "finance",
    identityQualification: "exact_election_office",
  });
  input.finance = {
    committeeId: "C00000001",
    committeeName: "Fixture committee",
    periodStart: "2025-01-01",
    periodEnd: "2026-09-30",
    currency: "USD",
    coverage: "partial",
    coverageNote: "Fixture processed record",
    updatedAt: input.createdAt,
    filingEvidenceIds: ["finance"],
    receipts: {
      totalCents: 10000,
      breakdown: {
        individuals: 10000,
        committees: 0,
        self_contributions: 0,
        candidate_loans: 0,
        transfers: 0,
        other: 0,
      },
      refundsCents: null,
    },
    donors: [],
    donorCoverage: "unavailable",
    outsideSpending: null,
  };
  const a = buildCaliforniaDossier(input);
  const renewedInput = structuredClone(input);
  renewedInput.createdAt = "2026-10-30T01:00:00.000Z";
  renewedInput.sources[0]!.fetchedAt = renewedInput.createdAt;
  renewedInput.finance!.updatedAt = renewedInput.createdAt;
  const renewed = buildCaliforniaDossier(renewedInput);
  assert.equal(renewed.dossierDigest, a.dossierDigest);
  assert.equal(renewed.sourceSetDigest, a.sourceSetDigest);
  const key = (digest: string) =>
    createHash("sha256")
      .update(JSON.stringify([digest, "policy-v1", "prompt-v7"]))
      .digest("hex");
  assert.equal(key(a.dossierDigest), key(renewed.dossierDigest));
  const changed = structuredClone(input);
  changed.finance!.receipts!.totalCents = 10001;
  changed.finance!.receipts!.breakdown.individuals = 10001;
  assert.notEqual(
    buildCaliforniaDossier(changed).dossierDigest,
    a.dossierDigest,
  );
  const changedSource = structuredClone(input);
  changedSource.sources[0]!.text += " Updated source record";
  changedSource.sources[0]!.contentHash = createHash("sha256")
    .update(changedSource.sources[0]!.text)
    .digest("hex");
  assert.notEqual(
    buildCaliforniaDossier(changedSource).sourceSetDigest,
    a.sourceSetDigest,
  );
  assert.notEqual(
    buildCaliforniaDossier(changedSource).dossierDigest,
    a.dossierDigest,
  );
});

test("text response byte metadata does not change canonical dossier content identity", () => {
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = fixtureDossier();
  const a = buildCaliforniaDossier({
    ...input,
    sources: input.sources.map((source) => ({
      ...source,
      byteHash: "a".repeat(64),
    })),
  });
  const b = buildCaliforniaDossier({
    ...input,
    sources: input.sources.map((source) => ({
      ...source,
      byteHash: "b".repeat(64),
      fetchedAt: "2026-10-30T01:00:00.000Z",
    })),
  });
  assert.equal(a.sourceSetDigest, b.sourceSetDigest);
  assert.equal(a.dossierDigest, b.dossierDigest);
});

void test("historical contact proofs bind only exact identity and freshly retrieved redirect destinations", () => {
  const base = fixtureDossier(false);
  const identity = {
    ...base.identity,
    candidateId: "ca-scc-clarity:2026-11-03:127570:1:choice:1",
    contestId: "ca-scc-clarity:2026-11-03:127570:1",
  };
  const historicalUrl =
    "https://files.santaclaracounty.gov/archive/qualified-list-of-local-candidates-fixture.pdf";
  const campaign = {
    id: "campaign",
    url: "https://campaign.example/about",
    publisher: "Candidate",
    format: "html" as const,
    text: "Morgan Lee is running for local office.",
    contentHash: createHash("sha256")
      .update("Morgan Lee is running for local office.")
      .digest("hex"),
    fetchedAt: base.createdAt,
    retrievalUrls: [
      "http://campaign.example/",
      "https://campaign.example/about",
    ],
  };
  const proof = {
    kind: "historical_official_filing" as const,
    identity,
    websiteUrl: "http://campaign.example/",
    destinationSourceId: campaign.id,
    retrievalUrls: campaign.retrievalUrls,
    officialSource: {
      url: historicalUrl,
      contentHash: "b".repeat(64),
      fetchedAt: "2026-09-22T00:00:00.000Z",
      locator: "Original archived filing Website field",
      excerpt: "Website:campaign.example",
      recordDigest: "c".repeat(64),
      officialRecordName: "Morgan Lee",
    },
  };
  const {
    schemaVersion: _schema,
    classification: _classification,
    dossierDigest: _digest,
    sourceSetDigest: _sourceDigest,
    ...input
  } = base;
  const valid = buildCaliforniaDossier({
    ...input,
    identity,
    officeFamily: "local",
    officeKind: "local",
    sources: [...base.sources, campaign],
    campaignContactProof: proof,
  });
  assert.equal(
    valid.campaignContactProof?.officialSource.fetchedAt,
    "2026-09-22T00:00:00.000Z",
  );
  assert.equal(
    valid.sources.some((source) => source.url === historicalUrl),
    false,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        identity,
        officeFamily: "local",
        officeKind: "local",
        sources: [...base.sources, campaign],
        campaignContactProof: {
          ...proof,
          identity: { ...identity, candidateId: "someone-else" },
        },
      }),
    /different candidate identity/,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        identity,
        officeFamily: "local",
        officeKind: "local",
        sources: [...base.sources, { ...campaign, retrievalUrls: undefined }],
        campaignContactProof: proof,
      }),
    /actual recorded fresh destination/,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        identity,
        officeFamily: "local",
        officeKind: "local",
        sources: [...base.sources, { ...campaign, url: historicalUrl }],
        campaignContactProof: proof,
      }),
    /cannot be dossier sources/,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        identity,
        officeFamily: "local",
        officeKind: "local",
        sources: [...base.sources, campaign],
        campaignContactProof: proof,
        evidence: [
          ...base.evidence,
          {
            id: "historical-quote",
            sourceId: "historical-contact-proof",
            excerpt: proof.officialSource.excerpt,
            locator: "Website",
            origin: "candidate",
            role: "candidate_statement",
            identityQualification: "official_cross_link",
          },
        ],
      }),
    /archived source exactly/,
  );
});

export function fixtureCampaignMaterialDossier() {
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = fixtureDossier();
  const quote = "I will fund every classroom and build a new school.";
  const context = `Statement by Principal Garcia\n${"Context about the principal and the school's teaching program. ".repeat(14)}\n${quote}`;
  input.sources[0]!.text += "\n" + context;
  input.sources[0]!.contentHash = createHash("sha256")
    .update(input.sources[0]!.text)
    .digest("hex");
  input.evidence[1] = {
    ...input.evidence[1]!,
    excerpt: quote,
    role: "campaign_material",
    attribution: {
      status: "unresolved",
      context: {
        excerpt: context,
        locator:
          "Campaign page, complete Statement by Principal Garcia section",
      },
    },
  };
  return buildCaliforniaDossier(input);
}

test("campaign publisher ownership leaves speaker unresolved and preserves the whole archived context", () => {
  const dossier = fixtureCampaignMaterialDossier();
  assert.equal(dossier.evidence[1]!.role, "campaign_material");
  assert.equal(dossier.evidence[1]!.attribution!.status, "unresolved");
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = dossier;
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        evidence: input.evidence.map((entry) =>
          entry.id === "platform"
            ? { ...entry, attribution: undefined }
            : entry,
        ),
      }),
    /unresolved speaker attribution/,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        evidence: input.evidence.map((entry) =>
          entry.id === "platform"
            ? {
                ...entry,
                attribution: {
                  ...entry.attribution!,
                  status: "official_candidate_statement",
                },
              }
            : entry,
        ),
      }),
    /unresolved speaker attribution|official submission channel/,
  );
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        evidence: input.evidence.map((entry) =>
          entry.id === "platform"
            ? {
                ...entry,
                attribution: {
                  ...entry.attribution!,
                  context: {
                    ...entry.attribution!.context,
                    excerpt: "Invented source context",
                  },
                },
              }
            : entry,
        ),
      }),
    /exact archived passage/,
  );
});

test("official candidate-statement status requires its known official submission channel", () => {
  const dossier = fixtureCampaignMaterialDossier();
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = dossier;
  input.evidence[1] = {
    ...input.evidence[1]!,
    role: "candidate_statement",
    attribution: {
      ...input.evidence[1]!.attribution!,
      status: "official_candidate_statement",
    },
  };
  assert.throws(
    () => buildCaliforniaDossier(input),
    /verified official submission channel/,
  );
  input.sources[0]!.url =
    "https://voterguide.sos.ca.gov/candidates/governor-candidate-statements.htm";
  assert.equal(
    buildCaliforniaDossier(input).evidence[1]!.attribution!.status,
    "official_candidate_statement",
  );
});
