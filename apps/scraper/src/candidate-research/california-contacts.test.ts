import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  ResearchSource,
} from "@acme/validators";

import {
  inspectCaliforniaOfficialContactArchive,
  resolveCaliforniaOfficialCampaignWebsite,
} from "./california-contacts.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const read = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
interface Membership {
  pdfContestCode: string;
  pdfCandidateOrdinal: string | null;
  writeInSourceCandidateID?: string;
  clarityContestKey: string;
  clarityChoiceIndex0: number;
  clarityChoiceName: string;
  clarityXMLChoiceKey: string;
  verifiedSourceScopedIdentity: string;
  status: string;
}
const memberships = JSON.parse(
  read("scc-clarity-memberships-2026.json"),
) as Membership[];
const qualified = read("scc-qualified-2026.txt");
const sourceURL =
  "https://files.santaclaracounty.gov/exjcpb1296/2026-09/qualified-list-of-local-candidates-9-28-26.pdf?VersionId=CM6jbwAVTLFIjLakj6hJku2l9KPAIxli";
const source = (text: string, url = sourceURL): ResearchSource => ({
  id: url.includes("writein") ? "historical-writeins" : "historical-qualified",
  url,
  publisher: "County of Santa Clara Registrar of Voters",
  format: "pdf",
  text,
  contentHash: hash(text),
  fetchedAt: "2026-10-20T16:30:08.000Z",
});
function fixture() {
  const races: CaliforniaRaceTarget[] = [];
  for (const row of memberships) {
    let race = races.find((r) => r.sourceContestId === row.pdfContestCode);
    const contestId = `ca-scc-clarity:2026-11-03:127570:${row.clarityContestKey}`;
    if (!race) {
      race = {
        raceKey: row.pdfContestCode,
        contestId,
        jurisdiction: `fixture:${row.pdfContestCode}`,
        jurisdictionLabel: "Fixture county context",
        electionDate: "2026-11-03",
        sourceContestId: row.pdfContestCode,
        officeFamily: "local",
        office: "Fixture office",
        district: null,
        kind: "election",
        rosterDigest: "a".repeat(64),
        members: [],
      };
      races.push(race);
    }
    race.members.push({
      candidateId: row.verifiedSourceScopedIdentity,
      sourceCandidateId: row.clarityXMLChoiceKey,
      identity: {
        candidateId: row.verifiedSourceScopedIdentity,
        contestId,
        jurisdiction: race.jurisdiction,
        electionDate: race.electionDate,
      },
      name: row.clarityChoiceName,
      party: null,
      partyCode: "",
      ballotStatus:
        row.status === "qualified_write_in"
          ? "qualified_write_in"
          : "on_ballot",
    });
  }
  const snapshot: Pick<
    CaliforniaRosterSnapshot,
    "races" | "localPrimary" | "localCrosswalk" | "historicalSources"
  > = {
    races,
    localPrimary: {
      kind: "scc_clarity",
      definitionURL:
        "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/382435/json/en/summary.json",
      settingsURL:
        "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/382435/json/en/electionsettings.json",
      currentVersionURL:
        "https://results.enr.clarityelections.com/CA/Santa_Clara/127570/current_ver.txt",
      identityCrosswalk: {
        schemaVersion: 1,
        electionDate: "2026-11-03",
        definitionHash: hash(read("scc-clarity-summary-2026.json")),
        members: memberships.map((row) => ({
          sourceContestId: row.pdfContestCode,
          sourceOrdinal:
            row.pdfCandidateOrdinal ??
            `write-in:${row.writeInSourceCandidateID}`,
          clarityContestKey: row.clarityContestKey,
          clarityChoiceIndex: row.clarityChoiceIndex0,
          name: row.clarityChoiceName,
          status:
            row.status === "qualified_write_in"
              ? "qualified_write_in"
              : "on_ballot",
        })),
        review: {
          actorId: "fixture-reviewed-mapping",
          digest: "a".repeat(64),
          reviewedAt: "2026-10-30T00:00:00.000Z",
        },
      },
    },
    historicalSources: [
      source(qualified),
      source(
        read("scc-writeins-2026.txt"),
        "https://files.santaclaracounty.gov/exjcpb1296/2026-10/writeincandidates_102026-v3.pdf?VersionId=XSwtnLJSbo6VZ5rS3.DHdgMF040jZKp.",
      ),
    ],
    localCrosswalk: {
      schemaVersion: 1,
      electionDate: "2026-11-03",
      rosterSourceHash: hash(qualified),
      method: "Fixture source binding, not a production territorial review.",
      entries: [
        ...new Set(memberships.map((member) => member.pdfContestCode)),
      ].map((sourceContestId) => ({
        sourceContestId,
        status: "include",
        reason: "Fixture source binding.",
        proofs: [
          {
            url: "https://files.santaclaracounty.gov/exjcpb1296/2026-10/writeincandidates_102026-v3.pdf?VersionId=XSwtnLJSbo6VZ5rS3.DHdgMF040jZKp.",
            contentHash: hash(read("scc-writeins-2026.txt")),
            role: "historical_qualification",
          },
        ],
      })),
      review: {
        actorId: "fixture-reviewed-mapping",
        digest: "a".repeat(64),
        reviewedAt: "2026-10-30T00:00:00.000Z",
      },
    },
  };
  return snapshot;
}
function selected(snapshot: ReturnType<typeof fixture>, name: string) {
  const race = snapshot.races.find((race) =>
    race.members.some((member) => member.name === name),
  )!;
  return {
    snapshot,
    race,
    member: race.members.find((member) => member.name === name)!,
  };
}

