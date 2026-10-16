import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_LANGUAGES,
  languageFromLocales,
  speechLanguageTag,
} from "../i18n/language";
import { DICTIONARIES, translate } from "../i18n/strings";
import {
  buildSpeechChunks,
  buildSpeechParagraphs,
  chunkForSpeech,
  stripMarkdown,
} from "./speech-script";

void test("strips markdown syntax, links, images, and urls", () => {
  assert.equal(
    stripMarkdown(
      "## Heading\n- **Bold** item with [a link](https://x.y)\n![art](a.png) see https://example.com",
    ).trim(),
    "Heading\nBold item with a link\n  see",
  );
});

void test("reads a bill brief as prose and skips source quotes", () => {
  const paragraphs = buildSpeechParagraphs({
    title: "Road Act",
    description: "Funds roads",
    brief: {
      summary: "Gives states **ten years** of money",
      changes: [
        {
          title: "Money for states",
          before: "States apply yearly",
          after: "States get a share",
          // @ts-expect-error quotes exist on real briefs and must be ignored
          quote: { text: "shall apportion" },
        },
      ],
      unknowns: ["Who sets the formula?"],
    },
  });
  assert.deepEqual(paragraphs, [
    "Road Act.",
    "Here is the brief. This is Billion's analysis. Check the original source for exact wording.",
    "Gives states ten years of money.",
    "Here is what changes.",
    "Money for states.",
    "Right now: States apply yearly.",
    "Under this measure: States get a share.",
    "Here is what remains uncertain. Who sets the formula?",
  ]);
  assert.ok(!paragraphs.join(" ").includes("apportion"));
});

void test("falls back to the markdown body without a brief", () => {
  const paragraphs = buildSpeechParagraphs({
    title: "T",
    body: "# Intro\n\nFirst paragraph.\n\n* point one",
  });
  assert.deepEqual(paragraphs, [
    "T.",
    "Here is the brief. This is Billion's analysis. Check the original source for exact wording.",
    "Intro.",
    "First paragraph.",
    "point one.",
  ]);
});

void test("keeps every chunk under the limit, including Chinese", () => {
  const english = "This is a sentence. ".repeat(200);
  const chinese = "这是一个句子。".repeat(400);
  for (const text of [english, chinese, "x".repeat(5000)]) {
    const chunks = chunkForSpeech([text], 500);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 500));
  }
});

void test("packs short paragraphs together", () => {
  assert.equal(buildSpeechChunks({ title: "A", description: "B" }).length, 1);
});

void test("picks a supported device language or English", () => {
  assert.equal(languageFromLocales(["fr-FR", "es-MX"]), "es");
  assert.equal(languageFromLocales(["zh-Hans-CN"]), "zh");
  assert.equal(languageFromLocales(["de-DE"]), "en");
  assert.equal(languageFromLocales([]), "en");
  assert.equal(speechLanguageTag("zh"), "zh-CN");
});

void test("translations only use English keys and keep placeholders", () => {
  for (const language of APP_LANGUAGES) {
    for (const [key, value] of Object.entries(DICTIONARIES[language])) {
      assert.ok(key in DICTIONARIES.en, `${language} has unknown key ${key}`);
      const placeholders = (text: string) =>
        (text.match(/\{\w+\}/g) ?? []).sort().join();
      const english = DICTIONARIES.en[key as keyof typeof DICTIONARIES.en];
      assert.equal(placeholders(value), placeholders(english ?? ""), key);
    }
  }
  assert.equal(
    translate("es", "listen.progress", { current: 2, total: 5 }),
    "Parte 2 de 5",
  );
});

void test("opinions narration identifies the author and does not read the case summary", () => {
  const script = buildSpeechParagraphs({
    title: "Case",
    mode: "opinions",
    courtBrief: {
      takeaway: { text: "Summary that belongs in the brief" },
      opinions: [
        {
          kind: "dissent",
          author: "Justice Lee",
          text: "The dissent argues the rule is too broad.",
        },
      ],
    },
  }).join(" ");
  assert.match(script, /Dissent.*Justice Lee/);
  assert.match(script, /The dissent argues/);
  assert.doesNotMatch(script, /Summary that belongs/);
});

