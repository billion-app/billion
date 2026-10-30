import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  ClarityCandidateCrosswalk,
  ResearchSource,
} from "@acme/validators";
import { researchSourceSchema } from "@acme/validators";

import {
  appendReviewedClaritySanJoseRoster,
  clarityCandidateCrosswalkDigest,
  decodeClarityXmlZip,
  parseSantaClaraClarityDefinition,
} from "./california-clarity.js";
import {
  decodeCaliforniaRoster,
  parseSantaClaraQualifiedRoster,
  refreshReviewedSanJoseRoster,
  sanJoseScopeCrosswalkDigest,
} from "./california-roster.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const read = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const source = (
  id: string,
  url: string,
  text: string,
  format: ResearchSource["format"] = "json",
): ResearchSource => ({
  id,
  url,
  publisher: "County of Santa Clara Registrar of Voters",
  text,
  format,
  contentHash: hash(text),
  fetchedAt: "2026-10-30T19:19:28.483Z",
});
const root = "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/";
const definition = source(
  "definition",
  `${root}382435/json/en/summary.json`,
  read("scc-clarity-summary-2026.json"),
);
const settings = source(
  "settings",
  `${root}382435/json/en/electionsettings.json`,
  read("scc-clarity-settings-2026.json"),
);
const version = source("version", `${root}current_ver.txt`, "382435", "text");
function fixture() {
  const state = decodeCaliforniaRoster({
    bytes: readFileSync(new URL("./fixtures/C26GG.txt", import.meta.url)),
    fetchedAt: definition.fetchedAt,
    certification: source(
      "sos-cert",
      "https://elections.cdn.sos.ca.gov/cert.pdf",
      read("certified-2026.txt"),
      "pdf",
    ),
  });
  const raw = JSON.parse(read("scc-clarity-memberships-2026.json")) as {
    pdfContestCode: string;
    pdfCandidateOrdinal: string | null;
    writeInSourceCandidateID?: string;
    clarityContestKey: string;
    clarityChoiceIndex0: number;
    clarityChoiceName: string;
    status: string;
  }[];
  const document: Omit<ClarityCandidateCrosswalk, "review"> = {
    schemaVersion: 1,
    electionDate: "2026-11-03",
    definitionHash: definition.contentHash,
    members: raw.map((m) => ({
      sourceContestId: m.pdfContestCode,
      sourceOrdinal:
        m.pdfCandidateOrdinal ?? `write-in:${m.writeInSourceCandidateID}`,
      clarityContestKey: m.clarityContestKey,
      clarityChoiceIndex: m.clarityChoiceIndex0,
      name: m.clarityChoiceName,
      status:
        m.status === "qualified_write_in" ? "qualified_write_in" : "on_ballot",
    })),
  };
  const identityCrosswalk = {
    ...document,
    review: {
      digest: clarityCandidateCrosswalkDigest(document),
      actorId: "test-fixture-reviewer",
      reviewedAt: definition.fetchedAt,
    },
  };
  const county = parseSantaClaraQualifiedRoster(
    source(
      "historical",
      "https://files.santaclaracounty.gov/qualified.pdf",
      read("scc-qualified-2026.txt"),
      "pdf",
    ),
  );
  const scopeDoc = {
    schemaVersion: 1 as const,
    electionDate: "2026-11-03" as const,
    rosterSourceHash: definition.contentHash,
    method: "Synthetic territorial classifications for parser tests only.",
    entries: county.map((c) => ({
      sourceContestId: c.sourceContestId,
      status: !c.onBallot
        ? ("off_ballot" as const)
        : ["5205", "5207", "5209", "3681"].includes(c.sourceContestId)
          ? ("include" as const)
          : ("pending" as const),
      reason: "Test fixture, not production territorial verification.",
      jurisdiction: "test:local-jurisdiction",
      jurisdictionLabel: "Test jurisdiction",
      proofs: [{ url: definition.url, contentHash: definition.contentHash }],
    })),
  };
  const scopeCrosswalk = {
    ...scopeDoc,
    review: {
      digest: sanJoseScopeCrosswalkDigest(scopeDoc),
      actorId: "test-fixture-reviewer",
      reviewedAt: definition.fetchedAt,
    },
  };
  const precinctXml = decodeClarityXmlZip(
    readFileSync(
      new URL("./fixtures/scc-clarity-precincts-2026.zip", import.meta.url),
    ),
    `${root}382435/reports/detailwithoutvotetypesxml.zip`,
  );
  const precinctSource = source(
    "precincts",
    `${root}382435/reports/detailwithoutvotetypesxml.zip`,
    precinctXml,
    "text",
  );
  return {
    state,
    input: {
      definition,
      settings,
      currentVersion: version,
      proofSources: [precinctSource],
      scopeCrosswalk,
      identityCrosswalk,
    },
  };
}
test("current official Clarity definition covers every named local membership and excludes generic Write-in options", () => {
  const local = parseSantaClaraClarityDefinition(definition);
  assert.equal(local.length, 73);
  assert.equal(
    local.reduce(
      (n, r) => n + r.CH.filter((name) => name !== "Write-in").length,
      0,
    ),
    211,
  );
  const { state, input } = fixture();
  const snapshot = appendReviewedClaritySanJoseRoster(state, input);
  const members = snapshot.races
    .filter((r) => r.officeFamily === "local")
    .flatMap((r) => r.members);
  assert.equal(members.length, 12);
  assert.equal(
    members.find((m) => m.name === "Hina Patel")?.ballotStatus,
    "qualified_write_in",
  );
  assert.equal(snapshot.localPrimary?.kind, "scc_clarity");
  assert.equal(snapshot.localCoverage?.status, "pending");
  assert(
    members.every(
      (m) =>
        m.candidateId.includes("ca-scc-clarity:") &&
        /^\d+$/.test(m.sourceCandidateId),
    ),
  );
  assert(
    members.every((m) => definition.text.includes(m.sourceProof!.excerpt)),
  );
});
test("rejects stale current version, incomplete membership, wrong contest context and unreviewed mappings", () => {
  const { state, input } = fixture();
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        currentVersion: source("version", version.url, "382436", "text"),
      }),
    /current election report/,
  );
  const changed = {
    ...input.identityCrosswalk,
    members: input.identityCrosswalk.members.slice(1),
  };
  const { review, ...doc } = changed;
  const wrongXml = input.proofSources.map((p) => {
    const text = p.text.replace(
      "<ElectionDate>11/3/2026</ElectionDate>",
      "<ElectionDate>11/3/2028</ElectionDate>",
    );
    return { ...p, text, contentHash: hash(text) };
  });
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        proofSources: wrongXml,
      }),
    /XML election context mismatch/,
  );
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        identityCrosswalk: {
          ...doc,
          review: { ...review, digest: clarityCandidateCrosswalkDigest(doc) },
        },
      }),
    /complete local population/,
  );
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        identityCrosswalk: {
          ...input.identityCrosswalk,
          definitionHash: "a".repeat(64),
        },
      }),
    /unreviewed or stale/,
  );
});
test("Clarity renewal fetches fresh primary JSON without fetching historical PDF corroboration", async () => {
  const { state, input } = fixture();
  const historic = source(
    "historical",
    "https://files.santaclaracounty.gov/blocked.pdf",
    "Old corroboration retained with its real original timestamp.",
    "pdf",
  );
  const snapshot = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    historicalSources: [historic],
  });
  const calls: string[] = [];
  const renewed = await refreshReviewedSanJoseRoster(
    snapshot,
    state,
    async (_id, url) => {
      calls.push(url);
      const original = snapshot.additionalSources!.find((s) => s.url === url);
      assert(original);
      return { ...original, fetchedAt: "2026-10-31T00:00:00.000Z" };
    },
  );
  assert.equal(renewed.id, snapshot.id);
  assert(!calls.includes(historic.url));
  assert.equal(renewed.historicalSources?.[0]?.fetchedAt, historic.fetchedAt);
});
test("bounded ZIP extraction preserves the original official XML source text and rejects corruption", () => {
  const zip = readFileSync(
    new URL("./fixtures/scc-clarity-precincts-2026.zip", import.meta.url),
  );
  const url = `${root}382435/reports/detailwithoutvotetypesxml.zip`;
  const text = decodeClarityXmlZip(zip, url);
  assert.equal(
    hash(text),
    "9cb09b0d488abe8ac61133fce7ca9fdb7c34150fad81b30ab5cf8ea8dd3a085a",
  );
  assert.throws(
    () => decodeClarityXmlZip(zip, "https://example.com/arbitrary.zip"),
    /Unsupported/,
  );
  assert.throws(() =>
    decodeClarityXmlZip(zip.subarray(0, zip.length - 50), url),
  );
});

