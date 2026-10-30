import assert from "node:assert/strict";
import test from "node:test";

import type {
  CaliforniaAiDependencies,
  CaliforniaModelCall,
} from "./california-ai.js";
import {
  authorCaliforniaBrief,
  californiaAuthorOutputSchema,
  californiaInvocationFailure,
  CaliforniaModelInvocationError,
  reviewCaliforniaBrief,
} from "./california-ai.js";
import { buildCaliforniaDossier } from "./california-dossier.js";
import { fixtureDossier } from "./california-dossier.test.js";

function point(text = "Morgan Lee proposes funding public libraries.") {
  return { title: "Stated goal", text, evidenceIds: ["platform"] };
}
function authorFixture() {
  const empty = () => ({
    missingEvidence:
      "This bounded collection does not establish this dimension.",
    claims: [],
  });
  return {
    priorities: {
      missingEvidence: null,
      claims: [
        {
          kind: "promise",
          text: "Morgan Lee proposes funding public libraries.",
          evidenceIds: ["platform"],
          promiseDetails: {
            title: "Libraries",
            brief: { change: point(), authority: point(), unknowns: point() },
            benefits: [],
            costs: [],
            affected: [],
            perspectives: [],
            steps: [],
            alternatives: [],
            unknowns: [],
          },
        },
      ],
    },
    record: empty(),
    mechanisms: empty(),
    effects: empty(),
    tradeoffs: empty(),
    unknowns: empty(),
    terms: [],
  };
}
function model(output: unknown) {
  return {
    output,
    configuredModel: "fixture:author",
    actualModel: "actual-fixture-model",
    provider: "fixture",
    requestId: "request-1",
    usage: { inputTokens: 100, outputTokens: 100 },
    costUsd: null,
  };
}
function dependencies(outputs: unknown[]) {
  let index = 0;
  const calls: CaliforniaModelCall[] = [];
  const deps: CaliforniaAiDependencies = {
    now: () => "2026-10-30T00:00:00.000Z",
    invoke: async (call) => {
      calls.push(call);
      return model(outputs[index++]);
    },
  };
  return { deps, calls };
}
function dossierInput() {
  const {
    schemaVersion: _v,
    classification: _c,
    sourceSetDigest: _s,
    dossierDigest: _d,
    ...input
  } = fixtureDossier();
  return input;
}

