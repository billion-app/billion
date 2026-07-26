import assert from "node:assert/strict";
import test from "node:test";

import type { BillBrief } from "@acme/validators";

import {
  deriveLegalStatus,
  findLoadedLanguage,
  isQuoteGrounded,
  normalizeForQuoteMatch,
  verifyBriefQuotes,
} from "./bill-brief.js";

const SOURCE = `
SEC. 4. WAIVER OF ENVIRONMENTAL REVIEW.

  (a) In general.--The Secretary may waive the requirements of section
102(2)(C) of the National Environmental Policy Act of 1969 with respect
to any covered project, if the Secretary determines that the waiver is
necessary to meet an operational deadline.

  (b) Authorization of appropriations.--There is authorized to be
appropriated $1,200,000,000 for fiscal year 2027 to carry out this
section.
`;

function brief(overrides: Partial<BillBrief> = {}): BillBrief {
  return {
    hook: "The bill would let the Secretary skip environmental reviews for covered projects.",
    facts: [
      {
        label: "Authorized funding",
        value: "$1.2B",
        note: "For fiscal year 2027.",
      },
    ],
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before:
          "Covered projects must complete a review under the National Environmental Policy Act.",
        after:
          "The Secretary would be able to waive that review to meet an operational deadline.",
      },
    ],
    affected: [
      {
        group: "Communities near covered projects",
        effect:
          "They would lose the public comment step that the review process provides.",
        direction: "loses",
      },
    ],
    unknowns: [
      "The text does not define what counts as an operational deadline.",
    ],
    terms: [],
    sections: [],
    ...overrides,
  };
}

void test("quote matching ignores whitespace, case, and smart punctuation", () => {
  const normalized = normalizeForQuoteMatch(SOURCE);
  assert.equal(
    isQuoteGrounded(
      "The Secretary may waive the requirements of section 102(2)(C)",
      normalized,
    ),
    true,
  );
  // Wrapped across a newline in the source, and re-typed with curly quotes.
  assert.equal(
    isQuoteGrounded(
      "if the Secretary determines that the waiver is necessary",
      normalized,
    ),
    true,
  );
});

void test("quote matching rejects paraphrase and reordered words", () => {
  const normalized = normalizeForQuoteMatch(SOURCE);
  assert.equal(
    isQuoteGrounded(
      "The Secretary is allowed to waive environmental review requirements",
      normalized,
    ),
    false,
  );
  assert.equal(
    isQuoteGrounded(
      "may waive the requirements of the National Environmental Policy Act of 1969",
      normalized,
    ),
    false,
  );
  // Too short to be meaningful once normalized.
  assert.equal(isQuoteGrounded("the Secretary", normalized), false);
});

void test("verification strips unverified quotes but keeps the claim", () => {
  const input = brief({
    facts: [
      {
        label: "Authorized funding",
        value: "$1.2B",
        quote: { text: "appropriated $1,200,000,000 for fiscal year 2027" },
      },
    ],
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before: "Covered projects must complete a review.",
        after: "The Secretary would be able to waive that review.",
        quote: {
          text: "The Secretary shall have unlimited authority to ignore all federal law",
          locator: "Sec. 4(a)",
        },
      },
    ],
  });

  const { brief: cleaned, verified, dropped } = verifyBriefQuotes(input, SOURCE);
  assert.equal(verified, 1);
  assert.equal(dropped, 1);
  assert.ok(cleaned.facts[0]?.quote, "grounded quote is kept");
  assert.equal(cleaned.changes[0]?.quote, undefined, "invented quote is gone");
  assert.equal(
    cleaned.changes[0]?.title,
    "Environmental review can be skipped",
    "the surrounding claim survives",
  );
});

void test("framing lint flags loaded language in the model's own voice", () => {
  assert.deepEqual(findLoadedLanguage(brief()), []);

  const loaded = findLoadedLanguage(
    brief({
      hook: "This common sense bill guts a burdensome review requirement.",
      unknowns: ["Whether this radical shift survives review."],
    }),
  );
  assert.deepEqual(loaded.sort(), ["burdensome", "common sense", "guts", "radical"]);
});

void test("framing lint exempts verbatim quotes from the source", () => {
  // A sponsor calling their own bill "common sense" is reportable; repeating it
  // inside a quote must not trip the lint.
  const withLoadedQuote = brief({
    changes: [
      {
        kind: "waives",
        title: "Environmental review can be skipped",
        before: "Covered projects must complete a review.",
        after: "The Secretary would be able to waive that review.",
        quote: { text: "this common sense reform cuts red tape for job-killing delays" },
      },
    ],
  });
  assert.deepEqual(findLoadedLanguage(withLoadedQuote), []);
});

void test("legal status comes from the scraped status string", () => {
  assert.equal(deriveLegalStatus("Became Public Law No: 118-42"), "enacted");
  assert.equal(deriveLegalStatus("Signed by President"), "enacted");
  assert.equal(deriveLegalStatus("Introduced"), "proposed");
  assert.equal(deriveLegalStatus("Passed House"), "proposed");
  assert.equal(deriveLegalStatus(null), "proposed");
});
