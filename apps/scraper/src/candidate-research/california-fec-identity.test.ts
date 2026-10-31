import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { CandidateBrief } from "@acme/validators";
import {
  deriveCandidateResearchQuality,
  fecCandidateMasterUrl,
  resolveFecCandidate,
  resolveFecIdentityFromSource,
} from "@acme/validators";

import { buildCaliforniaDossier } from "./california-dossier.js";

const capturedRow =
  "H6CA16176|SOULE, PETER SUNDIN MR.|REP|2026|CA|H|16|C|N|C00936435|PO BOX 856||SPRINGVILLE|CA|93265";
const candidate = {
  candidate_id: "H6CA16176",
  name: "SOULE, PETER SUNDIN MR.",
  office: "H",
  state: "CA",
  district: "16",
  cycles: [2026],
  election_years: [2026],
};
const query = { name: "Peter Sundin Soulé", district: "16", cycle: 2026 };

test("captured FEC candidate-master identity matches the accented ballot name and honorific", () => {
  const identity = resolveFecIdentityFromSource(
    { url: fecCandidateMasterUrl(2026), format: "text", text: capturedRow },
    query,
  );
  assert.equal(identity?.candidateId, "H6CA16176");
  assert.equal(identity.name, "SOULE, PETER SUNDIN MR.");
  assert.equal(identity.district, "16");
});

test("API identity and archived proof use the same exact normalized name", () => {
  for (const title of ["MR.", "MRS.", "MS.", "MISS", "DR."]) {
    assert.equal(
      resolveFecCandidate(
        [{ ...candidate, name: `SOULE, PETER SUNDIN ${title}` }],
        query,
      )?.candidate_id,
      candidate.candidate_id,
    );
  }
  for (const name of ["Peter Sundin Soulé", "Peter Sundin Soule\u0301"]) {
    assert.equal(
      resolveFecCandidate([candidate], { ...query, name })?.candidate_id,
      candidate.candidate_id,
    );
    const identity = resolveFecIdentityFromSource(
      {
        url: "https://api.open.fec.gov/v1/candidates/search/",
        format: "json",
        text: JSON.stringify({ results: [candidate] }),
      },
      { ...query, name },
    );
    assert.equal(identity?.name, candidate.name);
  }
});

test("honorific normalization does not remove middle names, generations, or surnames", () => {
  for (const name of [
    "SOULE, PETER MR.",
    "SOULE, PETER OTHER MR.",
    "SOULE, PETER MR SUNDIN",
    "SOULE, PETER SUNDIN JR.",
    "SOULE, PETER SUNDIN SR.",
    "SOULE, PETER SUNDIN II",
    "SOULE, PETER SUNDIN III",
    "SOULE, PETER SUNDIN IV",
    "SOULE, PETER SUNDIN ESQ.",
    "SOULE, PETER, SUNDIN MR.",
    "OTHER, PETER SUNDIN MR.",
  ]) {
    assert.equal(
      resolveFecCandidate([{ ...candidate, name }], query),
      null,
      name,
    );
  }
  assert.equal(
    resolveFecCandidate([{ ...candidate, name: "MR, PETER SUNDIN" }], {
      ...query,
      name: "Peter Sundin",
    }),
    null,
  );
});

test("normalization preserves contextual checks and refuses ambiguous normalized identities", () => {
  for (const change of [
    { state: "NV" },
    { office: "S" },
    { district: "19" },
    { cycles: [2024] },
    { election_years: [2024] },
  ]) {
    assert.equal(
      resolveFecCandidate([{ ...candidate, ...change }], query),
      null,
    );
  }
  assert.equal(
    resolveFecCandidate(
      [
        candidate,
        {
          ...candidate,
          candidate_id: "H6CA16184",
          name: "SOULÉ, PETER SUNDIN",
        },
      ],
      query,
    ),
    null,
  );
  assert.throws(
    () =>
      resolveFecIdentityFromSource(
        { url: fecCandidateMasterUrl(2024), format: "text", text: capturedRow },
        query,
      ),
    /Unsupported official FEC candidate index source/,
  );
});

test("an unproven nickname remains unresolved", () => {
  const frese = {
    ...candidate,
    candidate_id: "H6CA10187",
    district: "10",
    name: "FRESE, JEFFREY",
  };
  assert.equal(
    resolveFecCandidate([frese], {
      ...query,
      name: "Jeff Frese",
      district: "10",
    }),
    null,
  );
});

test("accented identity proof survives dossier and publication revalidation", () => {
  const at = "2026-10-31T12:00:00.000Z";
  const source = (id: string, url: string, text: string) => ({
    id,
    url,
    text,
    publisher: "FEC identity replay fixture",
    format: "text" as const,
    fetchedAt: at,
    contentHash: createHash("sha256").update(text).digest("hex"),
  });
  const master = source("fec-master", fecCandidateMasterUrl(2026), capturedRow);
  const roster = source(
    "roster",
    "https://example.ca.gov/roster",
    "Peter Sundin Soulé is listed for California House District 16.",
  );
  const filing = source(
    "finance",
    "https://www.fec.gov/data/candidate/H6CA16176/?cycle=2026",
    "Synthetic filing replay: total receipts $100.00",
  );
  const input = {
    identity: {
      candidateId: "ca-sos:2026-11-03:110000160000:3178",
      contestId: "ca-sos:2026-11-03:110000160000",
      jurisdiction: "ocd-division/country:us/state:ca/cd:16",
      electionDate: "2026-11-03",
    },
    name: query.name,
    officeKind: "federal_legislative" as const,
    officeFamily: "us_house" as const,
    rosterDigest: "a".repeat(64),
    researchVersion: "identity-replay-fixture-v1",
    createdAt: at,
    sources: [roster, master, filing],
    evidence: [
      {
        id: "roster",
        sourceId: "roster",
        excerpt: roster.text,
        locator: "District 16",
        origin: "primary_record" as const,
        role: "roster" as const,
        identityQualification: "official_roster" as const,
      },
      {
        id: "finance",
        sourceId: "finance",
        excerpt: filing.text,
        locator: "Synthetic replay",
        origin: "primary_record" as const,
        role: "finance" as const,
        identityQualification: "exact_election_office" as const,
      },
    ],
    gaps: [],
    financeIdentityProof: {
      candidateId: candidate.candidate_id,
      name: candidate.name,
      office: "H" as const,
      state: "CA" as const,
      district: "16",
      cycle: 2026,
      sourceId: master.id,
      sourceHash: master.contentHash,
    },
    finance: {
      committeeId: "C00936435",
      committeeName: "Synthetic filing replay",
      periodStart: "2025-01-01",
      periodEnd: "2026-10-14",
      currency: "USD" as const,
      coverage: "partial" as const,
      coverageNote: "Synthetic filing replay",
      updatedAt: at,
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
      donorCoverage: "unavailable" as const,
      outsideSpending: null,
    },
  };
  const dossier = buildCaliforniaDossier(input);
  const brief = {
    sections: [],
    evidence: [{ id: "finance" }],
    research: { finance: dossier.finance },
  } as unknown as CandidateBrief;
  assert.equal(
    deriveCandidateResearchQuality(brief, dossier)?.basis,
    "reconciled_finance",
  );
  for (const name of [
    "Peter Other Soulé",
    "Peter Soulé",
    "Peter Sundin Soulé Jr.",
  ]) {
    assert.throws(() => buildCaliforniaDossier({ ...input, name }));
    assert.equal(
      deriveCandidateResearchQuality(brief, { ...dossier, name }),
      null,
    );
  }
});
