import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authorityProjectionDigest,
  authorityRenewalErrors,
  checkRace,
  clarityIdentityErrors,
  expectedRoster,
  finalScopeErrors,
  publicResearchQualityErrors,
  sourceArchiveErrors,
  sourceAuditErrors,
  walkCatalog,
} from "./verify-california-research.mjs";

const identity = (id) => ({
  candidateId: id,
  contestId: "race",
  jurisdiction: "CA",
  electionDate: "2026-11-03",
});
const page = (ids, nextCursor = null) => ({
  snapshotId: "snapshot",
  totalMatches: 3,
  coverage: { expectedCandidates: 3 },
  items: ids.map((id) => ({ identity: identity(id) })),
  nextCursor,
});

test("walks beyond a first page and retains every canonical identity", async () => {
  const calls = [];
  const result = await walkCatalog(
    async (_, input) => {
      calls.push(input.cursor);
      return input.cursor ? page(["c"]) : page(["a", "b"], "next");
    },
    "2026-11-03",
    2,
  );
  assert.deepEqual(
    result.items.map((item) => item.identity.candidateId),
    ["a", "b", "c"],
  );
  assert.deepEqual(calls, [undefined, "next"]);
});

test("rejects truncation, duplicate identities, changing snapshots, and cursor cycles", async () => {
  await assert.rejects(
    walkCatalog(async () => page(["a"]), "2026-11-03"),
    /truncated/,
  );
  let count = 0;
  await assert.rejects(
    walkCatalog(
      async () => (++count === 1 ? page(["a"], "next") : page(["a", "b"])),
      "2026-11-03",
    ),
    /Duplicate/,
  );
  count = 0;
  await assert.rejects(
    walkCatalog(
      async () =>
        ++count === 1
          ? page(["a"], "next")
          : { ...page(["b", "c"]), snapshotId: "changed" },
      "2026-11-03",
    ),
    /changed snapshot/,
  );
  count = 0;
  await assert.rejects(
    walkCatalog(async () => page([String(++count)], "same"), "2026-11-03"),
    /cursor cycle/,
  );
});

test("authoritative identity comparison retains jurisdiction and rejects duplicate roster identities", () => {
  const a = { identity: identity("a"), name: "A" };
  const document = {
    electionDate: "2026-11-03",
    races: [
      {
        officeFamily: "local",
        members: [
          a,
          { ...a, identity: { ...a.identity, jurisdiction: "San Jose" } },
        ],
      },
    ],
  };
  assert.equal(expectedRoster(document).candidates.length, 2);
  assert.throws(
    () => expectedRoster({ ...document, races: [{ members: [a, a] }] }),
    /duplicate/,
  );
});

test("judicial research needs cited record or authority, not an invented promise", () => {
  const candidateIdentity = identity("ca-sos:2026-11-03:140000000000:1");
  const source = {
    id: "court",
    url: "https://courts.ca.gov/justice",
    publisher: "Court",
    locator: "Biography",
    contentHash: "hash",
    excerpt: "Served on court",
    retrievedAt: "2026-10-29T22:00:00Z",
  };
  const evidenceKey = JSON.stringify([
    JSON.stringify([
      candidateIdentity.jurisdiction,
      candidateIdentity.electionDate,
      candidateIdentity.contestId,
      candidateIdentity.candidateId,
    ]),
    source.id,
  ]);
  const race = {
    manifest: {
      id: "release",
      contestId: "race",
      jurisdiction: "CA",
      electionDate: "2026-11-03",
      policyVersion: "approved-v1",
      rosterSnapshotId: "snapshot",
      rosterSourceUrl: "https://sos.ca.gov/roster",
      rosterHash: "hash",
      rosterVerifiedBy: "official",
      sourceCheckedAt: "2026-10-29T22:00:00Z",
      rosterVerifiedAt: "2026-10-29T22:00:00Z",
      expiresAt: "2026-10-30T22:00:00Z",
      members: [
        { candidateId: candidateIdentity.candidateId, revisionId: "revision" },
      ],
      currentHashes: { [evidenceKey]: "hash" },
    },
    reviewedAt: "2026-10-29T22:00:00Z",
    briefs: [
      {
        identity: candidateIdentity,
        revisionId: "revision",
        evidence: [source],
        research: {
          promises: [],
          finance: null,
          financeGap: "No campaign finance filings established.",
        },
        sections: [
          {
            topic: "record",
            claims: [{ text: "Served on court", evidenceIds: ["court"] }],
          },
        ],
      },
    ],
  };
  const expected = [
    { identity: candidateIdentity, officeFamily: "judicial_retention" },
  ];
  const context = {
    now: Date.parse("2026-10-30T12:00:00Z"),
    snapshotId: "snapshot",
    policyVersion: "approved-v1",
  };
  const valid = checkRace(race, expected, context);
  assert.deepEqual(valid.issues, []);
  assert.deepEqual(valid.briefs[0].errors, []);
  const stale = structuredClone(race);
  stale.manifest.currentHashes[evidenceKey] = "changed";
  assert.match(
    checkRace(stale, expected, context).briefs[0].errors.join(" "),
    /hash not current/,
  );
  const filler = structuredClone(race);
  filler.briefs[0].evidence[0].url = filler.manifest.rosterSourceUrl;
  filler.briefs[0].research.financeGap = null;
  const errors = checkRace(filler, expected, context).briefs[0].errors.join(
    " ",
  );
  assert.match(errors, /Roster-only/);
  assert.match(errors, /Finance unavailable/);
});