test("all archived Website fields are contained in 287 exact county records", () => {
  const archive = inspectCaliforniaOfficialContactArchive(qualified);
  assert.equal(archive.recordCount, 287);
  assert.equal(archive.contestCount, 129);
});

test("the reviewed 99 memberships resolve exactly 44 own-record websites", () => {
  const snapshot = fixture();
  const codes = new Set([
    "3170",
    "3216",
    "3227",
    "3234",
    "3253",
    "3257",
    "3321",
    "3333",
    "3334",
    "3335",
    "3352",
    "3354",
    "3371",
    "3422",
    "3425",
    "3435",
    "3503",
    "3505",
    "3511",
    "3521",
    "3533",
    "3534",
    "3551",
    "3561",
    "3641",
    "3672",
    "3673",
    "3675",
    "3681",
    "5205",
    "5207",
    "5209",
    "6001",
    "6006",
    "6007",
    "6020",
    "6051",
  ]);
  const results = snapshot.races
    .filter((race) => codes.has(race.sourceContestId))
    .flatMap((race) =>
      race.members.map((member) =>
        resolveCaliforniaOfficialCampaignWebsite({ snapshot, race, member }),
      ),
    );
  assert.equal(results.length, 99);
  assert.equal(results.filter((r) => r.status === "listed").length, 44);
  assert.equal(
    results.filter((r) => r.status === "identity_unresolved").length,
    0,
  );
  assert(
    results.every(
      (r) => r.officialSource?.fetchedAt === "2026-10-20T16:30:08.000Z",
    ),
  );
  for (const result of results) {
    assert(!JSON.stringify(result).includes("Email:"));
    assert(!JSON.stringify(result).includes("Res:"));
    if (result.url)
      assert(result.officialSource?.excerpt.startsWith("Website:"));
  }
});

test("a missing Website never borrows the next candidate or contest field", () => {
  const snapshot = fixture();
  const result = resolveCaliforniaOfficialCampaignWebsite(
    selected(snapshot, "Raeena S. Lari"),
  );
  assert.equal(result.status, "missing");
  assert.equal(result.url, undefined);
  assert.match(result.officialSource!.excerpt, /^Qualified 1 Raeena/);
  const kepner = resolveCaliforniaOfficialCampaignWebsite(
    selected(snapshot, "Anne J. Kepner"),
  );
  assert.equal(kepner.url, "https://annekepner.org");
});

