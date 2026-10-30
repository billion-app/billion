import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decodeCaliforniaRoster } from "./california-roster.js";

const bytes = readFileSync(new URL("./fixtures/C26GG.txt", import.meta.url));
const text = readFileSync(
  new URL("./fixtures/certified-2026.txt", import.meta.url),
  "utf8",
);
const input = {
  bytes,
  fetchedAt: "2026-10-30T18:38:00.000Z",
  certification: {
    id: "certified",
    url: "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
    publisher: "California Secretary of State",
    format: "pdf" as const,
    text,
    contentHash: createHash("sha256").update(text).digest("hex"),
    fetchedAt: "2026-10-30T18:38:00.000Z",
  },
};
test("enumerates the complete certified roster and retains pilot identities", () => {
  const s = decodeCaliforniaRoster(input);
  assert.equal(s.races.length, 228);
  assert.equal(
    s.races.reduce((n, r) => n + r.members.length, 0),
    388,
  );
  assert.equal(s.races.filter((r) => r.kind === "retention").length, 64);
  assert.equal(s.excludedContests.length, 14);
  assert.equal(s.countyCoverage.length, 58);
  assert.equal(
    s.races.find((r) => r.raceKey === "ca-house-17-2026")?.members[0]?.identity
      .jurisdiction,
    "ocd-division/country:us/state:ca/cd:17",
  );
  assert(
    s.races
      .flatMap((r) => r.members)
      .some((m) => m.name === "Peter Sundin Soulé"),
  );
  assert.equal(
    s.races.filter(
      (r) => r.officeFamily === "state_assembly" && r.members.length === 1,
    ).length,
    4,
  );
});
test("snapshot and roster digests ignore retrieval time", () => {
  assert.equal(
    decodeCaliforniaRoster(input).id,
    decodeCaliforniaRoster({ ...input, fetchedAt: "2026-10-31T00:00:00.000Z" })
      .id,
  );
});
test("rejects malformed, duplicate, unknown, incomplete and wrong-election records", () => {
  const raw = new TextDecoder("windows-1252").decode(bytes);
  const alter = (s: string) => ({
    ...input,
    bytes: new TextEncoder().encode(s),
  });
  assert.throws(() =>
    decodeCaliforniaRoster(alter(raw.replace("[C|CAS|2|", "[X|CAS|2|"))),
  );
  assert.throws(
    () =>
      decodeCaliforniaRoster(
        alter(raw.replace("|3654||Becerra", "|3631||Becerra")),
      ),
    /Duplicate/,
  );
  assert.throws(() =>
    decodeCaliforniaRoster(alter(raw.replace("020000000000", "990000000000"))),
  );
  assert.throws(() =>
    decodeCaliforniaRoster(alter(raw.replace("|3631||Hilton", "|||Hilton"))),
  );
  assert.throws(() =>
    decodeCaliforniaRoster({ ...input, electionDate: "2028-11-07" }),
  );
});
test("rejects changed membership and judicial seat context", () => {
  assert.throws(
    () =>
      decodeCaliforniaRoster({
        ...input,
        certification: {
          ...input.certification,
          text: text.replace("Fiona Ma Democratic", "Someone Else Democratic"),
        },
      }),
    /membership/,
  );
  assert.throws(
    () =>
      decodeCaliforniaRoster({
        ...input,
        certification: {
          ...input.certification,
          text: text.replace(
            "Shall Presiding Justice TRACIE L. BROWN",
            "Shall Presiding Justice SOMEONE ELSE",
          ),
        },
      }),
    /judicial identity/,
  );
});
test("changing one race membership invalidates only that roster digest", () => {
  const original = decodeCaliforniaRoster(input);
  const changedText = new TextDecoder("windows-1252")
    .decode(bytes)
    .replace("Fiona Ma|", "Fiona New Name|");
  const encoded = Buffer.from(changedText, "latin1");
  const changed = decodeCaliforniaRoster({
    ...input,
    bytes: encoded,
    certification: {
      ...input.certification,
      text: text.replace("Fiona Ma Democratic", "Fiona New Name Democratic"),
    },
  });
  assert.notEqual(changed.id, original.id);
  const changedRaces = changed.races.filter(
    (race, i) => race.rosterDigest !== original.races[i]?.rosterDigest,
  );
  assert.deepEqual(
    changedRaces.map((r) => r.raceKey),
    ["ca-lieutenant-governor-2026"],
  );
  assert.equal(
    changedRaces[0]?.members[0]?.candidateId,
    original.races.find((r) => r.raceKey === "ca-lieutenant-governor-2026")
      ?.members[0]?.candidateId,
  );
});
test("retention certification rejects a mismatched court division", () => {
  assert.throws(
    () =>
      decodeCaliforniaRoster({
        ...input,
        certification: {
          ...input.certification,
          text: text.replace(
            "First District, Division One\nShall Associate Justice CHARLES A. SMILEY",
            "First District, Division Two\nShall Associate Justice CHARLES A. SMILEY",
          ),
        },
      }),
    /Judicial district mismatch/,
  );
});

