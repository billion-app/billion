import assert from "node:assert/strict";
import test from "node:test";

import {
  ballotSegments,
  ballotTranslationReference,
  readBallotTranslationReference,
} from "./ballot-translation";

void test("only trusted bounded ballot capabilities can request translation; refresh deduplicates", () => {
  const contest = {
    type: "Referendum",
    referendumTitle: "Library measure",
    summary: "Funds libraries",
    summaryIsAiGenerated: true,
    referendumText: "Exact legal language",
    candidates: [
      {
        name: "Alex Example",
        statement: "Original statement",
        statementSummary: "Supports libraries",
        statementSummaryIsAiGenerated: true,
      },
    ],
  };
  const segments = ballotSegments(contest);
  assert.deepEqual(
    segments.map((s) => s.key),
    [
      "ballot.referendumTitle",
      "ballot.summary",
      "ballot.candidates.0.statementSummary",
    ],
  );
  const ref = ballotTranslationReference(contest, "test-secret", 1000);
  assert.ok(ref);
  const read = readBallotTranslationReference(ref, "test-secret", 2000);
  assert.ok(read);
  assert.deepEqual(read.segments, segments);
  assert.deepEqual(read.identity, {
    kind: "measure",
    title: "Library measure",
    candidates: ["Alex Example"],
  });
  assert.equal(readBallotTranslationReference(ref, "wrong-secret", 2000), null);
  assert.equal(
    readBallotTranslationReference(ref, "test-secret", 86_401_000),
    null,
  );
  const [body, signature] = ref.split(".");
  assert.ok(body);
  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(body, "base64url").toString()),
      segments: [{ key: "ballot.summary", text: "Arbitrary paid request" }],
    }),
  ).toString("base64url");
  assert.equal(
    readBallotTranslationReference(
      `${forged}.${signature}`,
      "test-secret",
      2000,
    ),
    null,
  );
  const refreshed = ballotTranslationReference(contest, "test-secret", 3000);
  assert.ok(refreshed);
  assert.equal(
    read.contentId,
    readBallotTranslationReference(refreshed, "test-secret", 4000)?.contentId,
  );
  const revised = ballotTranslationReference(
    { ...contest, summary: "Different source" },
    "test-secret",
    3000,
  );
  assert.ok(revised);
  assert.notEqual(
    read.contentId,
    readBallotTranslationReference(revised, "test-secret", 4000)?.contentId,
  );
  assert.equal(
    ballotTranslationReference(
      { ...contest, summary: "a".repeat(65_000) },
      "test-secret",
    ),
    undefined,
  );
  assert.equal(
    readBallotTranslationReference("a".repeat(65_000), "test-secret"),
    null,
  );
  assert.ok(
    !ballotSegments({ ...contest, summaryIsAiGenerated: false }).some(
      (s) => s.key === "ballot.summary",
    ),
  );
});