test("reviewed PDF name aliases use source ordinals rather than fuzzy names", () => {
  const snapshot = fixture();
  for (const name of [
    "Joseph ''Joe'' Brenner",
    "Harmony ″Jay″ McMillin",
    "Mary Hiền Pollett",
  ]) {
    const input = selected(snapshot, name);
    assert(input.member, `Missing fixture ${name}`);
    const result = resolveCaliforniaOfficialCampaignWebsite(input);
    assert.notEqual(result.status, "identity_unresolved");
    assert(result.officialSource?.recordDigest);
  }
  const input = selected(snapshot, "Anne J. Kepner");
  assert.equal(
    resolveCaliforniaOfficialCampaignWebsite({
      ...input,
      member: { ...input.member, name: "Colin Lee Elliott Glaves" },
    }).status,
    "identity_unresolved",
  );
});

test("Hina uses the separately qualified write-in record and never a printed ordinal", () => {
  const snapshot = fixture();
  const result = resolveCaliforniaOfficialCampaignWebsite(
    selected(snapshot, "Hina Patel"),
  );
  assert.equal(result.status, "missing");
  assert.match(result.officialSource!.locator, /source ordinal write-in:6/);
  assert.match(
    result.officialSource!.excerpt,
    /^Candidate\(s\): Hina Patel \(Write-in\)/,
  );
});

test("withheld, unsafe and malformed Website fields remain distinct from missing", () => {
  for (const [value, expected] of [
    ["Not Authorized to Release", "withheld"],
    ["javascript:alert(1)", "unsupported"],
    ["https://user:password@example.org", "unsupported"],
    ["https://127.0.0.1", "unsupported"],
    ["not a website", "unsupported"],
    ["", "missing"],
  ]) {
    const snapshot = fixture();
    const text = qualified.replace(
      "Website:annekepner.org",
      `Website:${value}`,
    );
    snapshot.historicalSources![0] = source(text);
    snapshot.localCrosswalk!.rosterSourceHash = hash(text);
    assert.equal(
      resolveCaliforniaOfficialCampaignWebsite(
        selected(snapshot, "Anne J. Kepner"),
      ).status,
      expected,
    );
  }
});

test("unknown archives, duplicate identities and ambiguous Website fields fail closed", () => {
  const snapshot = fixture();
  const input = selected(snapshot, "Anne J. Kepner");
  const alias = snapshot.localPrimary!.identityCrosswalk.members.find(
    (m) => m.sourceContestId === "3253" && m.sourceOrdinal === "1",
  )!;
  snapshot.localPrimary!.identityCrosswalk.members.push(alias);
  assert.equal(
    resolveCaliforniaOfficialCampaignWebsite(input).status,
    "identity_unresolved",
  );
  snapshot.localPrimary!.identityCrosswalk.members.pop();
  const archive = snapshot.historicalSources![0]!;
  archive.text += "changed";
  assert.throws(
    () => resolveCaliforniaOfficialCampaignWebsite(input),
    /hash mismatch/,
  );
  snapshot.historicalSources![0] = source(
    qualified.replace(
      "Website:annekepner.org",
      "Website:annekepner.org\nWebsite:neighbor.example",
    ),
  );
  snapshot.localCrosswalk!.rosterSourceHash =
    snapshot.historicalSources![0]!.contentHash;
  assert.throws(
    () => resolveCaliforniaOfficialCampaignWebsite(input),
    /Ambiguous Website/,
  );
  assert.throws(
    () => inspectCaliforniaOfficialContactArchive("Website:orphan.example"),
    /outside a candidate record/,
  );
});

test("contact archive membership requires the reviewed source hash binding", () => {
  const snapshot = fixture();
  const input = selected(snapshot, "Anne J. Kepner");
  snapshot.localCrosswalk!.rosterSourceHash = "b".repeat(64);
  assert.equal(
    resolveCaliforniaOfficialCampaignWebsite(input).status,
    "identity_unresolved",
  );
  snapshot.localCrosswalk!.rosterSourceHash = hash(qualified);
  assert.equal(
    resolveCaliforniaOfficialCampaignWebsite(input).status,
    "listed",
  );
  const writeIn = selected(snapshot, "Hina Patel");
  snapshot.localCrosswalk!.entries.find(
    (entry) => entry.sourceContestId === "3681",
  )!.proofs = [];
  assert.equal(
    resolveCaliforniaOfficialCampaignWebsite(writeIn).status,
    "identity_unresolved",
  );
  delete snapshot.localCrosswalk;
  assert.equal(
    resolveCaliforniaOfficialCampaignWebsite(input).status,
    "identity_unresolved",
  );
});