test("nested promises compile stable links and separate exact reviewer attestations", async () => {
  const { deps, calls } = dependencies([
    authorFixture(),
    {
      verdict: "approve",
      findings: [
        {
          claimId: "priorities-1",
          supported: true,
          reason: "Attributed source statement",
        },
      ],
    },
  ]);
  const dossier = fixtureDossier();
  const a = await authorCaliforniaBrief({ dossier, policyVersion: "p1" }, deps);
  const r = await reviewCaliforniaBrief(
    {
      brief: a.brief,
      dossier,
      policyVersion: "p1",
      authorAttestation: a.attestation,
    },
    deps,
  );
  assert.equal(a.brief.sections[0]!.claims[0]!.id, "priorities-1");
  assert.equal(a.brief.research!.promises[0]!.claimId, "priorities-1");
  assert.equal(a.brief.research!.headlineClaimId, "priorities-1");
  assert.equal(r.verdict, "approve");
  assert.notEqual(a.attestation.runId, r.attestation.runId);
  assert.notEqual(a.attestation.actorId, r.attestation.actorId);
  assert.equal(a.attestation.revisionDigest, r.attestation.revisionDigest);
  assert.equal(a.attestation.promptVersion, "california-author-v8");
  assert.equal(r.attestation.actualModel, "actual-fixture-model");
  assert.equal(calls[1]!.excludedConfiguredModel, "fixture:author");
});
test("fixed topics and dynamic evidence enums reject missing topics or foreign references", () => {
  const schema = californiaAuthorOutputSchema(["roster", "platform"]);
  const missing = { ...authorFixture(), record: undefined };
  assert.equal(schema.safeParse(missing).success, false);
  const foreign = authorFixture();
  foreign.priorities.claims[0]!.evidenceIds = ["foreign"];
  assert.equal(schema.safeParse(foreign).success, false);
});
test("promise reading cannot attach to a disputed claim or caller-chosen ID", async () => {
  const output = authorFixture();
  const primary = {
    kind: "analysis",
    id: "orphan-choice",
    text: "The campaign reports library work, which this dossier does not independently corroborate.",
    evidenceIds: ["platform"],
    promiseDetails: output.priorities.claims[0]!.promiseDetails,
  };
  const { deps } = dependencies([
    {
      ...output,
      priorities: { missingEvidence: null, claims: [primary] },
      research: {
        headlineClaimId: "orphan-choice",
        promises: [{ claimId: "orphan-choice", title: "orphan" }],
      },
    },
  ]);
  const a = await authorCaliforniaBrief(
    { dossier: fixtureDossier(), policyVersion: "p1" },
    deps,
  );
  assert.equal(a.brief.sections[0]!.claims[0]!.kind, "analysis");
  assert.equal(a.brief.sections[0]!.claims[0]!.id, "priorities-1");
  assert.equal(a.brief.research!.promises.length, 0);
  assert.equal(a.brief.research!.headlineClaimId, "priorities-1");
});
test("uncorroborated campaign record cannot be labeled an actual dispute", async () => {
  const output = {
    ...authorFixture(),
    record: {
      missingEvidence: null,
      claims: [
        {
          kind: "disputed",
          text: "The campaign reports past achievements that are not independently verified here.",
          evidenceIds: ["platform"],
        },
      ],
    },
  };
  const { deps } = dependencies([output]);
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: fixtureDossier(), policyVersion: "p1" },
      deps,
    ),
    (error: unknown) =>
      error instanceof CaliforniaModelInvocationError &&
      !!error.diagnostic.validationProblems?.some((problem) =>
        problem.includes("not disputes"),
      ),
  );
});
test("cosmetic extras never change prose or trusted financial disclosures", async () => {
  const prose =
    "Make life more affordable and grow the economy and jobs for working families.";
  const output = authorFixture();
  output.priorities.claims[0]!.text = prose;
  const malformed = {
    ...output,
    finance: { inventedTotal: 123 },
    financeGap: "invented",
    priorities: {
      ...output.priorities,
      claims: output.priorities.claims.map((claim) => ({
        ...claim,
        emphasis: ["grow jobs"],
        promiseDetails: {
          ...claim.promiseDetails,
          brief: {
            ...claim.promiseDetails.brief,
            change: { ...point(prose), emphasis: ["grow jobs"] },
          },
        },
      })),
    },
  };
  const input = dossierInput();
  const gap =
    "State finance has not been reconciled. Amounts and donors remain unknown.";
  input.gaps.push({
    dimension: "finance",
    code: "not_found_in_checked_sources",
    message: gap,
    checkedSourceIds: [],
    required: false,
  });
  const { deps } = dependencies([malformed]);
  const a = await authorCaliforniaBrief(
    { dossier: buildCaliforniaDossier(input), policyVersion: "p1" },
    deps,
  );
  assert.equal(a.brief.sections[0]!.claims[0]!.text, prose);
  assert.deepEqual(a.brief.sections[0]!.claims[0]!.emphasis, []);
  assert.equal(a.brief.research!.promises[0]!.brief.change.text, prose);
  assert.deepEqual(a.brief.research!.promises[0]!.brief.change.emphasis, []);
  assert.equal(a.brief.research!.finance, null);
  assert.equal(a.brief.research!.financeGap, gap);
});
test("unsupported and omitted reviewer findings never autoapprove", async () => {
  for (const findings of [
    [{ claimId: "priorities-1", supported: false, reason: "Unsupported cost" }],
    [],
  ]) {
    const { deps } = dependencies([
      authorFixture(),
      { verdict: "approve", findings },
    ]);
    const dossier = fixtureDossier();
    const a = await authorCaliforniaBrief(
      { dossier, policyVersion: "p1" },
      deps,
    );
    const r = reviewCaliforniaBrief(
      {
        brief: a.brief,
        dossier,
        policyVersion: "p1",
        authorAttestation: a.attestation,
      },
      deps,
    );
    if (!findings.length)
      await assert.rejects(r, CaliforniaModelInvocationError);
    else assert.equal((await r).verdict, "reject");
  }
});
test("wrong digest, stale policy and reused invocation block before review dispatch", async () => {
  const { deps, calls } = dependencies([authorFixture()]);
  const dossier = fixtureDossier();
  const a = await authorCaliforniaBrief({ dossier, policyVersion: "p1" }, deps);
  await assert.rejects(
    reviewCaliforniaBrief(
      { ...a, dossier, policyVersion: "p2", authorAttestation: a.attestation },
      deps,
    ),
    /attestation/,
  );
  await assert.rejects(
    reviewCaliforniaBrief(
      {
        ...a,
        dossier,
        policyVersion: "p1",
        authorAttestation: { ...a.attestation, revisionDigest: "c".repeat(64) },
      },
      deps,
    ),
    /attestation/,
  );
  await assert.rejects(
    reviewCaliforniaBrief(
      { ...a, dossier, policyVersion: "p1", authorAttestation: a.attestation },
      { ...deps, uuid: () => a.attestation.runId },
    ),
    /invocation/,
  );
  assert.equal(calls.length, 1);
});
test("judicial promises fail while required retrieval gaps block before author dispatch", async () => {
  const input = dossierInput();
  input.officeKind = "judicial_retention";
  const { deps, calls } = dependencies([authorFixture()]);
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: buildCaliforniaDossier(input), policyVersion: "p1" },
      deps,
    ),
    CaliforniaModelInvocationError,
  );
  input.gaps.push({
    dimension: "mechanisms",
    code: "source_unavailable",
    message: "Required office authority unavailable",
    checkedSourceIds: [],
    required: true,
  });
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: buildCaliforniaDossier(input), policyVersion: "p1" },
      deps,
    ),
    /Required source/,
  );
  assert.equal(calls.length, 1);
});
test("bounded archive projection preserves exact excerpts and honestly limits model review scope", async () => {
  const { californiaModelInput } = await import("./california-ai.js");
  const { createHash } = await import("node:crypto");
  const input = dossierInput();
  input.sources[0]!.text += " Unrelated archive passage.".repeat(30000);
  input.sources[0]!.contentHash = createHash("sha256")
    .update(input.sources[0]!.text)
    .digest("hex");
  const dossier = buildCaliforniaDossier(input);
  const projected = californiaModelInput({ dossier, policyVersion: "p1" });
  assert.ok(projected.bytes < 20000);
  assert.ok(
    projected.prompt.includes("Full archives were not sent to this model"),
  );
  assert.ok(projected.prompt.includes(dossier.evidence[1]!.excerpt));
});
test("SDK failures preserve private model output and token metadata without headers", async () => {
  const { NoObjectGeneratedError } = await import("ai");
  const usage = {
    inputTokens: 123,
    outputTokens: 8000,
    totalTokens: 8123,
    inputTokenDetails: {
      noCacheTokens: 123,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    outputTokenDetails: { textTokens: 1000, reasoningTokens: 7000 },
  };
  for (const [finishReason, causeName, expected] of [
    ["length", "AI_JSONParseError", "output_limit"],
    ["stop", "AI_JSONParseError", "json_parse"],
    ["stop", "AI_TypeValidationError", "schema_validation"],
  ] as const) {
    const sdkError = new NoObjectGeneratedError({
      text: '{"priorities":',
      cause: Object.assign(new Error("private SDK request"), {
        name: causeName,
      }),
      response: {
        id: "request-1",
        modelId: "actual-model",
        timestamp: new Date(),
        headers: { authorization: "never-retain-secret" },
      },
      usage,
      finishReason,
    });
    const error = californiaInvocationFailure(
      sdkError,
      {
        role: "author",
        configuredModel: "fixture:model",
        provider: "fixture",
        startedAt: "2026-10-30T00:00:00.000Z",
        completedAt: "2026-10-30T00:00:01.000Z",
      },
      NoObjectGeneratedError.isInstance(sdkError),
    );
    assert.equal(error.diagnostic.errorKind, expected);
    assert.equal(error.diagnostic.rawText, '{"priorities":');
    assert.equal(
      error.diagnostic.usage.outputTokenDetails.reasoningTokens,
      7000,
    );
    assert.ok(
      !JSON.stringify(error.diagnostic).includes("never-retain-secret"),
    );
  }
});
test("post-result schema errors retain parsed output and known usage", async () => {
  const output = { ...authorFixture(), priorities: undefined };
  const { deps } = dependencies([output]);
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: fixtureDossier(), policyVersion: "p1" },
      deps,
    ),
    (error: unknown) => {
      assert.ok(error instanceof CaliforniaModelInvocationError);
      assert.deepEqual(error.diagnostic.parsedOutput, output);
      assert.equal(error.diagnostic.usage.outputTokens, 100);
      assert.equal(error.diagnostic.finishReason, null);
      return true;
    },
  );
});