test("every real county membership retains its independently verified official XML Choice identity", () => {
  const { state, input } = fixture();
  const { review, ...scopeDoc } = input.scopeCrosswalk;
  const document = {
    ...scopeDoc,
    entries: scopeDoc.entries.map((entry) => ({
      ...entry,
      status:
        entry.status === "off_ballot"
          ? ("off_ballot" as const)
          : ("include" as const),
    })),
  };
  const scopeCrosswalk = {
    ...document,
    review: { ...review, digest: sanJoseScopeCrosswalkDigest(document) },
  };
  const snapshot = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    scopeCrosswalk,
  });
  const actual = snapshot.races
    .filter((r) => r.officeFamily === "local")
    .flatMap((r) => r.members.map((m) => m.candidateId))
    .sort();
  const expected = (
    JSON.parse(read("scc-clarity-memberships-2026.json")) as {
      verifiedSourceScopedIdentity: string;
    }[]
  )
    .map((m) => m.verifiedSourceScopedIdentity)
    .sort();
  assert.equal(actual.length, 211);
  assert.deepEqual(actual, expected);
});

function nextReportSources(
  snapshot: ReturnType<typeof appendReviewedClaritySanJoseRoster>,
  change: (text: string, url: string) => string = (text) => text,
) {
  return snapshot.additionalSources!.map((original) => {
    const url = original.url.replace("/127570/382435/", "/127570/382436/");
    let text = original.text;
    if (original.url === version.url) text = "382436";
    else if (original.url === settings.url) {
      const value = JSON.parse(text);
      value.versions.push("382436");
      value.websiteupdatedat = "10/30/2026 1:00:00 PM PDT";
      text = JSON.stringify(value, null, 2);
    } else if (original.url === definition.url) {
      const value = JSON.parse(text);
      value[0].V[0] = 123;
      value[0].TV = 123;
      text = JSON.stringify(value, null, 2);
    } else if (original.url.endsWith("detailwithoutvotetypesxml.zip"))
      text = text
        .replaceAll('totalVotes="0"', 'totalVotes="123"')
        .replaceAll('Total_Votes="0"', 'Total_Votes="123"');
    text = change(text, url);
    return {
      ...original,
      url,
      text,
      contentHash: hash(text),
      fetchedAt: "2026-10-31T00:00:00.000Z",
    };
  });
}
test("report version and tally changes derive a fresh binding without rewriting original reviews", async () => {
  const { state, input } = fixture();
  const original = appendReviewedClaritySanJoseRoster(state, input);
  const reviews = JSON.stringify({
    scope: original.localCrosswalk,
    identity: original.localPrimary!.identityCrosswalk,
    sources: original.localPrimary!.reviewedSources,
  });
  const next = nextReportSources(original);
  const calls: string[] = [];
  const refreshed = await refreshReviewedSanJoseRoster(
    original,
    state,
    async (_id, url) => {
      calls.push(url);
      const observed = next.find((source) => source.url === url);
      assert(observed, `Unexpected source ${url}`);
      return observed;
    },
  );
  assert(calls.some((url) => url.includes("/382436/json/en/summary.json")));
  assert(!calls.some((url) => url.includes("/382435/")));
  const proof = refreshed.localPrimary?.derivation;
  assert(proof);
  assert.equal(proof.algorithmVersion, "scc-clarity-semantic-v1");
  assert.equal(proof.fromSnapshotId, original.id);
  assert.equal(proof.reviewedDefinitionHash, definition.contentHash);
  assert.notEqual(proof.observedDefinitionHash, definition.contentHash);
  assert.equal(
    JSON.stringify({
      scope: refreshed.localCrosswalk,
      identity: refreshed.localPrimary!.identityCrosswalk,
      sources: refreshed.localPrimary!.reviewedSources,
    }),
    reviews,
  );
  assert.deepEqual(
    refreshed.races.map((r) => r.members.map((m) => m.candidateId)),
    original.races.map((r) => r.members.map((m) => m.candidateId)),
  );
  assert.equal(refreshed.id, original.id);
  assert.deepEqual(
    refreshed.races.map((race) => race.rosterDigest),
    original.races.map((race) => race.rosterDigest),
  );
  const renewed = await refreshReviewedSanJoseRoster(
    refreshed,
    state,
    async (_id, url) => ({
      ...next.find((source) => source.url === url)!,
      fetchedAt: "2026-10-31T01:00:00.000Z",
    }),
  );
  assert.equal(renewed.id, refreshed.id);
  assert.deepEqual(renewed.localPrimary?.derivation, proof);
});
test("semantic renewal rejects changed candidate membership, seat authority and precinct routing", async () => {
  const { state, input } = fixture();
  const original = appendReviewedClaritySanJoseRoster(state, input);
  for (const change of [
    (text: string, url: string) =>
      url.endsWith(".zip")
        ? text.replace(
            'text="Nora Campos" totalVotes=',
            'text="Nora Campos" eligibilityStatus="withdrawn" totalVotes=',
          )
        : text,
    (text: string) => text.replaceAll("Nora Campos", "Nora Changed"),
    (text: string, url: string) =>
      url.endsWith("summary.json")
        ? JSON.stringify(
            (JSON.parse(text) as { K: string; VF: number }[]).map((row) =>
              row.K === "86" ? { ...row, VF: 2 } : row,
            ),
            null,
            2,
          )
        : url.endsWith(".zip")
          ? text.replace(
              'key="86" text="City of San José Council, District 5" voteFor="1"',
              'key="86" text="City of San José Council, District 5" voteFor="2"',
            )
          : text,
    (text: string, url: string) =>
      url.endsWith(".zip")
        ? text.replace(
            'name="0002001" Registered_Voters=',
            'name="9999999" Registered_Voters=',
          )
        : text,
  ]) {
    const fresh = nextReportSources(original, change);
    await assert.rejects(
      () =>
        refreshReviewedSanJoseRoster(
          original,
          state,
          async (_id, url) => fresh.find((source) => source.url === url)!,
        ),
      /changed; new scope and identity review required/,
    );
  }
});
test("semantic renewal rejects changed external territorial proofs", async () => {
  const { state, input } = fixture();
  const geo = source(
    "geometry",
    "https://maps.santaclaracounty.gov/official-boundary.json",
    JSON.stringify({
      type: "FeatureCollection",
      features: [],
      boundaryVersion: 1,
    }),
  );
  const original = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    proofSources: [...input.proofSources, geo],
  });
  const fresh = nextReportSources(original, (text, url) =>
    url === geo.url
      ? text.replace('"boundaryVersion":1', '"boundaryVersion":2')
      : text,
  );
  await assert.rejects(
    () =>
      refreshReviewedSanJoseRoster(
        original,
        state,
        async (_id, url) => fresh.find((source) => source.url === url)!,
      ),
    /Territorial proof changed/,
  );
});

