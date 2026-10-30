import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  authorityProjectionDigest,
  authorityRenewalErrors,
  checkRace,
  clarityIdentityErrors,
  expectedRoster,
  finalScopeErrors,
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
