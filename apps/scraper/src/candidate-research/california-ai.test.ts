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
import {
  fixtureCampaignMaterialDossier,
  fixtureDossier,
} from "./california-dossier.test.js";

function fixtureAuthorEvidence() {
  return {
    candidateIds: ["platform"],
    officeIds: [],
    requiredCandidateIds: ["platform"],
  };
}

function point(text = "Morgan Lee proposes funding public libraries.") {
  return { title: "Stated goal", text, evidenceIds: ["platform"] };
}
function authorFixture() {
  const empty = () => ({
    claims: [],
  });
  return {
    priorities: {
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
      overallReason: "The exact source context supports the complete brief.",
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
  assert.equal(a.attestation.promptVersion, "california-author-v13");
  assert.equal(r.attestation.actualModel, "actual-fixture-model");
  assert.equal(calls[1]!.excludedConfiguredModel, "fixture:author");
});
test("fixed topics and dynamic evidence enums reject missing topics or foreign references", () => {
  const schema = californiaAuthorOutputSchema(fixtureAuthorEvidence());
  const missing = { ...authorFixture(), record: undefined };
  assert.equal(schema.safeParse(missing).success, false);
  const foreign = authorFixture();
  foreign.priorities.claims[0]!.evidenceIds = ["foreign"];
  assert.equal(schema.safeParse(foreign).success, false);
});
test("strict author rejects caller IDs, orphan readings and legacy research objects", async () => {
  const output = authorFixture();
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: fixtureDossier(), policyVersion: "p1" },
      dependencies([
        {
          ...output,
          research: { headlineClaimId: "invented" },
          priorities: {
            claims: [{ ...output.priorities.claims[0], id: "invented" }],
          },
        },
      ]).deps,
    ),
    CaliforniaModelInvocationError,
  );
});