test("a version-only report advance records derivation even when definition bytes are identical", async () => {
  const { state, input } = fixture();
  const original = appendReviewedClaritySanJoseRoster(state, input);
  const observed = nextReportSources(original).map((current) => {
    const prior = original.additionalSources!.find(
      (source) => source.id === current.id,
    )!;
    if (
      current.url.endsWith("summary.json") ||
      current.url.endsWith("detailwithoutvotetypesxml.zip")
    )
      return { ...current, text: prior.text, contentHash: prior.contentHash };
    return current;
  });
  const refreshed = await refreshReviewedSanJoseRoster(
    original,
    state,
    async (_id, url) => observed.find((source) => source.url === url)!,
  );
  assert.equal(
    refreshed.localPrimary?.derivation?.reviewedDefinitionHash,
    definition.contentHash,
  );
  assert.equal(
    refreshed.localPrimary?.derivation?.observedDefinitionHash,
    definition.contentHash,
  );
  assert.equal(refreshed.id, original.id);
  assert(refreshed.localPrimary?.definitionURL.includes("/382436/"));
  assert.deepEqual(refreshed.localCrosswalk, original.localCrosswalk);
});

test("visual territorial proof raw-byte changes reject even when extracted text is identical", async () => {
  const { state, input } = fixture();
  const visual = {
    ...source(
      "visual-map",
      "https://maps.example.gov/adopted-C1.pdf",
      "Adopted trustee area plan C1, map title only.",
      "pdf",
    ),
    byteHash: "a".repeat(64),
  };
  const { review, ...scopeDoc } = input.scopeCrosswalk;
  const document = {
    ...scopeDoc,
    entries: scopeDoc.entries.map((entry) =>
      entry.status === "include"
        ? {
            ...entry,
            proofs: [
              ...entry.proofs,
              {
                url: visual.url,
                contentHash: visual.contentHash,
                byteHash: visual.byteHash,
              },
            ],
          }
        : entry,
    ),
  };
  const scopeCrosswalk = {
    ...document,
    review: { ...review, digest: sanJoseScopeCrosswalkDigest(document) },
  };
  const original = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    scopeCrosswalk,
    proofSources: [...input.proofSources, visual],
  });
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk,
        proofSources: [
          ...input.proofSources,
          { ...visual, byteHash: "b".repeat(64) },
        ],
      }),
    /territorial proof is missing or changed/,
  );
  const fresh = nextReportSources(original).map((source) =>
    source.url === visual.url
      ? { ...source, byteHash: "b".repeat(64) }
      : source,
  );
  await assert.rejects(
    () =>
      refreshReviewedSanJoseRoster(
        original,
        state,
        async (_id, url) => fresh.find((source) => source.url === url)!,
      ),
    /raw bytes changed/,
  );
  assert.equal(
    original.localCrosswalk?.entries
      .find((entry) => entry.status === "include")
      ?.proofs.find((ref) => ref.url === visual.url)?.byteHash,
    visual.byteHash,
  );
});