test("a broad promise without implementation details stays attributed without invented reading", async () => {
  const output = authorFixture();
  const { promiseDetails: _details, ...broad } = output.priorities.claims[0]!;
  const { deps } = dependencies([
    {
      ...output,
      priorities: {
        missingEvidence: "No implementation details are established.",
        claims: [{ ...broad, promiseDetails: null }],
      },
    },
  ]);
  const a = await authorCaliforniaBrief(
    { dossier: fixtureDossier(), policyVersion: "p1" },
    deps,
  );
  assert.equal(a.brief.sections[0]!.claims[0]!.kind, "promise");
  assert.equal(a.brief.sections[0]!.claims[0]!.text, broad.text);
  assert.equal(a.brief.research!.promises.length, 0);
  assert.equal(a.brief.research!.headlineClaimId, "priorities-1");
});

test("supported packets cannot compile only generic roster claims", async () => {
  const output = authorFixture();
  output.priorities.claims[0]!.evidenceIds = ["roster"];
  const { deps } = dependencies([output]);
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: fixtureDossier(), policyVersion: "p1" },
      deps,
    ),
    (error: unknown) =>
      error instanceof CaliforniaModelInvocationError &&
      !!error.diagnostic.validationProblems?.some((problem) =>
        problem.includes("candidate-specific evidence"),
      ),
  );
});