test("uncorroborated campaign record cannot be labeled an actual dispute", async () => {
  const output = {
    ...authorFixture(),
    record: {
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
test("strict author rejects cosmetic or financial extras while code preserves finance gaps", async () => {
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
  const dossier = buildCaliforniaDossier(input);
  const output = authorFixture();
  const good = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    dependencies([output]).deps,
  );
  assert.equal(good.brief.research!.finance, null);
  assert.equal(good.brief.research!.financeGap, gap);
  for (const bad of [
    { ...output, finance: { inventedTotal: 123 } },
    {
      ...output,
      priorities: {
        claims: [{ ...output.priorities.claims[0], emphasis: ["invented"] }],
      },
    },
  ])
    await assert.rejects(
      authorCaliforniaBrief(
        { dossier, policyVersion: "p1" },
        dependencies([bad]).deps,
      ),
      CaliforniaModelInvocationError,
    );
});

test("unsupported and omitted reviewer findings never autoapprove", async () => {
  for (const findings of [
    [{ claimId: "priorities-1", supported: false, reason: "Unsupported cost" }],
    [],
  ]) {
    const { deps } = dependencies([
      authorFixture(),
      {
        verdict: "approve",
        overallReason: "The exact source context supports the complete brief.",
        findings,
      },
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

test("roster-only prose is rejected at the author boundary", async () => {
  const output = {
    ...authorFixture(),
    priorities: {
      claims: [
        {
          kind: "fact",
          text: "The roster lists Morgan Lee.",
          evidenceIds: ["roster"],
        },
      ],
    },
  };
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: fixtureDossier(), policyVersion: "p1" },
      dependencies([output]).deps,
    ),
    CaliforniaModelInvocationError,
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
                    : {
                        verdict: "approve",
                        overallReason:
                          "The exact source context supports the complete brief.",
                        findings: [],
                      },
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
    authorEvidence: fixtureAuthorEvidence(),
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

test("v13 author owns claims only and preserves temporal and contextual constraints", async () => {
  const { deps, calls } = dependencies([authorFixture()]);
  const result = await authorCaliforniaBrief(
    { dossier: fixtureDossier(), policyVersion: "p1" },
    deps,
  );
  assert.equal(result.attestation.promptVersion, "california-author-v13");
  assert.ok(
    calls[0]!.system.includes("Past achievements belong only in Record"),
  );
  assert.ok(
    calls[0]!.system.includes(
      "never roster facts, generic powers, source availability or packet absence filler",
    ),
  );
  assert.ok(
    calls[0]!.system.includes("Trusted code owns coverage and typed finance"),
  );
  assert.deepEqual(calls[0]!.authorEvidence, fixtureAuthorEvidence());
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
    claims: [],
  };
  const output = {
    ...authorFixture(),
    priorities: empty,
    record: {
      claims: [{ kind: "analysis", text: past, evidenceIds: ["platform"] }],
    },
    mechanisms: {
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
      overallReason:
        "The exact source context does not support the complete brief.",
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

test("author and reviewer retain ordinary source truth checks without authored coverage", async () => {
  const { deps, calls } = dependencies([
    authorFixture(),
    {
      verdict: "reject",
      overallReason: "Fixture unsupported claim",
      findings: [
        {
          claimId: "priorities-1",
          supported: false,
          reason: "Fixture unsupported claim",
        },
      ],
    },
  ]);
  const dossier = fixtureDossier();
  const authored = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    deps,
  );
  const reviewed = await reviewCaliforniaBrief(
    {
      brief: authored.brief,
      dossier,
      policyVersion: "p1",
      authorAttestation: authored.attestation,
    },
    deps,
  );
  assert.equal(reviewed.verdict, "reject");
  assert.ok(calls[0]!.system.includes("claims only"));
  assert.ok(calls[1]!.system.includes("OWN cited evidenceIds"));
  assert.ok(calls[1]!.system.includes("Check missing-evidence disclosures"));
});

test("both model packets retain full speaker context and trusted compilation preserves public attribution", async () => {
  const dossier = fixtureCampaignMaterialDossier();
  const output = {
    ...authorFixture(),
    priorities: {
      claims: [],
    },
  };
  const { deps, calls } = dependencies([
    output,
    {
      verdict: "approve",
      overallReason: "The exact source context supports the complete brief.",
      findings: [],
    },
  ]);
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
  assert.equal(r.verdict, "approve");
  const { hasSubstantiveCandidateResearch } = await import("@acme/validators");
  assert.equal(hasSubstantiveCandidateResearch(a.brief, dossier), false);
  assert.equal(a.brief.research, undefined);
  const context = dossier.evidence[1]!.attribution!.context.excerpt;
  assert.ok(context.length > 600);
  for (const call of calls) {
    const packet = JSON.parse(call.prompt);
    assert.equal(
      packet.dossier.evidence[1].attribution.context.excerpt,
      context,
    );
    assert.ok(
      packet.dossier.sources[0].contextWindows.some((window: any) =>
        window.text.includes(context),
      ),
    );
  }
  assert.deepEqual(
    a.brief.evidence[1]!.attribution,
    dossier.evidence[1]!.attribution,
  );
  const stripped = structuredClone(a.brief);
  delete stripped.evidence[1]!.attribution;
  const { validateBriefAgainstDossier } =
    await import("./california-dossier.js");
  assert.throws(
    () => validateBriefAgainstDossier(stripped, dossier),
    /immutable dossier/,
  );
  const truncated = structuredClone(a.brief);
  truncated.evidence[1]!.attribution!.context.excerpt =
    truncated.evidence[1]!.excerpt;
  assert.throws(
    () => validateBriefAgainstDossier(truncated, dossier),
    /immutable dossier/,
  );
});

test("quality certificates name exact Record or Priorities claims and exclude unsupported chapters", async () => {
  const { deriveCandidateResearchQuality } = await import("@acme/validators");
  const dossier = fixtureDossier();
  const { deps } = dependencies([authorFixture()]);
  const a = await authorCaliforniaBrief({ dossier, policyVersion: "p1" }, deps);
  assert.deepEqual(deriveCandidateResearchQuality(a.brief, dossier), {
    basis: "candidate_priorities",
    claimIds: ["priorities-1"],
    evidenceIds: ["platform"],
  });
  const moved = structuredClone(a.brief);
  moved.sections.find((section) => section.topic === "effects")!.claims =
    moved.sections[0]!.claims;
  moved.sections[0]!.claims = [];
  assert.equal(deriveCandidateResearchQuality(moved, dossier), null);
  moved.sections.find((section) => section.topic === "record")!.claims =
    moved.sections.find((section) => section.topic === "effects")!.claims;
  assert.equal(
    deriveCandidateResearchQuality(moved, dossier)?.basis,
    "candidate_record",
  );
});

test("finance-only quality requires actual identity-reconciled amounts and returns their exact evidence IDs", async () => {
  const { createHash } = await import("node:crypto");
  const { deriveCandidateResearchQuality } = await import("@acme/validators");
  const input = dossierInput();
  input.evidence = input.evidence.filter((entry) => entry.role === "roster");
  input.officeKind = "federal_legislative";
  input.officeFamily = "us_house";
  input.identity.jurisdiction = "ocd-division/country:us/state:ca/cd:1";
  const text = JSON.stringify(
    {
      results: [
        {
          candidate_id: "H0CA01001",
          name: "LEE, MORGAN",
          office: "H",
          state: "CA",
          district: "01",
          cycles: [2026],
          election_years: [2026],
          total_receipts: 100,
        },
      ],
    },
    null,
    2,
  );
  const contentHash = createHash("sha256").update(text).digest("hex");
  input.sources.push({
    id: "fec",
    url: "https://api.open.fec.gov/v1/candidates/search/",
    publisher: "FEC fixture",
    format: "json",
    text,
    contentHash,
    fetchedAt: input.createdAt,
  });
  input.evidence.push({
    id: "finance",
    sourceId: "fec",
    excerpt: '"total_receipts": 100',
    locator: "Processed receipts fixture",
    origin: "primary_record",
    role: "finance",
    identityQualification: "exact_election_office",
  });
  input.financeIdentityProof = {
    candidateId: "H0CA01001",
    name: "LEE, MORGAN",
    office: "H",
    state: "CA",
    district: "1",
    cycle: 2026,
    sourceId: "fec",
    sourceHash: contentHash,
  };
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
  const output = {
    priorities: { claims: [] },
    record: { claims: [] },
    mechanisms: { claims: [] },
    effects: { claims: [] },
    tradeoffs: { claims: [] },
    unknowns: { claims: [] },
    terms: [],
  };
  const dossier = buildCaliforniaDossier(input);
  const { deps } = dependencies([output]);
  const a = await authorCaliforniaBrief({ dossier, policyVersion: "p1" }, deps);
  assert.deepEqual(deriveCandidateResearchQuality(a.brief, dossier), {
    basis: "reconciled_finance",
    claimIds: [],
    evidenceIds: ["finance"],
  });
  const emptyOutput = output;
  for (const finance of [
    input.finance,
    {
      ...input.finance,
      receipts: null,
      donorCoverage: "selected" as const,
      donors: [
        {
          id: "donor-1",
          name: "Recorded donor",
          type: "individual" as const,
          amountCents: 10000,
          evidenceIds: ["finance"],
          lobbying: null,
          interests: [],
          positions: [],
        },
      ],
    },
    {
      ...input.finance,
      receipts: null,
      outsideSpending: [
        {
          id: "outside-1",
          spender: "Recorded spender",
          direction: "support" as const,
          amountCents: 10000,
          evidenceIds: ["finance"],
        },
      ],
    },
    {
      ...input.finance,
      receipts: null,
      coverage: "complete" as const,
      outsideSpending: [],
    },
  ]) {
    const packet = buildCaliforniaDossier({ ...input, finance });
    const compiled = await authorCaliforniaBrief(
      { dossier: packet, policyVersion: "p1" },
      dependencies([emptyOutput]).deps,
    );
    assert.deepEqual(compiled.brief.research!.finance, packet.finance);
    const financialQuestions = compiled.brief.sections.find(
      (section) => section.topic === "unknowns",
    )!.missingEvidence!;
    if (!finance.receipts)
      assert.ok(
        financialQuestions.includes(
          "does not present reconciled receipt totals",
        ),
      );
    if (finance.donorCoverage === "unavailable" && !finance.donors.length)
      assert.ok(
        financialQuestions.includes(
          "does not present itemized contribution findings",
        ),
      );
    if (finance.donors.length)
      assert.ok(
        !financialQuestions.includes(
          "does not present itemized contribution findings",
        ),
      );
    if (finance.outsideSpending === null)
      assert.ok(
        financialQuestions.includes(
          "does not present independent-spending analysis",
        ),
      );
    else
      assert.ok(
        !financialQuestions.includes(
          "does not present independent-spending analysis",
        ),
      );
    assert.ok(!financialQuestions.includes("research was not performed"));
    assert.ok(!financialQuestions.includes("expected consequences"));

    const beforeReview = JSON.stringify(compiled.brief);
    const reviewTransport = dependencies([
      {
        verdict: "reject",
        overallReason:
          "The review fixture identifies a whole-brief financial-source question.",
        findings: [],
      },
    ]);
    const financeReview = await reviewCaliforniaBrief(
      {
        brief: compiled.brief,
        dossier: packet,
        policyVersion: "p1",
        authorAttestation: compiled.attestation,
      },
      reviewTransport.deps,
    );
    const reviewCall = reviewTransport.calls[0]!;
    const transported = JSON.parse(reviewCall.prompt);
    assert.equal(reviewCall.role, "reviewer");
    assert.equal(
      reviewCall.excludedConfiguredModel,
      compiled.attestation.configuredModel,
    );
    assert.deepEqual(transported.brief, compiled.brief);
    assert.deepEqual(transported.brief.research.finance, packet.finance);
    assert.deepEqual(transported.brief.evidence, compiled.brief.evidence);
    assert.deepEqual(transported.brief.sections, compiled.brief.sections);
    assert.equal(
      transported.revisionDigest,
      compiled.attestation.revisionDigest,
    );
    assert.equal(
      financeReview.attestation.revisionDigest,
      compiled.attestation.revisionDigest,
    );
    assert.equal(
      financeReview.attestation.sourceSetDigest,
      packet.sourceSetDigest,
    );
    assert.equal(financeReview.attestation.dossierDigest, packet.dossierDigest);
    assert.notEqual(
      financeReview.attestation.runId,
      compiled.attestation.runId,
    );
    assert.equal(JSON.stringify(compiled.brief), beforeReview);
    assert.ok(
      transported.dossier.sources.some(
        (source: { contextWindows: { text: string }[] }) =>
          source.contextWindows.some((window) =>
            window.text.includes('"total_receipts": 100'),
          ),
      ),
    );
    assert.equal(financeReview.verdict, "reject");
    assert.equal(
      financeReview.overallReason,
      "The review fixture identifies a whole-brief financial-source question.",
    );
    assert.deepEqual(financeReview.findings, []);
    assert.equal(
      Object.hasOwn(compiled.brief.research!, "headlineClaimId"),
      false,
    );
    assert.equal(
      compiled.brief.sections.flatMap((section) => section.claims).length,
      0,
    );
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([key, item]) => [key, reverseKeys(item)]),
        );
      return value;
    };
    const jsonbBrief = reverseKeys(compiled.brief) as typeof compiled.brief;
    assert.deepEqual(deriveCandidateResearchQuality(jsonbBrief, packet), {
      basis: "reconciled_finance",
      claimIds: [],
      evidenceIds: ["finance"],
    });
    assert.deepEqual(deriveCandidateResearchQuality(compiled.brief, packet), {
      basis: "reconciled_finance",
      claimIds: [],
      evidenceIds: ["finance"],
    });
    const { candidateBriefSchema } = await import("@acme/validators");
    assert.throws(
      () =>
        candidateBriefSchema.parse({
          ...compiled.brief,
          research: {
            ...compiled.brief.research,
            finance: null,
            financeGap: "Unavailable",
          },
        }),
      /without a headline requires substantive finance/,
    );
    assert.throws(
      () =>
        candidateBriefSchema.parse({
          ...compiled.brief,
          sections: compiled.brief.sections.map((section, index) =>
            index
              ? section
              : {
                  ...section,
                  claims: [
                    {
                      id: "unexpected-prose",
                      kind: "fact",
                      text: "The roster lists a candidate.",
                      evidenceIds: ["roster"],
                      emphasis: [],
                    },
                  ],
                },
          ),
        }),
      /Finance-only research cannot omit a prose headline/,
    );
  }
  const noFinanceDossier = buildCaliforniaDossier({
    ...input,
    finance: undefined,
    financeIdentityProof: undefined,
  });
  const noFinance = await authorCaliforniaBrief(
    { dossier: noFinanceDossier, policyVersion: "p1" },
    dependencies([emptyOutput]).deps,
  );
  assert.equal(noFinance.brief.research, undefined);
  assert.equal(
    deriveCandidateResearchQuality(noFinance.brief, noFinanceDossier),
    null,
  );
  assert.equal(
    deriveCandidateResearchQuality(a.brief, {
      ...dossier,
      financeIdentityProof: undefined,
    }),
    null,
  );
  assert.equal(
    deriveCandidateResearchQuality(
      {
        ...a.brief,
        research: {
          ...a.brief.research!,
          finance: null,
          financeGap: "No verified financial data.",
        },
      },
      dossier,
    ),
    null,
  );
});

test("v6 reviewer contract distinguishes named campaign proposals from another person's pledge", async () => {
  const { createHash } = await import("node:crypto");
  const cases = [
    {
      context:
        "Our priorities\nMorgan Lee will support public-library funding. The campaign presents this as Morgan Lee's current proposal.",
      quote: "Morgan Lee will support public-library funding.",
      verdict: "approve",
      overallReason: "The exact source context supports the complete brief.",
      supported: true,
      reason:
        "The complete context explicitly makes the candidate the proposal's subject; the claim reports it as the campaign's statement, without claiming personal authorship.",
    },
    {
      context:
        "Statement by a school principal\nI will support public-library funding.",
      quote: "I will support public-library funding.",
      verdict: "reject",
      overallReason:
        "The exact source context does not support the complete brief.",
      supported: false,
      reason:
        "The heading assigns this pledge to another person. Hosting the quotation does not show candidate adoption.",
    },
  ] as const;
  for (const scenario of cases) {
    const input = dossierInput();
    input.sources[0]!.text += "\n" + scenario.context;
    input.sources[0]!.contentHash = createHash("sha256")
      .update(input.sources[0]!.text)
      .digest("hex");
    input.evidence[1] = {
      ...input.evidence[1]!,
      excerpt: scenario.quote,
      role: "campaign_material",
      attribution: {
        status: "unresolved",
        context: {
          excerpt: scenario.context,
          locator: "Full bounded campaign section",
        },
      },
    };
    const dossier = buildCaliforniaDossier(input);
    const output = {
      ...authorFixture(),
      priorities: {
        claims: [
          {
            kind: "promise",
            text: "The campaign says Morgan Lee will support public-library funding.",
            evidenceIds: ["platform"],
            promiseDetails: null,
          },
        ],
      },
    };
    const { deps, calls } = dependencies([
      output,
      {
        verdict: scenario.verdict,
        overallReason: scenario.reason,
        findings: [
          {
            claimId: "priorities-1",
            supported: scenario.supported,
            reason: scenario.reason,
          },
        ],
      },
    ]);
    const authored = await authorCaliforniaBrief(
      { dossier, policyVersion: "p1" },
      deps,
    );
    const reviewed = await reviewCaliforniaBrief(
      {
        brief: authored.brief,
        dossier,
        policyVersion: "p1",
        authorAttestation: authored.attestation,
      },
      deps,
    );
    assert.equal(reviewed.verdict, scenario.verdict);
    assert.equal(reviewed.attestation.promptVersion, "california-review-v6");
    assert.ok(
      calls[1]!.system.includes("collector abstention, not a prohibition"),
    );
    assert.ok(
      calls[1]!.system.includes(
        "explicitly and unambiguously names the candidate",
      ),
    );
    assert.ok(
      calls[1]!.system.includes(
        "quotes another person without explicit candidate adoption",
      ),
    );
    assert.ok(
      calls[1]!.prompt.includes(JSON.stringify(scenario.context).slice(1, -1)),
    );
    assert.equal(authored.brief.evidence[1]!.attribution!.status, "unresolved");
  }
});

test("v6 zero-claim reviews require an overall reason and preserve missing-reason diagnostics", async () => {
  const dossier = fixtureCampaignMaterialDossier();
  const output = {
    ...authorFixture(),
    priorities: {
      claims: [],
    },
  };
  const author = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    dependencies([output]).deps,
  );
  const before = JSON.stringify(author.brief);
  const oldPrivateReview = { verdict: "reject", findings: [] };
  const oldBefore = JSON.stringify(oldPrivateReview);
  const rejected = await reviewCaliforniaBrief(
    {
      brief: author.brief,
      dossier,
      policyVersion: "p1",
      authorAttestation: author.attestation,
    },
    dependencies([
      {
        verdict: "reject",
        overallReason:
          "The financial disclosure is incomplete and the gap does not identify what remains unverified.",
        findings: [],
      },
    ]).deps,
  );
  assert.equal(rejected.verdict, "reject");
  assert.ok(rejected.overallReason!.length > 0);
  assert.deepEqual(rejected.findings, []);
  await assert.rejects(
    () =>
      reviewCaliforniaBrief(
        {
          brief: author.brief,
          dossier,
          policyVersion: "p1",
          authorAttestation: author.attestation,
        },
        dependencies([oldPrivateReview]).deps,
      ),
    (error: unknown) =>
      error instanceof CaliforniaModelInvocationError &&
      error.diagnostic.errorKind === "schema_validation" &&
      error.diagnostic.validationProblems!.some((problem) =>
        problem.includes("overallReason"),
      ) &&
      error.diagnostic.parsedOutput !== null &&
      error.diagnostic.usage.inputTokens === 100,
  );
  assert.equal(JSON.stringify(author.brief), before);
  assert.equal(JSON.stringify(oldPrivateReview), oldBefore);
});

test("legacy authored coverage fails rather than being dropped or repaired", async () => {
  const output = {
    ...authorFixture(),
    priorities: {
      ...authorFixture().priorities,
      missingEvidence: "The supplied passage omits details.",
    },
  };
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: fixtureDossier(), policyVersion: "p1" },
      dependencies([output]).deps,
    ),
    CaliforniaModelInvocationError,
  );
});

test("v6 reviewer rejects a wrong cited ID even when the full packet contains correct authority elsewhere", async () => {
  const { createHash } = await import("node:crypto");
  const input = dossierInput();
  for (const entry of [
    {
      id: "unrelated",
      text: "The incumbent was born in California.",
      role: "candidate_record" as const,
    },
    {
      id: "actual-powers",
      text: "The State Assembly votes on state legislation.",
      role: "office_authority" as const,
    },
  ]) {
    input.sources.push({
      id: entry.id,
      url: `https://example.ca.gov/${entry.id}`,
      publisher: "Official fixture",
      format: "text",
      text: entry.text,
      contentHash: createHash("sha256").update(entry.text).digest("hex"),
      fetchedAt: input.createdAt,
    });
    input.evidence.push({
      id: entry.id,
      sourceId: entry.id,
      excerpt: entry.text,
      locator: "Full official passage",
      origin: "primary_record",
      role: entry.role,
      identityQualification: "exact_election_office",
    });
  }
  const dossier = buildCaliforniaDossier(input);
  const output = {
    ...authorFixture(),
    priorities: authorFixture().priorities,
    mechanisms: {
      claims: [
        {
          kind: "fact",
          text: "The State Assembly votes on state legislation.",
          evidenceIds: ["unrelated"],
        },
      ],
    },
  };
  const { deps, calls } = dependencies([
    output,
    {
      verdict: "reject",
      overallReason:
        "The mechanism's cited evidence is a biography. Correct authority elsewhere does not repair that citation.",
      findings: [
        {
          claimId: "priorities-1",
          supported: true,
          reason: "The candidate statement supports the proposal.",
        },
        {
          claimId: "mechanisms-1",
          supported: false,
          reason:
            "Cited unrelated does not support the stated power; actual-powers is not cited.",
        },
      ],
    },
  ]);
  const authored = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    deps,
  );
  const reviewed = await reviewCaliforniaBrief(
    {
      brief: authored.brief,
      dossier,
      policyVersion: "p1",
      authorAttestation: authored.attestation,
    },
    deps,
  );
  assert.equal(reviewed.verdict, "reject");
  assert.ok(calls[1]!.system.includes("EACH claim and EACH research point"));
  assert.ok(calls[1]!.system.includes("OWN cited evidenceIds"));
  assert.ok(
    calls[1]!.system.includes(
      "Material elsewhere in the packet cannot rescue a wrong citation",
    ),
  );
  assert.ok(
    calls[1]!.prompt.includes("The State Assembly votes on state legislation."),
  );
  assert.deepEqual(authored.brief.sections[2]!.claims[0]!.evidenceIds, [
    "unrelated",
  ]);
  assert.ok(calls[1]!.system.includes("never unread archives"));
});

function emptyAuthorFixture() {
  return {
    priorities: { claims: [] },
    record: { claims: [] },
    mechanisms: { claims: [] },
    effects: { claims: [] },
    tradeoffs: { claims: [] },
    unknowns: { claims: [] },
    terms: [],
  };
}

test("one role envelope constrains provider schema and return parsing including zero-candidate maxItems zero", async () => {
  const { zodSchema } = await import("ai");
  for (const envelope of [
    fixtureAuthorEvidence(),
    { candidateIds: [], officeIds: ["office"], requiredCandidateIds: [] },
  ]) {
    const schema = californiaAuthorOutputSchema(envelope);
    const json = await zodSchema(schema).jsonSchema;
    const visit = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object")
        for (const [key, item] of Object.entries(value)) {
          assert.ok(!["not", "oneOf"].includes(key));
          if (key === "enum") assert.ok((item as unknown[]).length > 0);
          visit(item);
        }
    };
    visit(json);
    assert.ok(JSON.stringify(json).includes('"anyOf"'));
    if (!envelope.candidateIds.length) {
      const properties = (json as any).properties;
      for (const topic of [
        "priorities",
        "record",
        "mechanisms",
        "effects",
        "tradeoffs",
        "unknowns",
      ]) {
        assert.equal(properties[topic].properties.claims.maxItems, 0);
        assert.ok(properties[topic].properties.claims.items.anyOf.length > 0);
      }
      assert.equal(properties.terms.maxItems, 0);
      assert.ok(properties.terms.items.properties.term);
      assert.equal(schema.safeParse(emptyAuthorFixture()).success, true);
      assert.equal(schema.safeParse(authorFixture()).success, false);
    }
  }
  const dossier = fixtureDossier(false);
  const { deps, calls } = dependencies([emptyAuthorFixture()]);
  const authored = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    deps,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.authorEvidence, {
    candidateIds: [],
    officeIds: [],
    requiredCandidateIds: [],
  });
  assert.deepEqual(
    JSON.parse(calls[0]!.prompt).authorEvidence,
    calls[0]!.authorEvidence,
  );
  assert.equal(
    authored.brief.sections.flatMap((section) => section.claims).length,
    0,
  );
  assert.equal(authored.brief.research, undefined);
});