test("Santa Clara local census reconciles footer and excludes off-ballot membership", async () => {
  const { parseSantaClaraQualifiedRoster, appendSanJoseRoster } =
    await import("./california-roster.js");
  const countyText = readFileSync(
    new URL("./fixtures/scc-qualified-2026.txt", import.meta.url),
    "utf8",
  );
  const source = {
    ...input.certification,
    id: "scc-qualified",
    url: "https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-9-28-26.pdf?VersionId=CM6jbwAVTLFIjLakj6hJku2l9KPAIxli",
    text: countyText,
    contentHash: createHash("sha256").update(countyText).digest("hex"),
  };
  const contests = parseSantaClaraQualifiedRoster(source);
  assert.equal(contests.length, 129);
  assert.equal(
    contests.reduce((n, c) => n + c.members.length, 0),
    287,
  );
  assert.equal(contests.filter((c) => c.onBallot).length, 73);
  assert.equal(
    contests
      .filter((c) => c.onBallot)
      .reduce((n, c) => n + c.members.length, 0),
    209,
  );
  const selections = ["5205", "5207", "5209"].map((sourceContestId) => ({
    sourceContestId,
    jurisdiction: "ocd-division/country:us/state:ca/place:san_jose",
    jurisdictionLabel: "City of San José",
    district: sourceContestId.at(-1)!,
    proofSource: source,
    proofExcerpt: contests.find((c) => c.sourceContestId === sourceContestId)!
      .office,
    proofLocator: `Contest ${sourceContestId}`,
  }));
  const union = appendSanJoseRoster(decodeCaliforniaRoster(input), {
    source,
    selections,
    status: "pending",
    notes:
      "Municipal-only verified subset. School and special district census remains pending.",
  });
  assert.equal(union.races.length, 231);
  assert.equal(union.localCoverage?.expectedCandidates, null);
  assert.equal(
    union.races
      .filter((r) => r.officeFamily === "local")
      .flatMap((r) => r.members).length,
    6,
  );
  assert(
    union.races
      .filter((r) => r.officeFamily === "local")
      .every((r) =>
        r.members.every((m) =>
          m.sourceCandidateId.startsWith("qualified-row:"),
        ),
      ),
  );
  assert.throws(
    () =>
      appendSanJoseRoster(decodeCaliforniaRoster(input), {
        source,
        selections: [{ ...selections[0]!, sourceContestId: "3120" }],
        status: "pending",
        notes: "test",
      }),
    /not an on-ballot/,
  );
  assert.throws(
    () =>
      parseSantaClaraQualifiedRoster({
        ...source,
        text: countyText.replace("Grand Total: 287", "Grand Total: 286"),
        contentHash: createHash("sha256")
          .update(countyText.replace("Grand Total: 287", "Grand Total: 286"))
          .digest("hex"),
      }),
    /footer mismatch/,
  );
});