function completeSanJoseFixture() {
  const text = "Archived official county roster and territorial proof.";
  const contentHash = createHash("sha256").update(text).digest("hex");
  const proof = {
    contentHash,
    url: "https://files.santaclaracounty.gov/official-source",
  };
  const jurisdiction = "ocd-division/country:us/state:ca/place:san_jose";
  const localIdentity = {
    ...identity("ca-scc:5205:1"),
    contestId: "ca-scc:5205",
    jurisdiction,
  };
  const member = {
    identity: localIdentity,
    name: "Local Candidate",
    sourceProof: proof,
  };
  const entries = Array.from({ length: 129 }, (_, index) =>
    index === 0
      ? {
          jurisdiction,
          proofs: [proof],
          reason: "Official territory serves San Jose",
          sourceContestId: "5205",
          status: "include",
        }
      : {
          proofs: [proof],
          reason: "Official territory is outside the selected scope",
          sourceContestId: String(6000 + index),
          status: "exclude",
        },
  );
  const localCrosswalk = {
    electionDate: "2026-11-03",
    entries,
    method:
      "Reviewed every county contest against official territorial sources",
    rosterSourceHash: contentHash,
    schemaVersion: 1,
  };
  localCrosswalk.review = {
    actorId: "independent-reviewer",
    digest: createHash("sha256")
      .update(JSON.stringify(localCrosswalk))
      .digest("hex"),
    reviewedAt: "2026-10-30T00:00:00Z",
  };
  return {
    electionDate: "2026-11-03",
    scope: "ca_sos_certified_and_san_jose",
    localCoverage: {
      scope: "san_jose",
      status: "verified",
      expectedCandidates: 1,
      expectedRaces: 1,
      pendingRaces: 0,
      pendingCandidates: 0,
    },
    localCrosswalk,
    additionalSources: [{ ...proof, text }],
    races: [
      {
        officeFamily: "statewide",
        members: Array.from({ length: 388 }, (_, index) => ({
          name: `State ${index}`,
          identity: identity(`ca-sos:${index}`),
        })),
      },
      {
        officeFamily: "local",
        contestId: localIdentity.contestId,
        sourceContestId: "5205",
        jurisdiction,
        members: [member],
        sourceProof: proof,
      },
    ],
  };
}

test("complete reviewed San Jose scope passes independently of other county coverage", () => {
  const snapshot = completeSanJoseFixture();
  snapshot.countyCoverage = [{ name: "Alameda", status: "not_enumerated" }];
  const roster = expectedRoster(snapshot);
  assert.equal(roster.candidates.length, 389);
  assert.deepEqual(finalScopeErrors(roster), []);
});

test("publishing every listed member of a pending San Jose subset cannot satisfy final scope", () => {
  const snapshot = completeSanJoseFixture();
  snapshot.localCoverage = {
    ...snapshot.localCoverage,
    status: "pending",
    expectedCandidates: null,
    expectedRaces: null,
    pendingRaces: 10,
    pendingCandidates: 25,
  };
  const allListedPublished = expectedRoster(snapshot).candidates.map(
    (candidate) => ({ ...candidate, status: "published" }),
  );
  const errors = finalScopeErrors({
    ...expectedRoster(snapshot),
    candidates: allListedPublished,
  });
  assert.match(errors.join(" "), /not verified complete/);
  assert.match(errors.join(" "), /unresolved candidate identities/);
});

test("an unrelated local candidate and manual identity list cannot substitute for verified San Jose scope", () => {
  const unrelated = completeSanJoseFixture();
  const race = unrelated.races[1];
  race.jurisdiction = "ocd-division/country:us/state:ca/place:cupertino";
  race.members[0].identity.jurisdiction = race.jurisdiction;
  assert.match(
    finalScopeErrors(expectedRoster(unrelated)).join(" "),
    /outside verified San Jose scope/,
  );
  const manual = {
    electionDate: "2026-11-03",
    members: completeSanJoseFixture()
      .races.flatMap((item) => item.members)
      .map((member) => ({ ...member, contestId: member.identity.contestId })),
  };
  assert.ok(finalScopeErrors(expectedRoster(manual)).length > 0);
});

test("verified labels cannot hide missing, pending, tampered, or unmapped local proof", () => {
  for (const mutate of [
    (snapshot) => {
      delete snapshot.localCoverage.pendingCandidates;
    },
    (snapshot) => {
      snapshot.localCrosswalk.entries[1].status = "pending";
    },
    (snapshot) => {
      snapshot.localCrosswalk.review.digest = "forged";
    },
    (snapshot) => {
      snapshot.additionalSources[0].text = "changed source";
    },
    (snapshot) => {
      delete snapshot.races[1].members[0].sourceProof;
    },
  ]) {
    const snapshot = completeSanJoseFixture();
    mutate(snapshot);
    assert.ok(finalScopeErrors(expectedRoster(snapshot)).length > 0);
  }
});