test("strict role boundary excludes roster and finance and limits office-only nested references to authority", () => {
  const schema = californiaAuthorOutputSchema({
    candidateIds: ["platform"],
    officeIds: ["office"],
    requiredCandidateIds: ["platform"],
  });
  const good = authorFixture();
  good.priorities.claims[0]!.promiseDetails.brief.authority.evidenceIds = [
    "office",
  ];
  assert.equal(schema.safeParse(good).success, true);
  for (const field of ["change", "unknowns"] as const) {
    const bad = structuredClone(good);
    bad.priorities.claims[0]!.promiseDetails.brief[field].evidenceIds = [
      "office",
    ];
    assert.equal(schema.safeParse(bad).success, false);
  }
  const badBenefit = structuredClone(good);
  badBenefit.priorities.claims[0]!.promiseDetails.benefits = [
    { ...point(), evidenceIds: ["office"] },
  ] as never;
  assert.equal(schema.safeParse(badBenefit).success, false);
  for (const id of ["roster", "finance", "office"]) {
    const bad = structuredClone(good);
    bad.priorities.claims[0]!.evidenceIds = [id];
    assert.equal(schema.safeParse(bad).success, false);
  }
  const onlyMechanisms = {
    ...emptyAuthorFixture(),
    mechanisms: {
      claims: [
        { kind: "fact", text: "Board adopts policy.", evidenceIds: ["office"] },
      ],
    },
  };
  assert.equal(schema.safeParse(onlyMechanisms).success, false);
  const unknownOnly = {
    ...emptyAuthorFixture(),
    unknowns: {
      claims: [
        {
          kind: "analysis",
          text: "What funding is proposed?",
          evidenceIds: ["platform"],
        },
      ],
    },
  };
  assert.equal(schema.safeParse(unknownOnly).success, false);
  for (const extra of [
    { missingEvidence: "legacy" },
    { finance: null },
    { emphasis: [] },
  ])
    assert.equal(schema.safeParse({ ...good, ...extra }).success, false);
});

