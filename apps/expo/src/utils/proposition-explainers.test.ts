import assert from "node:assert/strict";
import test from "node:test";

import {
  PROPOSITION_AI_LABEL,
  propositionDetailRoute,
  propositionExplainer,
  submittedGuideArguments,
} from "./proposition-explainers";

const prop1Title =
  "AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS. LEGISLATIVE STATUTE.";
const prop5Title =
  "CHANGES RECALL ELECTION PROCESS FOR STATEWIDE OFFICERS. LEGISLATIVE CONSTITUTIONAL AMENDMENT.";

test("only the matching 2026 official guide record receives a Billion AI draft", () => {
  const one = propositionExplainer(
    "1",
    prop1Title,
    "https://voterguide.sos.ca.gov/propositions/1/",
  );
  assert.ok(one);
  assert.equal(one.headline, "Housing bonds");
  assert.match(one.voteBriefYes, /\$11\.25 billion/);
  assert.equal(one.officialTitle, prop1Title);
  assert.notEqual(one.headline, one.officialTitle);
  assert.equal(one.detailRows.length, 2);
  assert.equal(one.voteTitleYes, "Authorize new bonds");
  assert.equal(one.voteTitleNo, "No new bond authorization");
  assert.equal(
    propositionExplainer(
      "1",
      prop5Title,
      "https://voterguide.sos.ca.gov/propositions/1/",
    ),
    null,
  );
  assert.equal(
    propositionExplainer(
      "1",
      prop1Title,
      "https://example.com/propositions/1/",
    ),
    null,
  );
  assert.equal(
    propositionExplainer(
      "2",
      prop1Title,
      "https://voterguide.sos.ca.gov/propositions/2/",
    ),
    null,
  );
});

test("a guide notice about absent arguments does not become an advocacy card", () => {
  assert.deepEqual(
    submittedGuideArguments([
      { text: "NO ARGUMENT AGAINST PROPOSITION 1 WAS SUBMITTED." },
      { text: "A submitted argument" },
    ]),
    [{ text: "A submitted argument" }],
  );
});

test("navigation carries only the proposition number and the draft label is explicit", () => {
  assert.deepEqual(propositionDetailRoute("5"), {
    pathname: "/proposition-detail",
    params: { number: "5" },
  });
  assert.match(PROPOSITION_AI_LABEL, /AI draft/);
  assert.match(PROPOSITION_AI_LABEL, /Editorial review pending/);
});

test("recall explainer preserves fiscal uncertainty and describes both vote paths", () => {
  const five = propositionExplainer(
    "5",
    prop5Title,
    "https://voterguide.sos.ca.gov/propositions/5/",
  );
  assert.match(five?.fiscal ?? "", /net fiscal effect is unknown/);
  assert.match(five?.voteBriefYes ?? "", /Future recall ballots/);
  assert.match(five?.voteBriefNo ?? "", /Future recall ballots/);
  assert.match(five?.caveat ?? "", /does not recall anyone/);
  assert.equal(five?.detailRows.length, 3);
  assert.match(five.detailRows[2]?.text ?? "", /Lieutenant Governor/);
  assert.match(five.analysisUrl, /\/5\/analysis\.htm$/);
});