test("California author and Astra reviewer request strict JSON with independent reasoning settings", async (t) => {
  const keys = [
    "SCRAPER_FALLBACK_BASE_URL",
    "SCRAPER_FALLBACK_PRIORITY",
    "SCRAPER_FALLBACK_MODEL",
    "SCRAPER_FALLBACK_REASONING_EFFORT",
    "CANDIDATE_RESEARCH_REVIEW_MODEL",
    "OPENROUTER_API_KEY",
    "DEEPSEEK_API_KEY",
    "LOCAL_LLM_BASE_URL",
  ];
  const before = { ...process.env };
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    SCRAPER_FALLBACK_BASE_URL: "http://fixture-proxy.test/v1",
    SCRAPER_FALLBACK_PRIORITY: "primary",
    SCRAPER_FALLBACK_MODEL: "gpt-6-luna",
    SCRAPER_FALLBACK_REASONING_EFFORT: "none",
    CANDIDATE_RESEARCH_REVIEW_MODEL: "gpt-6-astra",
  });
  t.after(() => {
    for (const key of keys)
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
  });
  const bodies: {
    model: string;
    text: { format: { strict: boolean; schema: { required: string[] } } };
    reasoning: { effort: string };
  }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as (typeof bodies)[number];
      bodies.push(body);
      return Response.json({
        id: "fixture-response",
        created_at: 1,
        model: body.model,
        object: "response",
        status: "completed",
        output: [
          {
            id: "fixture-message",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(
                  body.model === "gpt-6-luna"
                    ? authorFixture()
                    : { verdict: "approve", findings: [] },
                ),
                annotations: [],
              },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      });
    },
  );
  const { invokeCaliforniaModel, configuredCaliforniaModels } =
    await import("./california-ai.js");
  const configured = await configuredCaliforniaModels();
  assert.equal(configured.author.modelId, "gpt-6-luna");
  assert.equal(configured.reviewer.modelId, "gpt-6-astra");
  await invokeCaliforniaModel({
    role: "author",
    system: "fixture",
    prompt: "fixture",
    evidenceIds: ["roster", "platform"],
    maxOutputTokens: 1000,
  });
  await invokeCaliforniaModel({
    role: "reviewer",
    system: "fixture",
    prompt: "fixture",
    excludedConfiguredModel: "fallback:gpt-6-luna",
    maxOutputTokens: 1000,
  });
  assert.deepEqual(
    bodies.map((body) => [
      body.model,
      body.text.format.strict,
      body.reasoning.effort,
    ]),
    [
      ["gpt-6-luna", true, "none"],
      ["gpt-6-astra", true, "low"],
    ],
  );
  assert.ok(bodies[0]!.text.format.schema.required.includes("terms"));
  function checkRequiredObjects(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(checkRequiredObjects);
      return;
    }
    const node = value as Record<string, unknown>;
    assert.ok(
      !("oneOf" in node),
      "Responses strict schema must not contain oneOf",
    );
    if (
      node.type === "object" &&
      node.properties &&
      typeof node.properties === "object"
    ) {
      assert.deepEqual(
        [...(node.required as string[])].sort(),
        Object.keys(node.properties).sort(),
      );
      assert.equal(node.additionalProperties, false);
    }
    Object.values(node).forEach(checkRequiredObjects);
  }
  checkRequiredObjects(bodies[0]!.text.format.schema);
  assert.ok(JSON.stringify(bodies[0]!.text.format.schema).includes('"anyOf"'));

  assert.equal(process.env.SCRAPER_FALLBACK_MODEL, "gpt-6-luna");
  assert.equal(process.env.SCRAPER_FALLBACK_REASONING_EFFORT, "none");
});

