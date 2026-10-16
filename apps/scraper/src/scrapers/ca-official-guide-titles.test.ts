import assert from "node:assert/strict";
import test from "node:test";

import type { OfficialGuidePayload } from "@acme/api/lib/official-guide-cache";

import {
  addDisplayTitles,
  buildDisplayTitlePrompt,
  cleanDisplayTitle,
  DISPLAY_TITLE_PROMPT_VERSION,
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
const formatted = "**Authorizes bonds** for housing affordability programs";

test("an unchanged official title reuses the stored format without a model call", async () => {
  const measures = [measure("1"), measure("2")];
  const calls: string[] = [];
  const counts = await addDisplayTitles(
    measures,
    [
      measure("1", {
        displayTitle: formatted,
        displayTitlePrompt: DISPLAY_TITLE_PROMPT_VERSION,
      }),
      measure("2", {
        title: "INCREASES STATE’S RAINY DAY FUND. LEGISLATIVE STATUTE.",
        displayTitle: "Increases state’s **Rainy Day Fund**",
        displayTitlePrompt: DISPLAY_TITLE_PROMPT_VERSION,
      }),
    ],
    (item) => {
      calls.push(item.number);
      return Promise.resolve(formatted);
    },
  );
  assert.deepEqual(calls, ["2"]);
  assert.equal(measures[0]!.displayTitle, formatted);
  assert.equal(measures[1]!.displayTitle, formatted);
  assert.deepEqual(counts, { reused: 1, generated: 1, failed: 0 });
});

test("a title from an older prompt is reformatted", async () => {
  const measures = [measure("1")];
  await addDisplayTitles(
    measures,
    [measure("1", { displayTitle: "Old format" })],
    () => Promise.resolve(formatted),
  );
  assert.equal(measures[0]!.displayTitle, formatted);
  assert.equal(measures[0]!.displayTitlePrompt, DISPLAY_TITLE_PROMPT_VERSION);
});

test("a changed answer is retried once, then left out", async () => {
  const retried = [measure("1")];
  const answers = ["Authorizes **$11B** for housing", formatted];
  await addDisplayTitles(retried, [], () => Promise.resolve(answers.shift()!));
  assert.equal(retried[0]!.displayTitle, formatted);

  const failed = [measure("1"), measure("2")];
  let calls = 0;
  const counts = await addDisplayTitles(
    failed,
    [],
    () => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error("rate limit"))
        : Promise.resolve("Builds affordable housing");
    },
    3,
  );
  assert.equal(calls, 3);
  assert.ok(failed.every((item) => item.displayTitle === undefined));
  assert.deepEqual(counts, { reused: 0, generated: 0, failed: 2 });
});

test("only capitalization, punctuation and one bold phrase may change", () => {
  const m = measure("1");
  assert.equal(cleanDisplayTitle(` “${formatted}.” `, m), formatted);
  // Any added, dropped or reworded word is rejected.
  assert.equal(cleanDisplayTitle("**Authorizes bonds** for housing", m), null);
  assert.equal(
    cleanDisplayTitle(
      "**Authorizes $11B bonds** for housing affordability programs",
      m,
    ),
    null,
  );
  // The all-caps original is not a reformat.
  assert.equal(
    cleanDisplayTitle("AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS", m),
    null,
  );
  // Bad emphasis keeps the words and drops the marks.
  assert.equal(
    cleanDisplayTitle(
      "**Authorizes bonds for housing affordability programs**",
      m,
    ),
    "Authorizes bonds for housing affordability programs",
  );
  assert.equal(
    cleanDisplayTitle(
      "**Authorizes** bonds for **housing** affordability programs",
      m,
    ),
    "Authorizes bonds for housing affordability programs",
  );
});

test("the prompt carries the official subject without its legal label", () => {
  const prompt = buildDisplayTitlePrompt(measure("1"));
  assert.match(
    prompt,
    /Official title: AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS\.$/m,
  );
  assert.doesNotMatch(prompt, /LEGISLATIVE STATUTE/);
  assert.match(prompt, /untrusted data/);
});