test("image territory archives carry actual bytes without invented source text", () => {
  const { state, input } = fixture();
  const binaryBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ3kAAAAASUVORK5CYII=";
  const image = {
    ...source(
      "adopted-image",
      "https://maps.example.gov/adopted.png",
      "",
      "image",
    ),
    binaryBase64,
    byteHash: createHash("sha256")
      .update(Buffer.from(binaryBase64, "base64"))
      .digest("hex"),
  };
  assert(researchSourceSchema.safeParse(image).success);
  assert(
    !researchSourceSchema.safeParse({
      ...image,
      text: "Invented image quotation",
    }).success,
  );
  assert(
    !researchSourceSchema.safeParse({ ...image, binaryBase64: undefined })
      .success,
  );
  const { review, ...scopeDoc } = input.scopeCrosswalk;
  const document = {
    ...scopeDoc,
    entries: scopeDoc.entries.map((entry) =>
      entry.status === "include"
        ? {
            ...entry,
            proofs: [
              ...entry.proofs,
              {
                url: image.url,
                contentHash: image.contentHash,
                byteHash: image.byteHash,
              },
            ],
          }
        : entry,
    ),
  };
  const scopeCrosswalk = {
    ...document,
    review: { ...review, digest: sanJoseScopeCrosswalkDigest(document) },
  };
  const snapshot = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    scopeCrosswalk,
    proofSources: [...input.proofSources, image],
  });
  assert.equal(
    snapshot.additionalSources?.find((source) => source.id === image.id)?.text,
    "",
  );
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk,
        proofSources: [
          ...input.proofSources,
          {
            ...image,
            binaryBase64: Buffer.from("changed bytes").toString("base64"),
          },
        ],
      }),
    /Image proof archive bytes/,
  );
  const weak = {
    ...document,
    entries: document.entries.map((entry) => ({
      ...entry,
      proofs: entry.proofs.map((ref) => ({
        url: ref.url,
        contentHash: ref.contentHash,
      })),
    })),
  };
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk: {
          ...weak,
          review: { ...review, digest: sanJoseScopeCrosswalkDigest(weak) },
        },
        proofSources: [...input.proofSources, image],
      }),
    /must bind its strong byte hash/,
  );
});
test("historical write-in qualification binds the actual dated official record without becoming a fresh fetch", async () => {
  const { state, input } = fixture();
  const archive = source(
    "qualified-archive",
    "https://files.santaclaracounty.gov/exjcpb1296/2026-10/writeincandidates_final.pdf",
    read("scc-writeins-2026.txt"),
    "pdf",
  );
  const { review, ...scopeDoc } = input.scopeCrosswalk;
  const document = {
    ...scopeDoc,
    entries: scopeDoc.entries.map((entry) =>
      entry.sourceContestId === "3681"
        ? {
            ...entry,
            proofs: [
              ...entry.proofs,
              {
                url: archive.url,
                contentHash: archive.contentHash,
                role: "historical_qualification" as const,
              },
            ],
          }
        : entry,
    ),
  };
  const scopeCrosswalk = {
    ...document,
    review: { ...review, digest: sanJoseScopeCrosswalkDigest(document) },
  };
  const snapshot = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    scopeCrosswalk,
    historicalSources: [archive],
  });
  assert(
    !snapshot.additionalSources?.some((source) => source.url === archive.url),
  );
  assert.equal(snapshot.historicalSources?.[0]?.fetchedAt, archive.fetchedAt);
  const fresh = nextReportSources(snapshot);
  const calls: string[] = [];
  const renewed = await refreshReviewedSanJoseRoster(
    snapshot,
    state,
    async (_id, url) => {
      calls.push(url);
      return fresh.find((source) => source.url === url)!;
    },
  );
  assert(!calls.includes(archive.url));
  assert.deepEqual(renewed.historicalSources, snapshot.historicalSources);
  const changedText = archive.text.replace("Hina Patel", "Another Person");
  const changedArchive = {
    ...archive,
    text: changedText,
    contentHash: hash(changedText),
  };
  const wrong = {
    ...document,
    entries: document.entries.map((entry) => ({
      ...entry,
      proofs: entry.proofs.map((ref) =>
        ref.url === archive.url
          ? { ...ref, contentHash: changedArchive.contentHash }
          : ref,
      ),
    })),
  };
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk: {
          ...wrong,
          review: { ...review, digest: sanJoseScopeCrosswalkDigest(wrong) },
        },
        historicalSources: [changedArchive],
      }),
    /qualification does not match/,
  );
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk,
        historicalSources: [],
      }),
    /must be the archived official/,
  );
});