test("compiler projects gap meanings without asserting retrieval cause or unseen archive absence", async () => {
  const gaps = [
    { code: "source_unavailable" as const, message: "HTTP retrieval failed." },
    {
      code: "source_unavailable" as const,
      message: "Retrieved campaign page exceeds the complete context bound.",
    },
    {
      code: "source_unavailable" as const,
      message: "Discovery service unavailable.",
    },
    {
      code: "identity_unresolved" as const,
      message: "An optional official campaign URL could not be verified.",
    },
    {
      code: "not_found_in_checked_sources" as const,
      message: "No additional selected passage for this topic.",
    },
  ];
  for (const gap of gaps) {
    const input = dossierInput();
    input.gaps.push({
      ...gap,
      dimension: "priorities",
      checkedSourceIds: ["official"],
      required: false,
    });
    const dossier = buildCaliforniaDossier(input);
    const before = JSON.stringify(dossier.gaps);
    const { deps, calls } = dependencies([authorFixture()]);
    const authored = await authorCaliforniaBrief(
      { dossier, policyVersion: "p1" },
      deps,
    );
    const coverage = authored.brief.sections[0]!.missingEvidence!;
    assert.ok(coverage);
    assert.ok(!coverage.includes("could not be retrieved"));
    assert.ok(!coverage.includes("person's identity"));
    if (gap.code === "source_unavailable")
      assert.ok(coverage.includes("Collection of usable material"));
    if (gap.code === "identity_unresolved")
      assert.ok(coverage.includes("Verification of sources"));
    assert.equal(
      JSON.stringify(JSON.parse(calls[0]!.prompt).dossier.gaps),
      before,
    );
    assert.equal(JSON.stringify(dossier.gaps), before);
  }
  const input = dossierInput();
  input.gaps.push({
    dimension: "mechanisms",
    code: "identity_unresolved",
    message: "No verified office-authority adapter.",
    checkedSourceIds: [],
    required: true,
  });
  const { deps, calls } = dependencies([authorFixture()]);
  await assert.rejects(
    authorCaliforniaBrief(
      { dossier: buildCaliforniaDossier(input), policyVersion: "p1" },
      deps,
    ),
    /Required source or identity/,
  );
  assert.equal(calls.length, 0);
});