const cdeProjection = "cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1";
const cdeUrl =
  "https://www.arcgis.com/sharing/rest/content/items/48870daecfe14c6ab376f6a673491914?f=json";
const mvlaProjection = "mvla-trustee-authority-seven-asset-versions-v1";
const mvlaUrl = "https://www.mvla.net/trustee-area-election-information";

test("CDE renewal removes only the two top-level integer telemetry fields", () => {
  const item = {
    id: "48870daecfe14c6ab376f6a673491914",
    lastViewed: 1,
    numViews: 2,
    title: "District geometry",
    owner: "Official",
    modified: 42,
    service: { url: "https://example.gov/map", numViews: 3 },
    extent: [
      [1, 2],
      [3, 4],
    ],
  };
  const project = (value) =>
    authorityProjectionDigest(cdeProjection, cdeUrl, JSON.stringify(value));
  assert.equal(
    project(item),
    project({ ...item, lastViewed: 20, numViews: 30 }),
  );
  for (const mutation of [
    { ...item, title: "Different boundaries" },
    { ...item, owner: "Other" },
    { ...item, modified: 43 },
    { ...item, service: { ...item.service, numViews: 4 } },
    { ...item, unknownNewField: true },
    {
      ...item,
      extent: [
        [1, 2],
        [3, 5],
      ],
    },
  ])
    assert.notEqual(project(item), project(mutation));
  for (const text of [
    JSON.stringify(item).replace('"numViews":2', '"numViews":2,"numViews":3'),
    JSON.stringify(item).replace(
      '"title":"District geometry"',
      '"title":"District geometry","\\u0074itle":"duplicate"',
    ),
    JSON.stringify(item).replace('"modified":42', '"modified":1e999'),
    JSON.stringify({ ...item, numViews: -1 }),
    JSON.stringify({ ...item, lastViewed: 1.5 }),
    JSON.stringify({ ...item, id: "different" }),
  ])
    assert.throws(() => authorityProjectionDigest(cdeProjection, cdeUrl, text));
  assert.throws(
    () =>
      authorityProjectionDigest(
        cdeProjection,
        "https://example.gov/other-item",
        JSON.stringify(item),
      ),
    /Unapproved/,
  );
});

test("MVLA renewal preserves all text except seven exact synchronized asset timestamp slots", () => {
  const tags = [
    '<script src="/js/slick-a11y.js?v=',
    '<link rel="stylesheet" type="text/css" href="/css/main-sass.css?v=',
    '<script src="/js/classes/ColorContrast.js?v=',
    '<script src="/js/stack_items.js?v=',
    '<script type="module" src="/js/components.js?v=',
    '<script src="/js/general.js?v=',
    '<script src="/js/deviceDetector.js?v=',
  ];
  const html = (version) =>
    '<h1>Adopted C1</h1><a href="C1.pdf">Map</a>\n' +
    tags.map((tag) => tag + version + '">').join("\n");
  const project = (text) =>
    authorityProjectionDigest(mvlaProjection, mvlaUrl, text);
  const original = html("20261030182853");
  assert.equal(project(original), project(html("20261030194310")));
  for (const changed of [
    original + " ",
    original.replace("C1.pdf", "C2.pdf"),
    original.replace("Adopted C1", "Proposed C1"),
  ])
    assert.notEqual(project(original), project(changed));
  for (const changed of [
    original.replace("/js/general.js", "/js/new.js"),
    original.replace("20261030182853", "20261030194310"),
    html("20260230182853"),
    html("20261030182899"),
    original + tags[0] + '20261030182853">',
  ])
    assert.throws(() => project(changed));
});

test("authority renewal cannot authorize arbitrary projectors or self-declared digest approvals", () => {
  assert.match(
    authorityRenewalErrors(
      { sourceRenewalProjections: [{ projectionId: "ignore-all-html" }] },
      [],
      "scope",
    ).join(" "),
    /Unapproved/,
  );
  assert.match(
    authorityRenewalErrors(
      {
        sourceRenewalProjections: [
          {
            projectionId: cdeProjection,
            url: cdeUrl,
            reviewedContentHash: "arbitrary",
          },
        ],
      },
      [],
      "scope",
    ).join(" "),
    /Unapproved authority reviewedContentHash/,
  );
  assert.match(
    authorityRenewalErrors(
      { sourceProjectionProofs: [{ projectionId: cdeProjection }] },
      [],
      "scope",
    ).join(" "),
    /no approved projection/,
  );
});