void test("bill narration explains comparisons, affected people, facts and uncertainty", () => {
  const script = buildSpeechParagraphs({
    title: "Road Act",
    brief: {
      legalStatus: "proposed",
      hook: "A proposal to fund roads.",
      facts: [
        { label: "Funding", value: "$1.2 billion", note: "over ten years" },
      ],
      changes: [
        {
          title: "Road funding",
          before: "States apply every year",
          after: "States would receive a fixed share",
        },
      ],
      affected: [
        {
          group: "States",
          takeaway: "States would get predictable funding.",
          effect: "They could plan longer projects.",
        },
      ],
      unknowns: ["Who sets the formula?"],
    },
  }).join(" ");
  assert.match(script, /Right now: States apply/);
  assert.match(script, /Under this measure: States would/);
  assert.match(script, /Funding: \$1.2 billion/);
  assert.match(script, /They could plan longer projects/);
  assert.match(script, /Here is what remains uncertain/);
});

void test("court narration distinguishes allegations and possible effects from orders", () => {
  const script = buildSpeechParagraphs({
    title: "Case",
    courtBrief: {
      reasoning: [
        { kind: "allegation", text: "A party says the notice was late." },
      ],
      effects: [
        {
          certainty: "possible_effect",
          group: "Applicants",
          text: "Applicants might need to reapply.",
        },
      ],
    },
  }).join(" ");
  assert.match(script, /An allegation, not an established fact: A party says/);
  assert.match(
    script,
    /A possible effect, not a court order: Applicants might/,
  );
});

void test("enacted measures describe the old rules in the past", () => {
  const script = buildSpeechParagraphs({
    title: "Act",
    brief: {
      legalStatus: "enacted",
      changes: [
        { before: "States applied yearly", after: "States get a fixed share" },
      ],
    },
  }).join(" ");
  assert.match(script, /Before this measure: States applied/);
  assert.doesNotMatch(script, /Right now:/);
});

void test("Spanish and Chinese narration use their own transitions", () => {
  const brief = {
    changes: [{ before: "Antes", after: "Después" }],
    unknowns: ["Pending"],
  };
  const spanish = buildSpeechParagraphs({
    title: "Ley",
    language: "es",
    brief,
  }).join(" ");
  const chinese = buildSpeechParagraphs({
    title: "法案",
    language: "zh",
    brief,
  }).join(" ");
  assert.match(spanish, /Actualmente:/);
  assert.match(chinese, /目前的情况:/);
  assert.doesNotMatch(
    spanish + chinese,
    /Here is|Right now|Under this measure/,
  );
});

void test("source mode reads the original without analysis transitions", () => {
  const paragraphs = buildSpeechParagraphs({
    title: "Act",
    mode: "source",
    body: "> shall provide notice",
    brief: { hook: "Do not read this analysis" },
  });
  assert.deepEqual(paragraphs, [
    "Act.",
    "Original source text.",
    "shall provide notice.",
  ]);
});

void test("an article with only source text is never called Billion's analysis", () => {
  const paragraphs = buildSpeechParagraphs({
    title: "Official order",
    mode: "explainer",
    isAIGenerated: false,
    description: "A source description",
    body: "The agency shall provide notice.",
  });
  assert.deepEqual(paragraphs, [
    "Official order.",
    "Original source text.",
    "The agency shall provide notice.",
  ]);
  const brief = buildSpeechParagraphs({
    title: "Act",
    isAIGenerated: false,
    brief: { hook: "An authored bill brief." },
  }).join(" ");
  assert.match(brief, /Billion's analysis/);
  assert.match(brief, /An authored bill brief/);
});

void test("long narration does not split decimal amounts into different numbers", () => {
  const paragraph = "Funding is $1.2 billion. ".repeat(100);
  const chunks = chunkForSpeech([paragraph], 100);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
  assert.equal(chunks.join(" ").trim(), paragraph.trim());
});