test("nonempty local Mechanisms retains incomplete authority scope and exact private notes", async () => {
  const { createHash } = await import("node:crypto");
  const input = dossierInput();
  input.officeKind = "local";
  input.officeFamily = "local";
  const passage =
    "The Board collectively adopts policy and staff implements it.";
  input.sources[0]!.text += "\n" + passage;
  input.sources[0]!.contentHash = createHash("sha256")
    .update(input.sources[0]!.text)
    .digest("hex");
  input.evidence.push({
    id: "office",
    sourceId: "official",
    excerpt: passage,
    locator: "Board policy",
    origin: "primary_record",
    role: "office_authority",
    identityQualification: "exact_election_office",
  });
  const note =
    "The 2015 policy establishes collective Board adoption and staff implementation, not all statutory powers or spending adoption.";
  input.gaps.push({
    dimension: "mechanisms",
    code: "not_found_in_checked_sources",
    message: note,
    checkedSourceIds: ["official"],
    required: false,
  });
  const output = {
    ...authorFixture(),
    mechanisms: {
      claims: [{ kind: "fact", text: passage, evidenceIds: ["office"] }],
    },
  };
  const { deps, calls } = dependencies([output]);
  const dossier = buildCaliforniaDossier(input);
  const authored = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    deps,
  );
  assert.equal(authored.brief.sections[2]!.claims.length, 1);
  assert.ok(
    authored.brief.sections[2]!.missingEvidence!.includes(
      "office powers and institutional limits is incomplete",
    ),
  );
  assert.ok(calls[0]!.prompt.includes(note));
});

