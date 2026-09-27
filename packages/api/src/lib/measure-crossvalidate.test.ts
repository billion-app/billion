import assert from "node:assert/strict";
import { test } from "node:test";

void test("AI summaries retain the ballot provider's grounding citation", async (t) => {
  const keys = [
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
  ];
  const previous = keys.map((key) => process.env[key]);
  for (const key of keys) delete process.env[key];
  process.env.OPENROUTER_API_KEY = "synthetic-test-key";
  t.after(() => {
    keys.forEach((key, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });
  let generations = 0;
  t.mock.method(globalThis, "fetch", (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname !== "openrouter.ai") {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    generations++;
    return Promise.resolve(
      Response.json({
        id: "synthetic-generation",
        object: "chat.completion",
        created: 0,
        model: "synthetic",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({
                short: "Short summary",
                long: "Long summary",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  });
  const { crossValidateMeasure } = await import("./measure-crossvalidate");
  const sourceUrl = "https://voting.democracy.works/en/elections/fixture.html";
  const result = await crossValidateMeasure(
    {
      title: "Synthetic measure",
      text: "This synthetic ballot question describes funding for local public services. ".repeat(
        5,
      ),
      proStatement: "Synthetic supplied argument",
      source: {
        sourceName: "Democracy Works / Ballotpedia",
        sourceUrl,
        official: false,
        tier: "ballotpedia",
      },
    },
    { electionYear: 2026 },
  );
  assert.equal(generations, 1);
  assert.equal(result.summary, "Long summary");
  assert.equal(result.summaryIsAiGenerated, true);
  assert.ok(
    result.citations.some(
      (citation) =>
        citation.field === "summary" &&
        citation.sourceUrl === sourceUrl &&
        citation.sourceName === "Democracy Works / Ballotpedia" &&
        citation.tier === "ai_generated" &&
        !citation.official,
    ),
    "the generated summary must link to the provider text it used",
  );
});