test("current local source freshness is bound to actual successful bounded HTTP observations", () => {
  const fetchedAt = "2026-10-30T20:15:15.486Z";
  const source = {
    id: "official-map",
    url: "https://example.gov/map.pdf",
    contentHash: "extracted-text-hash",
    byteHash: "binary-map-hash",
    fetchedAt,
  };
  const roster = { additionalSources: [source] };
  const audit = {
    schemaVersion: 1,
    startedAt: "2026-10-30T20:15:00Z",
    completedAt: "2026-10-30T20:16:00Z",
    observedBodyBytes: 100,
    maxSharedBodyBytes: 1000,
    sources: [
      {
        id: source.id,
        url: source.url,
        status: "PASS",
        bodyBytes: 100,
        startedAt: "2026-10-30T20:15:01Z",
        completedAt: fetchedAt,
        actual: {
          url: source.url,
          textHash: source.contentHash,
          byteHash: source.byteHash,
          fetchedAt,
        },
      },
    ],
    networkRequests: [{ sourceId: source.id, status: 200 }],
  };
  const now = Date.parse("2026-10-30T20:20:00Z");
  assert.deepEqual(sourceAuditErrors(roster, audit, now), []);
  for (const mutate of [
    (value) => {
      value.sources[0].actual.byteHash = "changed binary";
    },
    (value) => {
      value.sources[0].actual.textHash = "changed extraction";
    },
    (value) => {
      value.sources[0].actual.fetchedAt = "2026-10-30T20:15:16Z";
    },
    (value) => {
      value.sources[0].status = "FAIL";
    },
    (value) => {
      value.networkRequests[0].status = 403;
    },
    (value) => {
      value.observedBodyBytes = 1001;
    },
    (value) => {
      value.sources.push(value.sources[0]);
    },
  ]) {
    const changed = structuredClone(audit);
    mutate(changed);
    assert.ok(sourceAuditErrors(roster, changed, now).length);
  }
  assert.ok(sourceAuditErrors(roster, audit, now + 86_400_000).length);
  assert.ok(sourceAuditErrors(roster, null, now).length);
});

test("HTTP audit companion archive must preserve actual current source bodies and raw hashes", () => {
  const text = "Actual official source text";
  const source = {
    id: "official",
    url: "https://example.gov/official",
    publisher: "Official",
    format: "text",
    text,
    contentHash: createHash("sha256").update(text).digest("hex"),
    byteHash: "actual-raw-hash",
    fetchedAt: "2026-10-30T20:15:00Z",
  };
  const roster = { additionalSources: [source] };
  assert.deepEqual(sourceArchiveErrors(roster, { sources: [source] }), []);
  for (const mutate of [
    (archive) => {
      archive.sources[0].text = "Changed text";
    },
    (archive) => {
      archive.sources[0].byteHash = "Changed binary";
    },
    (archive) => {
      archive.sources[0].fetchedAt = "2026-10-30T21:00:00Z";
    },
    (archive) => {
      archive.sources = [];
    },
    (archive) => {
      archive.sources.push(archive.sources[0]);
    },
  ]) {
    const archive = { sources: [structuredClone(source)] };
    mutate(archive);
    assert.ok(sourceArchiveErrors(roster, archive).length);
  }
  assert.ok(sourceArchiveErrors(roster, null).length);
});

test("local canonical candidate IDs are independently derived from official XML keys", () => {
  const root =
    "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/";
  const contestId = "ca-scc-clarity:2026-11-03:127570:28";
  const identity = {
    candidateId: `${contestId}:choice:48`,
    contestId,
    electionDate: "2026-11-03",
    jurisdiction: "San Jose",
  };
  const roster = {
    electionDate: "2026-11-03",
    localPrimary: {
      definitionURL: `${root}382435/json/en/summary.json`,
      settingsURL: `${root}382435/json/en/electionsettings.json`,
      currentVersionURL: `${root}current_ver.txt`,
      identityCrosswalk: {
        members: [
          {
            sourceContestId: "3170",
            name: "Candidate",
            clarityContestKey: "28",
            clarityChoiceIndex: 0,
            status: "on_ballot",
          },
        ],
      },
    },
    additionalSources: [
      { url: `${root}current_ver.txt`, text: "382435" },
      {
        url: `${root}382435/json/en/summary.json`,
        text: JSON.stringify([{ K: "28", CH: ["Candidate", "Other"] }]),
      },
      {
        url: `${root}382435/reports/detailwithoutvotetypesxml.zip`,
        text: '<Contest key="28"><Choice key="48"></Choice><Choice key="49"></Choice></Contest>',
      },
    ],
    races: [
      {
        officeFamily: "local",
        sourceContestId: "3170",
        contestId,
        jurisdiction: "San Jose",
        members: [
          {
            identity,
            candidateId: identity.candidateId,
            sourceCandidateId: "48",
            name: "Candidate",
            ballotStatus: "on_ballot",
          },
        ],
      },
    ],
  };
  assert.deepEqual(clarityIdentityErrors(roster), []);
  for (const mutate of [
    (value) => {
      value.races[0].members[0].identity.candidateId = `${contestId}:choice:999`;
    },
    (value) => {
      value.races[0].members[0].sourceCandidateId = "49";
    },
    (value) => {
      value.localPrimary.identityCrosswalk.members[0].clarityChoiceIndex = 1;
    },
    (value) => {
      value.races[0].members[0].ballotStatus = "qualified_write_in";
    },
    (value) => {
      value.additionalSources[2].text =
        '<Contest key="28"><Choice key="48"></Choice><Choice key="48"></Choice></Contest>';
    },
  ]) {
    const changed = structuredClone(roster);
    mutate(changed);
    assert.ok(clarityIdentityErrors(changed).length);
  }
});