test("not_applicable is valid only for judicial-retention Priorities", async () => {
  const { createHash } = await import("node:crypto");
  const input = dossierInput();
  input.officeKind = "judicial_retention";
  input.officeFamily = "judicial_retention";
  const passage = "Morgan Lee served on the court.";
  input.sources[0]!.text += "\n" + passage;
  input.sources[0]!.contentHash = createHash("sha256")
    .update(input.sources[0]!.text)
    .digest("hex");
  input.evidence[1] = {
    ...input.evidence[1]!,
    excerpt: passage,
    origin: "primary_record",
    role: "candidate_record",
  };
  input.gaps.push({
    dimension: "priorities",
    code: "not_applicable",
    message: "Retention, not a legislative platform.",
    checkedSourceIds: [],
    required: false,
  });
  const output = {
    ...emptyAuthorFixture(),
    record: {
      claims: [{ kind: "fact", text: passage, evidenceIds: ["platform"] }],
    },
  };
  const valid = await authorCaliforniaBrief(
    { dossier: buildCaliforniaDossier(input), policyVersion: "p1" },
    dependencies([output]).deps,
  );
  assert.ok(
    valid.brief.sections[0]!.missingEvidence!.includes(
      "continued judicial service",
    ),
  );
  for (const altered of [
    { ...input, officeKind: "judicial_election" as const },
    { ...input, gaps: [{ ...input.gaps[0]!, dimension: "effects" as const }] },
  ])
    await assert.rejects(
      authorCaliforniaBrief(
        { dossier: buildCaliforniaDossier(altered), policyVersion: "p1" },
        dependencies([output]).deps,
      ),
      CaliforniaModelInvocationError,
    );
});

