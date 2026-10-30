import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import {
  candidateBackgroundReady,
  candidateKey,
  canMatchCaliforniaGuide,
  findGuideCandidate,
  guideCandidateRoute,
  isJudicialResearchContext,
  isOfficeSlug,
  parseBallotCandidate,
  statewideOfficeSlug,
} from "./candidate-explainer";

void test("guide identity requires exact office and a unique candidate", () => {
  const candidates = [
    {
      name: "Shirley N. Weber",
      officeSlug: "sos",
      sourceUrl:
        "https://voterguide.sos.ca.gov/candidates/sos-candidate-statements.htm",
    },
    {
      name: "Shirley N. Weber",
      officeSlug: "controller",
      sourceUrl: "https://example.org/other",
    },
  ];
  assert.equal(
    findGuideCandidate(candidates, " Shirley N. Weber ", "sos"),
    candidates[0],
  );
  assert.equal(
    findGuideCandidate(candidates, "Shirley N. Weber", "governor"),
    undefined,
  );
  const first = candidates[0];
  assert.ok(first);
  assert.equal(
    findGuideCandidate([...candidates, first], "Shirley N. Weber", "sos"),
    undefined,
  );
  assert.notEqual(
    candidateKey("Shirley N. Weber", "sos"),
    candidateKey("Shirley N. Weber", "controller"),
  );
  assert.deepEqual(guideCandidateRoute("Shirley N. Weber", "sos"), {
    pathname: "/candidate-detail",
    params: { name: "Shirley N. Weber", office: "sos" },
  });
});

void test("unknown office does not acquire a description", () => {
  assert.equal(isOfficeSlug("sos"), true);
  assert.equal(isOfficeSlug("random-office"), false);
  assert.equal(statewideOfficeSlug("California Secretary of State"), "sos");
  assert.equal(statewideOfficeSlug("City Clerk"), undefined);
});

void test("guide joining requires authoritative California statewide district", () => {
  const statewide = "ocd-division/country:us/state:ca";
  assert.equal(canMatchCaliforniaGuide("CA", "2026-11-03", statewide), true);
  assert.equal(
    canMatchCaliforniaGuide(
      "CA",
      "2026-11-03",
      "ocd-division/country:us/state:ca/place:somewhere",
    ),
    false,
  );
  assert.equal(canMatchCaliforniaGuide("CA", "2026-11-03", undefined), false);
  assert.equal(canMatchCaliforniaGuide("NV", "2026-11-03", statewide), false);
  assert.equal(canMatchCaliforniaGuide("CA", "2028-11-07", statewide), false);
});

void test("route candidate parsing rejects mismatches and malformed fields", () => {
  assert.equal(parseBallotCandidate('{"name":"Jane"}', "Other"), undefined);
  assert.equal(parseBallotCandidate("{bad", "Jane"), undefined);
  const candidate = parseBallotCandidate(
    JSON.stringify({
      name: "Jane",
      statement: 7,
      party: { value: "A" },
      citations: {},
      ballotStatus: "writeIn",
    }),
    "Jane",
  );
  assert.deepEqual(candidate, {
    name: "Jane",
    providerIdentity: undefined,
    party: undefined,
    statement: undefined,
    biography: undefined,
    photoUrl: undefined,
    ballotStatus: undefined,
    citations: undefined,
  });
});

void test("source-provided biography survives route parsing without authoring prose", () => {
  const candidate = parseBallotCandidate(
    JSON.stringify({
      name: "Jane",
      biography: "Source-provided background.",
      citations: [
        {
          field: "biography",
          sourceName: "Provider",
          sourceUrl: "https://example.org/bio",
        },
      ],
    }),
    "Jane",
  );
  assert.equal(candidate?.biography, "Source-provided background.");
  assert.equal(candidate.citations?.[0]?.field, "biography");
  assert.equal(
    parseBallotCandidate(
      JSON.stringify({ name: "Jane", biography: "a".repeat(30001) }),
      "Jane",
    )?.biography,
    undefined,
  );
});

void test("ballot biographies do not wait for a disabled California guide query", () => {
  const client = new QueryClient();
  try {
    const lookupGuide = canMatchCaliforniaGuide(
      "TX",
      "2026-11-03",
      "ocd-division/country:us/state:tx",
    );
    const guide = new QueryObserver(client, {
      queryKey: ["civic", "getCaliforniaGuide"],
      queryFn: () => Promise.resolve(null),
      enabled: lookupGuide,
    }).getCurrentResult();
    assert.equal(guide.isPending, true);
    assert.equal(candidateBackgroundReady(lookupGuide, guide.isPending), true);
    assert.equal(candidateBackgroundReady(true, true), false);
    assert.equal(candidateBackgroundReady(true, false), true);
  } finally {
    client.clear();
  }
});

void test("ballot provider identity survives validated candidate navigation", () => {
  const candidate = parseBallotCandidate(
    JSON.stringify({
      name: "Jane",
      providerIdentity: { provider: "democracy_works", candidateId: "dw-42" },
    }),
    "Jane",
  );
  assert.deepEqual(candidate?.providerIdentity, {
    provider: "democracy_works",
    candidateId: "dw-42",
  });
  assert.equal(
    parseBallotCandidate(
      JSON.stringify({
        name: "Jane",
        providerIdentity: { provider: "other", candidateId: "dw-42" },
      }),
      "Jane",
    )?.providerIdentity,
    undefined,
  );
});

void test("judicial research stays judicial for ballot, unavailable, and single-member release contexts", () => {
  assert.equal(
    isJudicialResearchContext({ ballotOffice: "Court of Appeal" }),
    true,
  );
  assert.equal(
    isJudicialResearchContext({
      ballotOffice: "Associate Justice, Supreme Court",
    }),
    true,
  );
  assert.equal(
    isJudicialResearchContext({
      release: { office: "Court of Appeal", members: [{}] },
    }),
    true,
  );
  assert.equal(
    isJudicialResearchContext({
      officeFamily: "judicial_retention",
      ballotOffice: "Retention",
    }),
    true,
  );
  assert.equal(
    isJudicialResearchContext({
      officeFamily: "statewide",
      ballotOffice: "Court of Appeal",
    }),
    false,
  );
  assert.equal(
    isJudicialResearchContext({ ballotOffice: "Clerk of Superior Court" }),
    false,
  );
  assert.equal(
    isJudicialResearchContext({ ballotOffice: "Attorney General" }),
    false,
  );
  assert.equal(isJudicialResearchContext({}), false);
});