test("private API validation diagnostics whitelist status and error fields without retaining secrets", async () => {
  const { APICallError } = await import("ai");
  const sdkError = new APICallError({
    message: "Bearer secret-sdk-message",
    url: "https://fixture.invalid/?api_key=secret-url",
    requestBodyValues: { credential: "secret-request" },
    statusCode: 400,
    responseHeaders: {
      authorization: "secret-header",
      "x-request-id": "header-not-retained",
    },
    responseBody: JSON.stringify({
      error: {
        code: "invalid_json_schema",
        param: "text.format.schema",
        type: "invalid_request_error",
        message:
          "Invalid schema: oneOf not permitted. Bearer secret-response-token",
        credential: "secret-extra-field",
      },
      secret: "secret-body",
    }),
  });
  const error = californiaInvocationFailure(
    sdkError,
    {
      role: "author",
      configuredModel: "fixture:model",
      provider: "fixture",
      startedAt: "2026-10-30T00:00:00.000Z",
      completedAt: "2026-10-30T00:00:01.000Z",
    },
    false,
    APICallError.isInstance(sdkError),
  );
  assert.deepEqual(error.diagnostic.providerError, {
    statusCode: 400,
    code: "invalid_json_schema",
    param: "text.format.schema",
    type: "invalid_request_error",
    validationMessage:
      "Provider request validation rejected; recognized schema or parameter diagnostics: oneOf, not permitted, invalid.",
  });
  assert.ok(!JSON.stringify(error.diagnostic).includes("secret"));
  assert.equal(error.diagnostic.requestId, null);
  assert.equal(error.diagnostic.rawText, null);
});

test("authentication and generic provider messages are omitted from private diagnostics", async () => {
  const { APICallError } = await import("ai");
  const sdkError = new APICallError({
    message: "secret sdk message",
    url: "https://fixture.invalid",
    requestBodyValues: {},
    statusCode: 401,
    responseBody: JSON.stringify({
      error: {
        code: "invalid_api_key",
        type: "authentication_error",
        message: "Invalid API key secret-response",
        param: "secret-param-value",
      },
    }),
  });
  const error = californiaInvocationFailure(
    sdkError,
    {
      role: "author",
      configuredModel: "fixture:model",
      provider: "fixture",
      startedAt: "2026-10-30T00:00:00.000Z",
      completedAt: "2026-10-30T00:00:01.000Z",
    },
    false,
    APICallError.isInstance(sdkError),
  );
  assert.equal(error.diagnostic.providerError!.statusCode, 401);
  assert.equal(error.diagnostic.providerError!.code, "invalid_api_key");
  assert.equal(error.diagnostic.providerError!.validationMessage, null);
  assert.equal(error.diagnostic.providerError!.param, null);
  assert.ok(!JSON.stringify(error.diagnostic).includes("secret"));
});

