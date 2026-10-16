import assert from "node:assert/strict";
import test from "node:test";

import type { OfficialGuidePayload } from "@acme/api/lib/official-guide-cache";

import {
  addPlainTitles,
  buildPlainTitlePrompt,
  cleanPlainTitle,
  PLAIN_TITLE_PROMPT_VERSION,
} from "./ca-official-guide-titles.js";

type Measure = OfficialGuidePayload["measures"][number];
const measure = (number: string, extra: Partial<Measure> = {}): Measure => ({
  number,
  title:
    "AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS. LEGISLATIVE STATUTE.",
  sourceUrl: `https://voterguide.sos.ca.gov/propositions/${number}/`,
  officialSummary: "Authorizes $11.25 billion in state bonds for housing.",
  ...extra,
});

test("unchanged official text reuses the stored title without a model call", async () => {
  const measures = [measure("1"), measure("2")];
  const calls: string[] = [];
  const counts = await addPlainTitles(
    measures,
    [
      measure("1", {
        plainTitle: "$11.25B bond for affordable housing",
        plainTitlePrompt: PLAIN_TITLE_PROMPT_VERSION,
      }),
      measure("2", {
        plainTitle: "Old title",
        plainTitlePrompt: PLAIN_TITLE_PROMPT_VERSION,
        officialSummary: "A different summary.",
      }),
    ],
    (item) => {
      calls.push(item.number);
      return Promise.resolve("New housing bond title");
    },
  );
  assert.deepEqual(calls, ["2"]);
  assert.equal(measures[0]!.plainTitle, "$11.25B bond for affordable housing");
  assert.equal(measures[1]!.plainTitle, "New housing bond title");
  assert.deepEqual(counts, { reused: 1, generated: 1, failed: 0 });
});

test("a rejected answer is retried once", async () => {
  const measures = [measure("1")];
  const answers = ["PROPOSITION 1", "Housing bond"];
  const counts = await addPlainTitles(measures, [], () =>
    Promise.resolve(answers.shift()!),
  );
  assert.equal(measures[0]!.plainTitle, "Housing bond");
  assert.deepEqual(counts, { reused: 0, generated: 1, failed: 0 });
});

test("failures, rejected answers and the call budget leave the title out", async () => {
  const measures = [measure("1"), measure("2"), measure("3")];
  const answers = [
    () => Promise.reject(new Error("rate limit")),
    () => Promise.resolve(measures[0]!.title),
    () => Promise.resolve("x".repeat(80)),
    () => Promise.resolve("Never asked"),
  ];
  let i = 0;
  const counts = await addPlainTitles(measures, [], () => answers[i++]!(), 3);
  assert.equal(i, 3);
  assert.ok(measures.every((item) => item.plainTitle === undefined));
  assert.deepEqual(counts, { reused: 0, generated: 0, failed: 3 });
});

test("generated titles are trimmed and must read as a short label", () => {
  assert.equal(
    cleanPlainTitle(" “Lets cities expand rent control.” "),
    "Lets cities expand rent control",
  );
  assert.equal(cleanPlainTitle("Proposition 1: housing bond"), null);
  assert.equal(cleanPlainTitle("AUTHORIZES HOUSING BONDS"), null);
  assert.equal(cleanPlainTitle("x".repeat(61)), null);
  assert.equal(
    cleanPlainTitle("$10B bond for school repairs"),
    "$10B bond for school repairs",
  );
});

test("the prompt is grounded only in the official title and summary", () => {
  const prompt = buildPlainTitlePrompt(measure("1"));
  assert.match(prompt, /Official title: AUTHORIZES BONDS/);
  assert.match(prompt, /Official summary: Authorizes \$11\.25 billion/);
  assert.match(prompt, /untrusted data/);
});

test("a title from an older prompt is rewritten", async () => {
  const measures = [measure("1")];
  await addPlainTitles(
    measures,
    [measure("1", { plainTitle: "Unmarked old title" })],
    () => Promise.resolve("**Housing bond** for veterans"),
  );
  assert.equal(measures[0]!.plainTitle, "**Housing bond** for veterans");
  assert.equal(measures[0]!.plainTitlePrompt, PLAIN_TITLE_PROMPT_VERSION);
});

test("one short bold phrase is kept; bad markup falls back to plain text", () => {
  assert.equal(
    cleanPlainTitle("**$11B bond** for affordable housing"),
    "**$11B bond** for affordable housing",
  );
  assert.equal(
    cleanPlainTitle("**$11B bond** for **affordable housing**"),
    "$11B bond for affordable housing",
  );
  assert.equal(
    cleanPlainTitle("**Bans new state taxes**"),
    "Bans new state taxes",
  );
  assert.equal(
    cleanPlainTitle("**$11B bond for housing"),
    "$11B bond for housing",
  );
  // Markers do not count toward the length limit.
  assert.equal(
    cleanPlainTitle(`**${"x".repeat(10)}** ${"y".repeat(49)}`)?.length,
    64,
  );
});
