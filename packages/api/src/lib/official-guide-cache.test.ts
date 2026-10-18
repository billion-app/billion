import assert from "node:assert/strict";
import test from "node:test";

import {
  CA_GENERAL_ELECTION_DATE,
  currentCaliforniaGuide,
} from "./official-guide-cache";

const guide = {
  electionDate: CA_GENERAL_ELECTION_DATE,
  jurisdiction: "CA",
  complete: true,
  fetchedAt: "2026-09-27T00:00:00.000Z",
  sourceUrl: "https://voterguide.sos.ca.gov/",
  measures: [
    {
      number: "5",
      title: "Example official ballot title",
      sourceUrl: "https://voterguide.sos.ca.gov/propositions/5/",
      voteMeaningYes: "Official meaning of a Yes vote.",
      voteMeaningNo: "Official meaning of a No vote.",
    },
  ],
  candidates: [
    {
      name: "Example Candidate",
      officeSlug: "controller",
      officeName: "Controller",
      officeDuties: ["Officially described duty."],
      statement: "An official candidate statement from the voter guide.",
      sourceUrl:
        "https://voterguide.sos.ca.gov/candidates/controller-candidate-statements.htm",
      photoUrl: "https://voterguide.sos.ca.gov/img/controller/example.jpg",
    },
  ],
};

void test("current California guide accepts only a complete, date-matched guide", () => {
  assert.equal(currentCaliforniaGuide(guide)?.candidates.length, 1);
  assert.equal(
    currentCaliforniaGuide(guide)?.measures[0]?.voteMeaningYes,
    guide.measures[0]?.voteMeaningYes,
  );
  assert.deepEqual(
    currentCaliforniaGuide(guide)?.candidates[0]?.officeDuties,
    guide.candidates[0]?.officeDuties,
  );
  assert.equal(currentCaliforniaGuide({ ...guide, complete: false }), null);
  assert.equal(
    currentCaliforniaGuide({ ...guide, electionDate: "2026-06-02" }),
    null,
  );
  assert.equal(
    currentCaliforniaGuide({
      ...guide,
      candidates: [
        {
          ...guide.candidates[0],
          photoUrl: "https://example.com/unverified.jpg",
        },
      ],
    }),
    null,
  );
});

void test("source fingerprints may cover Trillion precedent documents", () => {
  const hash = "a".repeat(64);
  const withSources = (url: string) =>
    currentCaliforniaGuide({ ...guide, relationshipSources: [{ url, hash }] });
  assert.ok(
    withSources("https://information.auditor.ca.gov/pdfs/reports/2017-117.pdf"),
  );
  assert.ok(
    withSources("https://www.lao.ca.gov/ballot/2016/Prop55-110816.pdf"),
  );
  assert.equal(withSources("https://example.com/report.pdf"), null);
  // Precedent hosts never count as the guide's own pages.
  assert.equal(
    currentCaliforniaGuide({
      ...guide,
      sourceUrl: "https://www.lao.ca.gov/ballot/2016/Prop55-110816.pdf",
    }),
    null,
  );
});