test("binary image archives are retained and budgeted but omitted from model metadata and quote evidence", async () => {
  const { createHash } = await import("node:crypto");
  const { californiaModelInput } = await import("./california-ai.js");
  const input = dossierInput();
  const binary = Buffer.from("fixture-image-pixels");
  const image = {
    id: "ballot-image",
    url: "https://example.ca.gov/ballot.png",
    publisher: "Fixture election office",
    format: "image" as const,
    text: "",
    binaryBase64: binary.toString("base64"),
    byteHash: createHash("sha256").update(binary).digest("hex"),
    contentHash: createHash("sha256").update("").digest("hex"),
    fetchedAt: input.createdAt,
  };
  const dossier = buildCaliforniaDossier({
    ...input,
    sources: [...input.sources, image],
  });
  const projected = californiaModelInput({ dossier, policyVersion: "p1" });
  assert.ok(!projected.prompt.includes("binaryBase64"));
  assert.ok(!projected.prompt.includes(image.binaryBase64));
  assert.ok(projected.prompt.includes(image.byteHash));
  const changedBinary = Buffer.from("different-fixture-image-pixels");
  const changedImage = {
    ...image,
    binaryBase64: changedBinary.toString("base64"),
    byteHash: createHash("sha256").update(changedBinary).digest("hex"),
  };
  assert.notEqual(
    buildCaliforniaDossier({
      ...input,
      sources: [...input.sources, changedImage],
    }).sourceSetDigest,
    dossier.sourceSetDigest,
  );

  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        sources: [...input.sources, image],
        evidence: [
          ...input.evidence,
          {
            ...input.evidence[0]!,
            id: "image-quote",
            sourceId: image.id,
            excerpt: "invented image text",
          },
        ],
      }),
    /cannot supply textual quote/,
  );
  const oversized = Buffer.alloc(2_000_001, 1);
  assert.throws(
    () =>
      buildCaliforniaDossier({
        ...input,
        sources: [
          ...input.sources,
          {
            ...image,
            binaryBase64: oversized.toString("base64"),
            byteHash: createHash("sha256").update(oversized).digest("hex"),
          },
        ],
      }),
    /byte budget/,
  );
});

test("unchanged typed finance refresh preserves the exact approved brief timestamp while changed money rejects", async () => {
  const { validateBriefAgainstDossier } =
    await import("./california-dossier.js");
  const input = dossierInput();
  input.officeKind = "federal_legislative";
  input.evidence.push({
    ...input.evidence[0]!,
    id: "finance",
    role: "finance",
    identityQualification: "exact_election_office",
  });
  input.finance = {
    committeeId: "C00000001",
    committeeName: "Fixture committee",
    periodStart: "2025-01-01",
    periodEnd: "2026-09-30",
    currency: "USD",
    coverage: "partial",
    coverageNote: "Fixture processed record",
    updatedAt: input.createdAt,
    filingEvidenceIds: ["finance"],
    receipts: {
      totalCents: 10000,
      breakdown: {
        individuals: 10000,
        committees: 0,
        self_contributions: 0,
        candidate_loans: 0,
        transfers: 0,
        other: 0,
      },
      refundsCents: null,
    },
    donors: [],
    donorCoverage: "unavailable",
    outsideSpending: null,
  };
  const { deps } = dependencies([authorFixture()]);
  const a = await authorCaliforniaBrief(
    { dossier: buildCaliforniaDossier(input), policyVersion: "p1" },
    deps,
  );
  const refreshed = structuredClone(input);
  refreshed.createdAt = "2026-10-30T01:00:00.000Z";
  refreshed.finance!.updatedAt = refreshed.createdAt;
  refreshed.sources[0]!.fetchedAt = refreshed.createdAt;
  assert.doesNotThrow(() =>
    validateBriefAgainstDossier(a.brief, buildCaliforniaDossier(refreshed)),
  );
  assert.equal(a.brief.research!.finance!.updatedAt, input.finance.updatedAt);
  refreshed.finance!.receipts!.totalCents = 10001;
  refreshed.finance!.receipts!.breakdown.individuals = 10001;
  assert.throws(
    () =>
      validateBriefAgainstDossier(a.brief, buildCaliforniaDossier(refreshed)),
    /trusted typed dossier record/,
  );
});