const qualityPolicy = "ca-california-candidate-research-2026-10-30-v2";
function financeQualityFixture() {
  const candidateIdentity = identity("ca-sos:2026-11-03:110000170000:123");
  const source = {
    id: "filing",
    url: "https://api.open.fec.gov/v1/committee/C123/totals/",
    publisher: "Federal Election Commission",
    origin: "primary_record",
    excerpt: "Reported receipts",
    locator: "2026 committee totals",
    contentHash: "a".repeat(64),
    retrievedAt: "2026-10-30T10:00:00Z",
  };
  const finance = {
    committeeId: "C123",
    committeeName: "Candidate Committee",
    periodStart: "2025-01-01",
    periodEnd: "2026-10-01",
    currency: "USD",
    coverage: "partial",
    coverageNote: "Processed filing totals; donor details not collected.",
    updatedAt: source.retrievedAt,
    filingEvidenceIds: ["filing"],
    receipts: {
      totalCents: 100,
      breakdown: {
        individuals: 100,
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
  const brief = {
    identity: candidateIdentity,
    revisionId: "revision",
    evidence: [source],
    research: { promises: [], finance, financeGap: null },
    sections: [
      "priorities",
      "record",
      "mechanisms",
      "effects",
      "tradeoffs",
      "unknowns",
    ].map((topic) => ({
      topic,
      claims: [],
      missingEvidence: "No supported prose was established.",
    })),
  };
  const certificate = {
    basis: "reconciled_finance",
    claimIds: [],
    evidenceIds: ["filing"],
  };
  const evidenceKey = JSON.stringify([
    JSON.stringify([
      candidateIdentity.jurisdiction,
      candidateIdentity.electionDate,
      candidateIdentity.contestId,
      candidateIdentity.candidateId,
    ]),
    source.id,
  ]);
  const manifest = {
    id: "release",
    contestId: candidateIdentity.contestId,
    jurisdiction: candidateIdentity.jurisdiction,
    electionDate: candidateIdentity.electionDate,
    policyVersion: qualityPolicy,
    rosterSnapshotId: "snapshot",
    rosterSourceUrl: "https://sos.ca.gov/roster",
    rosterHash: "b".repeat(64),
    rosterVerifiedBy: "official",
    sourceCheckedAt: source.retrievedAt,
    rosterVerifiedAt: source.retrievedAt,
    expiresAt: "2026-10-31T10:00:00Z",
    members: [
      {
        candidateId: candidateIdentity.candidateId,
        revisionId: brief.revisionId,
      },
    ],
    currentHashes: { [evidenceKey]: source.contentHash },
    reviewedDossiers: {
      [candidateIdentity.candidateId]: {
        dossierDigest: "c".repeat(64),
        sourceSetDigest: "d".repeat(64),
        authorRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quality: certificate,
      },
    },
  };
  return {
    brief,
    certificate,
    race: { manifest, briefs: [brief], reviewedAt: "2026-10-30T10:30:00Z" },
    expected: [{ identity: candidateIdentity, officeFamily: "us_house" }],
    context: {
      now: Date.parse("2026-10-30T12:00:00Z"),
      snapshotId: "snapshot",
      policyVersion: qualityPolicy,
    },
  };
}

test("v2 publications require an exact service-derived certificate while finance-only content needs no prose headline", () => {
  const { brief, race, expected, context } = financeQualityFixture();
  assert.equal(brief.research.headlineClaimId, undefined);
  assert.deepEqual(checkRace(race, expected, context).briefs[0].errors, []);
  delete race.manifest.reviewedDossiers[brief.identity.candidateId].quality;
  assert.match(
    checkRace(race, expected, context).briefs[0].errors.join(" "),
    /Missing or invalid service-derived/,
  );
});

test("candidate certificates bind qualifying Record or Priorities claims and all declared evidence", () => {
  const brief = {
    evidence: [{ id: "candidate-record" }],
    sections: [
      {
        topic: "record",
        claims: [
          {
            id: "service",
            text: "Served on the city council.",
            evidenceIds: ["candidate-record"],
          },
        ],
      },
    ],
  };
  const certificate = {
    basis: "candidate_record",
    claimIds: ["service"],
    evidenceIds: ["candidate-record"],
  };
  assert.deepEqual(publicResearchQualityErrors(brief, certificate), []);
  assert.ok(
    publicResearchQualityErrors(brief, {
      ...certificate,
      basis: "candidate_priorities",
    }).length,
  );
  const priorities = structuredClone(brief);
  priorities.sections[0].topic = "priorities";
  assert.deepEqual(
    publicResearchQualityErrors(priorities, {
      ...certificate,
      basis: "candidate_priorities",
    }),
    [],
  );
  assert.ok(
    publicResearchQualityErrors(brief, {
      ...certificate,
      claimIds: ["service", "service"],
    }).length,
  );
  assert.ok(
    publicResearchQualityErrors(brief, {
      ...certificate,
      evidenceIds: ["absent"],
    }).length,
  );
  assert.ok(
    publicResearchQualityErrors({ ...brief, sections: [] }, certificate).length,
  );
  const inventory = {
    ...brief,
    sections: [
      {
        topic: "mechanisms",
        claims: [
          {
            id: "source",
            text: "The publisher has a source page.",
            evidenceIds: ["candidate-record"],
          },
        ],
      },
    ],
  };
  assert.ok(
    publicResearchQualityErrors(inventory, {
      ...certificate,
      claimIds: ["source"],
    }).length,
  );
  assert.ok(
    publicResearchQualityErrors(
      {
        ...brief,
        sections: [
          {
            topic: "record",
            claims: [],
            missingEvidence: "No candidate record established.",
          },
        ],
      },
      certificate,
    ).length,
  );
});

test("reconciled finance certificates reject unsupported empty records and bind exact amounts and references", () => {
  const { brief, certificate } = financeQualityFixture();
  assert.deepEqual(publicResearchQualityErrors(brief, certificate), []);
  for (const mutate of [
    (value) => {
      value.research.finance.receipts.totalCents = 200;
    },
    (value) => {
      value.research.finance.receipts = null;
    },
    (value) => {
      value.evidence[0].origin = "reporting";
    },
    (value) => {
      value.research.finance.filingEvidenceIds = ["other"];
    },
  ]) {
    const changed = structuredClone(brief);
    mutate(changed);
    assert.ok(publicResearchQualityErrors(changed, certificate).length);
  }
  assert.ok(
    publicResearchQualityErrors(brief, {
      ...certificate,
      claimIds: ["invented"],
    }).length,
  );
  const donorsOnly = structuredClone(brief);
  donorsOnly.research.finance.receipts = null;
  donorsOnly.research.finance.donorCoverage = "selected";
  donorsOnly.research.finance.donors = [
    {
      id: "donor",
      name: "Donor",
      type: "individual",
      amountCents: 100,
      evidenceIds: ["filing"],
      lobbying: null,
      interests: [],
      positions: [],
    },
  ];
  assert.deepEqual(publicResearchQualityErrors(donorsOnly, certificate), []);
  const spendingOnly = structuredClone(brief);
  spendingOnly.research.finance.receipts = null;
  spendingOnly.research.finance.outsideSpending = [
    {
      id: "spending",
      spender: "Committee",
      direction: "support",
      amountCents: 100,
      evidenceIds: ["filing"],
    },
  ];
  assert.deepEqual(publicResearchQualityErrors(spendingOnly, certificate), []);
  const zero = structuredClone(brief);
  zero.research.finance.receipts.totalCents = 0;
  zero.research.finance.receipts.breakdown.individuals = 0;
  assert.equal(zero.research.finance.coverage, "partial");
  assert.deepEqual(publicResearchQualityErrors(zero, certificate), []);
  zero.research.finance.coverage = "complete";
  assert.deepEqual(publicResearchQualityErrors(zero, certificate), []);
  zero.research.finance.receipts = null;
  zero.research.finance.outsideSpending = [];
  assert.deepEqual(publicResearchQualityErrors(zero, certificate), []);
  zero.research.finance.coverage = "partial";
  assert.ok(publicResearchQualityErrors(zero, certificate).length);
});

const relatedProjection =
  "cde-data-ca-gov-school-district-areas-2025-26-related-harvest-v1";
const relatedUrl =
  "https://data.ca.gov/@california-department-of-education/california-school-district-areas-2025-26";
const relatedDigest =
  "07910e6fe6e94dd625e793e9ed08a91108f323283a1d06f9c8170ab806ddca44";
const relatedRead = (name) =>
  readFileSync(
    new URL(
      `../apps/scraper/src/candidate-research/fixtures/cde-related-harvest-${name}.txt`,
      import.meta.url,
    ),
    "utf8",
  );
const relatedHash = (text) => createHash("sha256").update(text).digest("hex");
const relatedProject = (text) =>
  authorityProjectionDigest(relatedProjection, relatedUrl, text);

test("related harvest renewal binds the independently reviewed raw archives and exact digest", () => {
  const reviewed = relatedRead("reviewed"),
    observed = relatedRead("observed");
  assert.equal(
    relatedHash(reviewed),
    "2c63bb63cba2ae9112fe5f94df3af7720262d8f46d58197344207a19575b60b5",
  );
  assert.equal(
    relatedHash(observed),
    "ea2a1c2f39594c0a918975343f151403f26a1af021906c6d742925fb3d241fff",
  );
  assert.equal(relatedProject(reviewed), relatedDigest);
  assert.equal(relatedProject(observed), relatedDigest);
  assert.equal(
    relatedProject(
      observed.replace(
        "74d82284-ca3c-443c-8630-3d225c34a9cf",
        "12345678-1234-4abc-8abc-123456789abc",
      ),
    ),
    relatedDigest,
  );
});

test("related harvest renewal rejects ambiguous or malformed exclusions", () => {
  const text = relatedRead("observed");
  const uuid = "74d82284-ca3c-443c-8630-3d225c34a9cf";
  const wrapper = '<script id="__NEXT_DATA__" type="application/json">';
  for (const changed of [
    text.repeat(72),
    text.replace(
      wrapper,
      '<script type="application/json" id="__NEXT_DATA__">',
    ),
    text + wrapper + "{}</script>",
    text + "<script id='__NEXT_DATA__'>{}</script>",
    text + "<script id=__NEXT_DATA__>{}</script>",
    text.replace(wrapper, ""),
    text.replace('"props":', '"props":null,"\\u0070rops":'),
    text.replace('"props":', '"nonfinite":1e999,"props":'),
    text.replace(
      '"props":',
      '"deep":' + "[".repeat(101) + "0" + "]".repeat(101) + ',"props":',
    ),
    text.replace(uuid, uuid.replace("-443c-", "-543c-")),
    text.replace(uuid, uuid.replace("-8630-", "-7630-")),
    text.replace(uuid, uuid.toUpperCase()),
    text.replace(uuid, "\\u0037" + uuid.slice(1)),
    text + uuid,
    text + "__RELATED_HARVEST_OBJECT_ID_1__",
    text.replace('"harvest_object_id"', '"other_key"'),
    text.replace('"harvest_source_id"', '"harvest_object_id"'),
    text.replace("9a9f7021-d72d-4bdf-8828-1014fc494561", "wrong-primary"),
    text.replace("6ad5b9d2-58e3-4181-bfb5-851ab41b7fe3", "wrong-related"),
  ])
    assert.throws(() => relatedProject(changed));
});

test("related harvest renewal retains every other raw source byte", () => {
  const text = relatedRead("observed");
  for (const changed of [
    text + " ",
    text.replace('"props":', '"props" :'),
    text.replace("California Public Schools 2025-26", "Changed public schools"),
    text.replace(
      "2a07eb34-c712-4b9b-83a0-f68a10de2d8f",
      "2a07eb34-c712-4b9b-83a0-f68a10de2d80",
    ),
    text.replace(
      "CDEGIS::california-school-district-areas-2025-26",
      "CDEGIS::changed-district-areas",
    ),
  ])
    assert.notEqual(relatedProject(changed), relatedDigest);
});

function relatedRenewalFixture() {
  const reviewedText = relatedRead("reviewed"),
    currentText = relatedRead("observed");
  const approval = {
    receiptHash:
      "199b4e2d264df6f862d087f403e6a66f79f1572f01e7c68c1c843bb28421a39f",
    scopeDigest:
      "a04b0dc8a476fb06ed52d9aace451f6564fdaa476a672e751595fcd47c9562b7",
    reviewedSourceBundleHash:
      "1b15a619545d5138063f4216ebb297b031a6dfba4f03fdf8d6887dc53e8319c3",
    actorId: "ai:gpt-6-astra:california-related-harvest-review:2026-10-31",
    reviewedAt: "2026-10-31T01:06:16Z",
  };
  const current = {
    url: relatedUrl,
    publisher: "California Department of Education",
    format: "text",
    text: currentText,
    contentHash: relatedHash(currentText),
    byteHash: relatedHash(currentText),
    fetchedAt: "2026-10-31T01:00:59.326Z",
  };
  const contract = {
    projectionId: relatedProjection,
    url: current.url,
    publisher: current.publisher,
    format: "text",
    reviewedContentHash: relatedHash(reviewedText),
    reviewedRawHash: relatedHash(reviewedText),
    canonicalDigest: relatedDigest,
    reviewedSource: {
      ...current,
      text: reviewedText,
      contentHash: relatedHash(reviewedText),
      byteHash: relatedHash(reviewedText),
    },
    approval,
  };
  const proof = {
    projectionId: contract.projectionId,
    url: contract.url,
    publisher: contract.publisher,
    format: contract.format,
    reviewedContentHash: contract.reviewedContentHash,
    reviewedRawHash: contract.reviewedRawHash,
    canonicalDigest: contract.canonicalDigest,
    observedContentHash: current.contentHash,
    observedRawHash: current.byteHash,
    approvalReceiptHash: approval.receiptHash,
    checkedAt: current.fetchedAt,
  };
  return {
    primary: {
      sourceRenewalProjections: [contract],
      sourceProjectionProofs: [proof],
    },
    current,
  };
}

test("related harvest renewal pins its own forward approval and actual raw observation", () => {
  const check = ({ primary, current }) =>
    authorityRenewalErrors(
      primary,
      [current],
      "a04b0dc8a476fb06ed52d9aace451f6564fdaa476a672e751595fcd47c9562b7",
      Date.parse("2026-10-31T01:07:00Z"),
    );
  assert.deepEqual(check(relatedRenewalFixture()), []);
  for (const mutate of [
    (f) => {
      f.primary.sourceRenewalProjections[0].approval.receiptHash =
        "9b23400c34796de76dbe25140c356e508e3ecd0ae1617c31116df1ecc3c6f519";
    },
    ...["actorId", "reviewedAt", "reviewedSourceBundleHash", "scopeDigest"].map(
      (field) => (f) => {
        f.primary.sourceRenewalProjections[0].approval[field] = "wrong";
      },
    ),
    (f) => {
      f.primary.sourceProjectionProofs[0].approvalReceiptHash = "wrong";
    },
    (f) => {
      f.current.byteHash = "wrong";
    },
    (f) => {
      f.current.publisher = "wrong";
    },
    (f) => {
      f.current.format = "html";
    },
    (f) => {
      f.primary.sourceRenewalProjections[0].publisher = "wrong";
      f.primary.sourceRenewalProjections[0].reviewedSource.publisher = "wrong";
      f.primary.sourceProjectionProofs[0].publisher = "wrong";
      f.current.publisher = "wrong";
    },
    (f) => {
      f.primary.sourceRenewalProjections[0].reviewedSource.text += " ";
    },
    (f) => {
      f.primary.sourceRenewalProjections[0].reviewedSource.contentHash =
        "wrong";
    },
    (f) => {
      f.primary.sourceRenewalProjections[0].reviewedSource.byteHash = "wrong";
    },
  ]) {
    const fixture = relatedRenewalFixture();
    mutate(fixture);
    assert.ok(check(fixture).length);
  }
});

test("existing authority contracts retain their acknowledged digests and original receipt dates", () => {
  const fixtureBase = "../apps/scraper/src/candidate-research/fixtures/";
  const metadata = JSON.parse(
    readFileSync(
      new URL(
        fixtureBase + "authority-projection-sources.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const meta of metadata) {
    const isCde = meta.id === "cde-2025-26-item";
    const prefix = isCde ? "cde-item" : "mvla-authority";
    const read = (kind) =>
      readFileSync(
        new URL(fixtureBase + prefix + "-" + kind + ".txt", import.meta.url),
        "utf8",
      );
    const fixture = relatedRenewalFixture();
    const contract = fixture.primary.sourceRenewalProjections[0];
    const reviewed = read("reviewed"),
      observed = read("observed");
    Object.assign(contract, {
      projectionId: isCde ? cdeProjection : mvlaProjection,
      url: meta.url,
      publisher: meta.publisher,
      reviewedContentHash: relatedHash(reviewed),
      reviewedRawHash: relatedHash(reviewed),
      canonicalDigest: isCde
        ? "720348bff7cd6b05bf80f187822ccf406d659566dfa28d548d05f7812489d2fc"
        : "23e6295294ed84717528e916f9ce5f69ddd4ae22f43adfa27d734ccbd80ee2ff",
      reviewedSource: {
        ...meta,
        text: reviewed,
        contentHash: relatedHash(reviewed),
      },
      approval: {
        receiptHash:
          "9b23400c34796de76dbe25140c356e508e3ecd0ae1617c31116df1ecc3c6f519",
        scopeDigest:
          "a04b0dc8a476fb06ed52d9aace451f6564fdaa476a672e751595fcd47c9562b7",
        reviewedSourceBundleHash:
          "f3277611713e1c281d2604dc7cb2349e67551d1149343a5edac16309f1205aea",
        actorId: "ai:gpt-6-astra:san-jose-full-scope-review:2026-10-30",
        reviewedAt: "2026-10-30T20:18:50.276Z",
      },
    });
    Object.assign(fixture.current, {
      ...meta,
      text: observed,
      contentHash: relatedHash(observed),
      byteHash: relatedHash(observed),
      fetchedAt: "2026-10-30T20:15:18.192Z",
    });
    const proof = fixture.primary.sourceProjectionProofs[0];
    for (const field of [
      "projectionId",
      "url",
      "publisher",
      "format",
      "reviewedContentHash",
      "reviewedRawHash",
      "canonicalDigest",
    ])
      proof[field] = contract[field];
    Object.assign(proof, {
      observedContentHash: fixture.current.contentHash,
      observedRawHash: fixture.current.byteHash,
      approvalReceiptHash: contract.approval.receiptHash,
      checkedAt: fixture.current.fetchedAt,
    });
    const check = () =>
      authorityRenewalErrors(
        fixture.primary,
        [fixture.current],
        contract.approval.scopeDigest,
        Date.parse("2026-10-31T01:07:00Z"),
      );
    assert.equal(
      authorityProjectionDigest(contract.projectionId, meta.url, reviewed),
      contract.canonicalDigest,
    );
    assert.equal(
      authorityProjectionDigest(contract.projectionId, meta.url, observed),
      contract.canonicalDigest,
    );
    assert.deepEqual(check(), []);
    contract.approval.reviewedAt = "2026-10-31T01:06:16Z";
    assert.match(check().join(" "), /approval date/);
  }
});