test("qualified write-ins remain a distinct membership status with the official ID", async () => {
  const { parseSantaClaraQualifiedWriteIns, appendSanJoseRoster } =
    await import("./california-roster.js");
  const localText = readFileSync(
    new URL("./fixtures/scc-qualified-2026.txt", import.meta.url),
    "utf8",
  );
  const writeInText = readFileSync(
    new URL("./fixtures/scc-writeins-2026.txt", import.meta.url),
    "utf8",
  );
  const source = {
    ...input.certification,
    id: "local",
    url: "https://files.santaclaracounty.gov/qualified.pdf",
    text: localText,
    contentHash: createHash("sha256").update(localText).digest("hex"),
  };
  const writeInSource = {
    ...input.certification,
    id: "write-ins",
    url: "https://files.santaclaracounty.gov/write-ins.pdf",
    text: writeInText,
    contentHash: createHash("sha256").update(writeInText).digest("hex"),
  };
  const writeIns = parseSantaClaraQualifiedWriteIns(writeInSource);
  assert.equal(writeIns.length, 2);
  assert.deepEqual(
    writeIns.find((m) => m.sourceContestId === "3681")?.sourceCandidateId,
    "6",
  );
  const proofText = "Orchard School District serves San José.";
  const proofSource = {
    ...input.certification,
    id: "territory",
    text: proofText,
    contentHash: createHash("sha256").update(proofText).digest("hex"),
  };
  const snapshot = appendSanJoseRoster(decodeCaliforniaRoster(input), {
    source,
    writeInSource,
    selections: [
      {
        sourceContestId: "3681",
        jurisdiction: "ca-scc:orchard-sd",
        jurisdictionLabel: "Orchard School District",
        district: null,
        proofSource,
        proofExcerpt: proofText,
        proofLocator: "Test-only territorial fixture",
      },
    ],
    status: "pending",
    notes: "Fixture only. Other territorial membership remains unresolved.",
  });
  const members = snapshot.races.find(
    (r) => r.sourceContestId === "3681",
  )?.members;
  assert.equal(members?.length, 6);
  assert.equal(
    members?.find((m) => m.name === "Hina Patel")?.ballotStatus,
    "qualified_write_in",
  );
  assert.equal(
    members?.find((m) => m.name === "Hina Patel")?.sourceCandidateId,
    "6",
  );
  assert.throws(
    () =>
      parseSantaClaraQualifiedWriteIns({
        ...writeInSource,
        text: writeInText.replace(
          "General Election - 11/3/2026",
          "General Election - 11/3/2028",
        ),
        contentHash: createHash("sha256")
          .update(
            writeInText.replace(
              "General Election - 11/3/2026",
              "General Election - 11/3/2028",
            ),
          )
          .digest("hex"),
      }),
    /election/,
  );
});

test("reviewed territorial crosswalk is snapshot-bound and refresh fails when a proof changes", async () => {
  const {
    parseSantaClaraQualifiedRoster,
    appendReviewedSanJoseRoster,
    sanJoseScopeCrosswalkDigest,
    refreshReviewedSanJoseRoster,
  } = await import("./california-roster.js");
  const countyText = readFileSync(
    new URL("./fixtures/scc-qualified-2026.txt", import.meta.url),
    "utf8",
  );
  const source = {
    ...input.certification,
    id: "san-jose-qualified-roster",
    url: "https://files.santaclaracounty.gov/qualified.pdf",
    text: countyText,
    contentHash: createHash("sha256").update(countyText).digest("hex"),
  };
  const contests = parseSantaClaraQualifiedRoster(source);
  const document = {
    schemaVersion: 1 as const,
    electionDate: "2026-11-03" as const,
    rosterSourceHash: source.contentHash,
    method:
      "Test fixture represents an independently reviewed territorial mapping.",
    entries: contests.map((c) => ({
      sourceContestId: c.sourceContestId,
      status: !c.onBallot
        ? ("off_ballot" as const)
        : ["5205", "5207", "5209"].includes(c.sourceContestId)
          ? ("include" as const)
          : ("pending" as const),
      reason: "Test fixture only.",
      jurisdiction: "ocd-division/country:us/state:ca/place:san_jose",
      jurisdictionLabel: "City of San José",
      district: null,
      proofs: [{ url: source.url, contentHash: source.contentHash }],
    })),
  };
  const crosswalk = {
    ...document,
    review: {
      digest: sanJoseScopeCrosswalkDigest(document),
      actorId: "test-reviewer",
      reviewedAt: input.fetchedAt,
    },
  };
  const state = decodeCaliforniaRoster(input);
  const composite = appendReviewedSanJoseRoster(state, {
    source,
    proofSources: [],
    crosswalk,
  });
  assert.equal(composite.localCoverage?.status, "pending");
  assert.equal(composite.localCoverage?.pendingRaces, 70);
  assert.equal(
    composite.races.find((r) => r.officeFamily === "local")?.territoryProof &&
      "kind" in
        composite.races.find((r) => r.officeFamily === "local")!
          .territoryProof!,
    true,
  );
  const renewed = await refreshReviewedSanJoseRoster(
    composite,
    state,
    async () => ({ ...source, fetchedAt: "2026-10-31T00:00:00.000Z" }),
  );
  assert.equal(renewed.id, composite.id);
  assert.throws(
    () =>
      appendReviewedSanJoseRoster(state, {
        source,
        proofSources: [],
        crosswalk: { ...crosswalk, method: "unreviewed changed method" },
      }),
    /digest mismatch/,
  );
  await assert.rejects(
    () =>
      refreshReviewedSanJoseRoster(composite, state, async () => ({
        ...source,
        text: source.text + " changed",
        contentHash: createHash("sha256")
          .update(source.text + " changed")
          .digest("hex"),
      })),
    /digest mismatch/,
  );
});