test("historical county row aliases bind exact IDs while preserving reviewed cross-source name variants", () => {
  const { state, input } = fixture();
  const qualified = source(
    "historical-qualified",
    "https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-fixture.pdf",
    read("scc-qualified-2026.txt"),
    "pdf",
  );
  const { review, ...scopeDoc } = input.scopeCrosswalk;
  const document = { ...scopeDoc, rosterSourceHash: qualified.contentHash };
  const scopeCrosswalk = {
    ...document,
    review: { ...review, digest: sanJoseScopeCrosswalkDigest(document) },
  };
  const snapshot = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    scopeCrosswalk,
    historicalSources: [qualified],
  });
  assert.equal(
    snapshot.localCrosswalk?.rosterSourceHash,
    qualified.contentHash,
  );
  assert.equal(
    snapshot.localPrimary?.identityCrosswalk.definitionHash,
    definition.contentHash,
  );
  const { review: identityReview, ...identityDoc } = input.identityCrosswalk;
  const badIdentity = {
    ...identityDoc,
    members: identityDoc.members.map((member, index) =>
      index === 0 ? { ...member, sourceOrdinal: "999" } : member,
    ),
  };
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk,
        historicalSources: [qualified],
        identityCrosswalk: {
          ...badIdentity,
          review: {
            ...identityReview,
            digest: clarityCandidateCrosswalkDigest(badIdentity),
          },
        },
      }),
    /not a complete reviewed bijection/,
  );
  assert.throws(
    () =>
      appendReviewedClaritySanJoseRoster(state, {
        ...input,
        scopeCrosswalk,
        historicalSources: [],
      }),
    /crosswalk is unreviewed or stale/,
  );
});