test("v8 author contract preserves temporal attribution and bounds negative claims to collected passages", async () => {
  const output = authorFixture();
  output.record = {
    missingEvidence:
      "The collected passages contain no independent corroboration.",
    claims: [],
  };
  const { deps, calls } = dependencies([output]);
  const a = await authorCaliforniaBrief(
    { dossier: fixtureDossier(), policyVersion: "p1" },
    deps,
  );
  assert.equal(a.attestation.promptVersion, "california-author-v8");
  assert.ok(calls[0]!.system.includes("Never re-label a past accomplishment"));
  assert.ok(
    calls[0]!.system.includes(
      "separately contains an explicit future commitment",
    ),
  );
  assert.ok(
    calls[0]!.system.includes(
      "never assert that the whole campaign lacks a plan",
    ),
  );
  assert.ok(
    calls[0]!.system.includes("collected sources or supplied passages"),
  );
});

test("review rejects future commitments inferred from past record and campaign-wide absence inferred from excerpts", async () => {
  const { createHash } = await import("node:crypto");
  const { evidenceDigest } = await import("./california-dossier.js");
  const input = dossierInput();
  const past =
    "Morgan Lee says they helped keep rural hospitals open and protected reproductive health during past state service.";
  input.sources[0]!.text += " " + past;
  input.sources[0]!.contentHash = createHash("sha256")
    .update(input.sources[0]!.text)
    .digest("hex");
  input.evidence[1]!.excerpt = past;
  const empty = {
    missingEvidence:
      "Implementation details are absent from the collected passages.",
    claims: [],
  };
  const output = {
    ...authorFixture(),
    priorities: empty,
    record: {
      missingEvidence: null,
      claims: [{ kind: "analysis", text: past, evidenceIds: ["platform"] }],
    },
    mechanisms: {
      missingEvidence: null,
      claims: [
        {
          kind: "promise",
          text: "Lee will protect reproductive health in Congress.",
          evidenceIds: ["platform"],
          promiseDetails: null,
        },
      ],
    },
    unknowns: {
      missingEvidence: null,
      claims: [
        {
          kind: "analysis",
          text: "The campaign does not specify any implementation mechanism.",
          evidenceIds: ["platform"],
        },
      ],
    },
  };
  const actualRejectionReasons = [
    "Reproductive-health language describes past California work, not a clear congressional promise. Bounded excerpts cannot establish campaign-wide absence of federal proposals.",
    "The excerpts establish only that implementation details are absent from the supplied passages, not from the campaign overall.",
  ];
  const { deps, calls } = dependencies([
    output,
    {
      verdict: "reject",
      findings: [
        {
          claimId: "record-1",
          supported: true,
          reason: "Attributed campaign record remains a past claim.",
        },
        {
          claimId: "mechanisms-1",
          supported: false,
          reason: actualRejectionReasons[0],
        },
        {
          claimId: "unknowns-1",
          supported: false,
          reason: actualRejectionReasons[1],
        },
      ],
    },
  ]);
  const dossier = buildCaliforniaDossier(input);
  const a = await authorCaliforniaBrief({ dossier, policyVersion: "p1" }, deps);
  const originalDigest = evidenceDigest(a.brief);
  const reviewed = await reviewCaliforniaBrief(
    {
      brief: a.brief,
      dossier,
      policyVersion: "p1",
      authorAttestation: a.attestation,
    },
    deps,
  );
  assert.equal(reviewed.verdict, "reject");
  assert.equal(
    reviewed.findings.filter((finding) => !finding.supported).length,
    2,
  );
  assert.equal(evidenceDigest(a.brief), originalDigest);
  assert.equal(calls.length, 2);
  assert.equal(
    a.brief.sections.find((section) => section.topic === "record")!.claims[0]!
      .kind,
    "analysis",
  );
});