test("compiler coverage is included in final byte attestations with explicit test doubles", async () => {
  const { evidenceDigest, validateBriefAgainstDossier } =
    await import("./california-dossier.js");
  const { candidateBriefSchema } = await import("@acme/validators");
  const dossier = fixtureDossier();
  const { deps } = dependencies([
    authorFixture(),
    {
      verdict: "approve",
      overallReason: "Fixture source support.",
      findings: [
        {
          claimId: "priorities-1",
          supported: true,
          reason: "Fixture supports proposal.",
        },
      ],
    },
  ]);
  const authored = await authorCaliforniaBrief(
    { dossier, policyVersion: "p1" },
    deps,
  );
  const reviewed = await reviewCaliforniaBrief(
    {
      brief: authored.brief,
      dossier,
      policyVersion: "p1",
      authorAttestation: authored.attestation,
    },
    deps,
  );
  candidateBriefSchema.parse(authored.brief);
  validateBriefAgainstDossier(authored.brief, dossier);
  assert.equal(authored.attestation.provider, "fixture");
  assert.equal(
    authored.attestation.revisionDigest,
    evidenceDigest(candidateBriefSchema.parse(authored.brief)),
  );
  assert.equal(
    reviewed.attestation.revisionDigest,
    authored.attestation.revisionDigest,
  );
  const modified = structuredClone(authored.brief);
  modified.sections[3]!.missingEvidence = "Changed compiler coverage.";
  assert.notEqual(
    evidenceDigest(modified),
    authored.attestation.revisionDigest,
  );
  for (const entry of authored.brief.evidence) {
    const selected = dossier.evidence.find((e) => e.id === entry.id)!;
    const source = dossier.sources.find((s) => s.id === selected.sourceId)!;
    assert.equal(entry.excerpt, selected.excerpt);
    assert.equal(entry.url, source.url);
    assert.equal(entry.contentHash, source.contentHash);
    assert.deepEqual(entry.attribution, selected.attribution);
  }
});