test("two successive real-shaped authority refreshes preserve semantic ID and immutable review basis", async () => {
  const { state, input } = fixture();
  const metadata = JSON.parse(read("authority-projection-sources.json")) as {
    id: string;
    url: string;
    publisher: string;
  }[];
  const pairs = metadata.map((meta) => {
    const prefix = meta.id === "mvla-authority" ? "mvla-authority" : "cde-item";
    const original = {
      ...source(meta.id, meta.url, read(`${prefix}-reviewed.txt`), "text"),
      publisher: meta.publisher,
    };
    const observedText = read(`${prefix}-observed.txt`);
    return {
      original,
      observed: {
        ...original,
        text: observedText,
        contentHash: hash(observedText),
        byteHash: hash(observedText),
      },
    };
  });
  const { review, ...scopeDoc } = input.scopeCrosswalk;
  const document = {
    ...scopeDoc,
    entries: scopeDoc.entries.map((entry) =>
      entry.status === "include"
        ? {
            ...entry,
            proofs: [
              ...entry.proofs,
              ...pairs.map((pair) => ({
                url: pair.original.url,
                contentHash: pair.original.contentHash,
              })),
            ],
          }
        : entry,
    ),
  };
  const scopeCrosswalk = {
    ...document,
    review: { ...review, digest: sanJoseScopeCrosswalkDigest(document) },
  };
  const { authorityProjectionDigest } =
    await import("./california-source-projections.js");
  const sourceRenewalProjections = pairs.map(({ original }) => {
    const projectionId =
      original.id === "mvla-authority"
        ? ("mvla-trustee-authority-seven-asset-versions-v1" as const)
        : ("cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1" as const);
    return {
      projectionId,
      url: original.url,
      publisher: original.publisher,
      format: "text" as const,
      reviewedContentHash: original.contentHash,
      reviewedRawHash: original.contentHash,
      canonicalDigest: authorityProjectionDigest(projectionId, original.text),
      reviewedSource: original,
      approval: {
        actorId: "test-specific-projection-reviewer",
        reviewedAt: definition.fetchedAt,
        receiptHash: "b".repeat(64),
        scopeDigest: scopeCrosswalk.review.digest,
        reviewedSourceBundleHash: "c".repeat(64),
      },
    };
  });
  const first = appendReviewedClaritySanJoseRoster(state, {
    ...input,
    scopeCrosswalk,
    sourceRenewalProjections,
    proofSources: [
      ...input.proofSources,
      ...pairs.map((pair) => pair.observed),
    ],
  });
  const originalReview = hash(
    JSON.stringify({
      scope: first.localCrosswalk,
      identity: first.localPrimary?.identityCrosswalk,
      archives: first.localPrimary?.reviewedSources,
    }),
  );
  const second = await refreshReviewedSanJoseRoster(
    first,
    state,
    async (_id, url) => {
      const prior = first.additionalSources!.find(
        (source) => source.url === url,
      )!;
      let text = prior.text;
      if (url === pairs[0]!.original.url) {
        const json = JSON.parse(text);
        json.numViews++;
        json.lastViewed++;
        text = JSON.stringify(json);
      } else if (url === pairs[1]!.original.url)
        text = text.replaceAll("20261030194310", "20261030200000");
      return {
        ...prior,
        text,
        contentHash: hash(text),
        byteHash: hash(text),
        fetchedAt: "2026-10-30T21:00:00.000Z",
      };
    },
  );
  assert.equal(first.id, second.id);
  assert.deepEqual(
    first.races.map((race) => race.rosterDigest),
    second.races.map((race) => race.rosterDigest),
  );
  assert.notDeepEqual(
    first.localPrimary?.sourceProjectionProofs,
    second.localPrimary?.sourceProjectionProofs,
  );
  assert.equal(
    hash(
      JSON.stringify({
        scope: second.localCrosswalk,
        identity: second.localPrimary?.identityCrosswalk,
        archives: second.localPrimary?.reviewedSources,
      }),
    ),
    originalReview,
  );
  assert.deepEqual(
    second.localPrimary?.sourceProjectionProofs?.map(
      (proof) => proof.checkedAt,
    ),
    ["2026-10-30T21:00:00.000Z", "2026-10-30T21:00:00.000Z"],
  );
});
