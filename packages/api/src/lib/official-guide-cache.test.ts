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
  measures: [],
  candidates: [
    {
      name: "Example Candidate",
      officeSlug: "controller",
      statement: "An official candidate statement from the voter guide.",
      sourceUrl:
        "https://voterguide.sos.ca.gov/candidates/controller-candidate-statements.htm",
      photoUrl: "https://voterguide.sos.ca.gov/img/controller/example.jpg",
    },
  ],
};

void test("current California guide accepts only a complete, date-matched guide", () => {
  assert.equal(currentCaliforniaGuide(guide)?.candidates.length, 1);
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
