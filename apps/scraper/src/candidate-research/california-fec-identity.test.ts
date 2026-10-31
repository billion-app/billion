import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { CandidateBrief } from "@acme/validators";
import {
  deriveCandidateResearchQuality,
  fecCandidateMasterUrl,
  findFecIdentityBridge,
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

function bridgeSource(id: string, url: string, text: string, format = "text") {
  return {
    id,
    url,
    text,
    format,
    contentHash: createHash("sha256").update(text).digest("hex"),
  };
}
const freseQuery = {
  name: "Jeff Frese",
  district: "10",
  cycle: 2026,
  sourceCandidateId: "3576",
};
const freseIndex = bridgeSource(
  "master",
  fecCandidateMasterUrl(2026),
  "H6CA10187|FRESE, JEFFREY|REP|2026|CA|H|10|C|N|C00929612|||||",
);
const freseRoster = bridgeSource(
  "sos",
  "https://media.sos.ca.gov/media/C26GG.txt",
  "[B|CAS|1|20260929|2042353]\n[C|CAS|43|110000100000|3576||Frese|Jeffrey||02|Jeff Frese|]\n[E|CAS|44|20260929|2042353]",
);
const freseBridge = {
  kind: "sos_legal_name_v1" as const,
  sourceId: freseRoster.id,
  sourceHash: freseRoster.contentHash,
  sourceCandidateId: "3576",
};

test("official SOS legal/display row proves Frese without changing nickname matching", () => {
  assert.equal(resolveFecIdentityFromSource(freseIndex, freseQuery), null);
  assert.deepEqual(
    findFecIdentityBridge(freseIndex, freseQuery, [freseRoster]),
    freseBridge,
  );
  assert.equal(
    resolveFecIdentityFromSource(freseIndex, freseQuery, freseBridge, [
      freseRoster,
    ])?.candidateId,
    "H6CA10187",
  );
  for (const change of [
    { sourceCandidateId: "9999" },
    { district: "19" },
    { name: "Other Frese" },
  ]) {
    assert.equal(
      resolveFecIdentityFromSource(
        freseIndex,
        { ...freseQuery, ...change },
        freseBridge,
        [freseRoster],
      ),
      null,
    );
  }
  assert.equal(
    resolveFecIdentityFromSource(
      { ...freseIndex, url: fecCandidateMasterUrl(2024) },
      { ...freseQuery, cycle: 2024 },
      freseBridge,
      [freseRoster],
    ),
    null,
  );
  assert.equal(
    resolveFecIdentityFromSource(freseIndex, freseQuery, freseBridge, [
      { ...freseRoster, contentHash: "0".repeat(64) },
    ]),
    null,
  );
  const duplicate = {
    ...freseRoster,
    text:
      freseRoster.text +
      "\n[C|CAS|45|110000190000|3576||Frese|Jeffrey||02|Jeff Frese|]",
  };
  assert.equal(
    resolveFecIdentityFromSource(freseIndex, freseQuery, freseBridge, [
      duplicate,
    ]),
    null,
  );
});

const liccardoIndex = bridgeSource(
  "master",
  fecCandidateMasterUrl(2026),
  "H4CA16197|LICCARDO, SAM T|DEM|2026|CA|H|16|C|I|C00858688|||||",
);
const liccardoQuery = {
  name: "Sam Liccardo",
  district: "16",
  cycle: 2026,
  sourceCandidateId: "1000",
};
const liccardoRoster = bridgeSource(
  "county",
  "https://smcacre.gov/system/files/2026-03/51_candidateroster03272026.pdf",
  [
    "JUNE 2, 2026",
    "ROSTER OF CANDIDATES",
    "U.S. Representative, District 162204 On Ballot: YesVote for 1",
    "SAM LICCARDO DEMQualified: 2 Candidate Stmt Filed? Yes - 2/20/2026",
    "United States Representative",
    "samliccardo.comWebsite:",
    "KEVIN JOHNSON REPQualified: 3 Candidate Stmt Filed? No",
    "Website:",
  ].join("\n"),
  "pdf",
);
function liccardoForm(change: Record<number, string> = {}) {
  const fields: string[] = Array.from({ length: 101 }, () => "");
  for (const [index, value] of Object.entries({
    0: "F1A",
    1: "C00858688",
    3: "Liccardo for Congress",
    13: "samliccardo.com",
    14: "20241205",
    21: "A",
    22: "H4CA16197",
    23: "Liccardo",
    24: "Sam",
    25: "T.",
    28: "H",
    29: "CA",
    30: "16",
    31: "DEM",
    ...change,
  }))
    fields[Number(index)] = value;
  return bridgeSource(
    "form",
    "https://docquery.fec.gov/dcdev/posted/1856505.fec",
    "HDR\u001cFEC\u001c8.4\u001cNGP\u001c8\u001cFEC-1737373\u001c1\u001c \n" +
      fields.join("\u001c"),
  );
}
const form = liccardoForm();
const liccardoBridge = {
  kind: "official_domain_v1" as const,
  rosterSourceId: liccardoRoster.id,
  rosterSourceHash: liccardoRoster.contentHash,
  filingSourceId: form.id,
  filingSourceHash: form.contentHash,
  committeeId: "C00858688",
  domain: "samliccardo.com",
};

test("official domain and exact F1 candidate/committee linkage prove Liccardo's middle initial", () => {
  assert.equal(
    resolveFecIdentityFromSource(liccardoIndex, liccardoQuery),
    null,
  );
  assert.equal(
    resolveFecIdentityFromSource(liccardoIndex, liccardoQuery, liccardoBridge, [
      liccardoRoster,
      form,
    ])?.candidateId,
    "H4CA16197",
  );
  const changes: Record<number, string>[] = [
    { 13: "other.example" },
    { 22: "H6CA16176" },
    { 23: "Other" },
    { 28: "S" },
    { 29: "NV" },
    { 30: "19" },
    { 1: "C00936435" },
  ];
  for (const change of changes) {
    const changed = liccardoForm(change);
    assert.equal(
      resolveFecIdentityFromSource(
        liccardoIndex,
        liccardoQuery,
        { ...liccardoBridge, filingSourceHash: changed.contentHash },
        [liccardoRoster, changed],
      ),
      null,
    );
  }
  const otherCommittee = {
    ...liccardoIndex,
    text: liccardoIndex.text.replace("C00858688", "C00936435"),
  };
  assert.equal(
    resolveFecIdentityFromSource(
      otherCommittee,
      liccardoQuery,
      liccardoBridge,
      [liccardoRoster, form],
    ),
    null,
  );
  assert.equal(
    resolveFecIdentityFromSource(
      liccardoIndex,
      { ...liccardoQuery, district: "19" },
      liccardoBridge,
      [liccardoRoster, form],
    ),
    null,
  );
  assert.equal(
    resolveFecIdentityFromSource(
      {
        ...liccardoIndex,
        text: liccardoIndex.text.replace("|2026|", "|2024|"),
      },
      liccardoQuery,
      liccardoBridge,
      [liccardoRoster, form],
    ),
    null,
  );
  const ambiguous = {
    ...liccardoIndex,
    text:
      liccardoIndex.text +
      "\n" +
      liccardoIndex.text.replace("H4CA16197", "H6CA16176"),
  };
  assert.equal(
    resolveFecIdentityFromSource(ambiguous, liccardoQuery, liccardoBridge, [
      liccardoRoster,
      form,
    ]),
    null,
  );
});

test("both versioned official bridges replay through dossier validation and publication qualification", () => {
  for (const fixture of [
    {
      query: freseQuery,
      index: freseIndex,
      bridge: freseBridge,
      sources: [freseRoster],
      id: "H6CA10187",
      name: "FRESE, JEFFREY",
    },
    {
      query: liccardoQuery,
      index: liccardoIndex,
      bridge: liccardoBridge,
      sources: [liccardoRoster, form],
      id: "H4CA16197",
      name: "LICCARDO, SAM T",
    },
  ]) {
    const at = "2026-10-31T12:00:00.000Z";
    const sources = [...fixture.sources, fixture.index].map((source) => ({
      ...source,
      format: source.format as "text" | "pdf",
      publisher: "Official identity replay fixture",
      fetchedAt: at,
    }));
    const finance = {
      committeeId:
        fixture.bridge.kind === "official_domain_v1"
          ? fixture.bridge.committeeId
          : "C00929612",
      committeeName: "Identity replay fixture",
      periodStart: "2025-01-01",
      periodEnd: "2026-10-14",
      currency: "USD" as const,
      coverage: "partial" as const,
      coverageNote: "Identity replay fixture",
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
    };
    const input = {
      identity: {
        candidateId: `ca-sos:2026-11-03:110000${fixture.query.district}0000:${fixture.query.sourceCandidateId}`,
        contestId: `ca-sos:2026-11-03:110000${fixture.query.district}0000`,
        jurisdiction: `ocd-division/country:us/state:ca/cd:${fixture.query.district}`,
        electionDate: "2026-11-03",
      },
      name: fixture.query.name,
      officeKind: "federal_legislative" as const,
      officeFamily: "us_house" as const,
      rosterDigest: "a".repeat(64),
      researchVersion: "identity-bridge-fixture-v1",
      createdAt: at,
      sources,
      evidence: [
        {
          id: "roster",
          sourceId: fixture.sources[0]!.id,
          excerpt: fixture.sources[0]!.text.slice(0, 100),
          locator: "Official roster",
          origin: "primary_record" as const,
          role: "roster" as const,
          identityQualification: "official_roster" as const,
        },
        {
          id: "finance",
          sourceId: fixture.index.id,
          excerpt: fixture.index.text,
          locator: "Identity replay",
          origin: "primary_record" as const,
          role: "finance" as const,
          identityQualification: "exact_election_office" as const,
        },
      ],
      gaps: [],
      finance,
      financeIdentityProof: {
        candidateId: fixture.id,
        name: fixture.name,
        office: "H" as const,
        state: "CA" as const,
        district: fixture.query.district,
        cycle: 2026,
        sourceId: fixture.index.id,
        sourceHash: fixture.index.contentHash,
        bridge: fixture.bridge,
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
    assert.throws(() =>
      buildCaliforniaDossier({
        ...input,
        sources: sources.filter(
          (source) => source.id !== fixture.sources[0]!.id,
        ),
      }),
    );
    const wrongCandidate = {
      ...dossier,
      identity: {
        ...dossier.identity,
        candidateId: dossier.identity.candidateId.replace(/:\d+$/, ":9999"),
      },
    };
    if (fixture.bridge.kind === "sos_legal_name_v1")
      assert.equal(deriveCandidateResearchQuality(brief, wrongCandidate), null);
  }
});
