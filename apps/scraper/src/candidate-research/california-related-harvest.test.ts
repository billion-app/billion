import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authorityRenewalProjectionSchema,
  researchSourceSchema,
} from "@acme/validators";

import {
  authorityProjectionDigest,
  projectAuthoritySource,
  validateAuthorityRenewalProjection,
} from "./california-source-projections.js";

const read = (name: string) =>
  readFileSync(
    new URL(`./fixtures/cde-related-harvest-${name}`, import.meta.url),
    "utf8",
  );
const metadata = JSON.parse(read("contract.json")) as Record<string, unknown>;
const original = researchSourceSchema.parse({
  ...(metadata.reviewedSource as object),
  text: read("reviewed.txt"),
});
const observed = researchSourceSchema.parse({
  ...(metadata.observedSource as object),
  text: read("observed.txt"),
});
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const projectionId =
  "cde-data-ca-gov-school-district-areas-2025-26-related-harvest-v1";
const expectedDigest =
  "07910e6fe6e94dd625e793e9ed08a91108f323283a1d06f9c8170ab806ddca44";
const reviewedValues = [
  "a933ca8a-3da7-4e02-8020-fcba22fd2260",
  "02b2bf0f-b210-43c4-8d71-2c0a10852191",
  "14b405ad-2021-441d-ba98-f4715df2b307",
];
const observedValues = [
  "74d82284-ca3c-443c-8630-3d225c34a9cf",
  "a55d340b-2b7d-4cfa-b7bf-464576508cf1",
  "ce9c1fdc-10c0-40fd-bdf2-16d705f082db",
];

test("actual source pair preserves every byte outside three independently approved UUID spans", () => {
  const contract = authorityRenewalProjectionSchema.parse({
    ...metadata,
    reviewedSource: original,
  });
  const projected = projectAuthoritySource(projectionId, original.text);
  const expected = reviewedValues.reduce(
    (text, value, index) =>
      text.replace(value, `__RELATED_HARVEST_OBJECT_ID_${index}__`),
    original.text,
  );
  assert.equal(projected, expected);
  assert.equal(projectAuthoritySource(projectionId, observed.text), expected);
  assert.equal(hash(projected), expectedDigest);
  assert.equal(
    hash(original.text),
    "2c63bb63cba2ae9112fe5f94df3af7720262d8f46d58197344207a19575b60b5",
  );
  assert.equal(
    hash(observed.text),
    "ea2a1c2f39594c0a918975343f151403f26a1af021906c6d742925fb3d241fff",
  );
  const result = validateAuthorityRenewalProjection(
    contract,
    observed,
    contract.approval.scopeDigest,
  );
  assert.equal(result.proof.canonicalDigest, expectedDigest);
  assert.equal(
    result.proof.approvalReceiptHash,
    "199b4e2d264df6f862d087f403e6a66f79f1572f01e7c68c1c843bb28421a39f",
  );
  assert.equal(result.proof.observedRawHash, observed.byteHash);
  assert.equal(result.proof.checkedAt, observed.fetchedAt);
});

test("source identities, JSON grammar and exact raw UUID spans reject malformed alternatives", () => {
  const invalid = [
    observed.text.replace(
      "9a9f7021-d72d-4bdf-8828-1014fc494561",
      "9a9f7021-d72d-4bdf-8828-1014fc494562",
    ),
    observed.text.replace(
      "6ad5b9d2-58e3-4181-bfb5-851ab41b7fe3",
      "1c6303ae-ec57-44d2-8268-f114f6c7d084",
    ),
    observed.text +
      '<script id="__NEXT_DATA__" type="application/json">{}</script>',
    observed.text.replace('id="__NEXT_DATA__"', 'id="OTHER_DATA"'),
    observed.text +
      "<script id='__NEXT_DATA__' type='application/json'>{}</script>",
    observed.text +
      "<script id=__NEXT_DATA__ type=application/json>{}</script>",
    observed.text.replace('"key":"harvest_object_id"', '"key":"other_id"'),
    observed.text.replace('{"props":', '{"props":null,"props":'),
    observed.text.replace('{"props":', '{"\\u0070rops":null,"props":'),
    observed.text.replace('{"props":', '{"infinite":1e999,"props":'),
    ...["5", "A"].map((version) =>
      observed.text.replace(
        "74d82284-ca3c-443c-8630-3d225c34a9cf",
        `74d82284-ca3c-${version}43c-8630-3d225c34a9cf`,
      ),
    ),
    observed.text.replace(
      "74d82284-ca3c-443c-8630-3d225c34a9cf",
      "74d82284-ca3c-443c-7630-3d225c34a9cf",
    ),
    observed.text.replace(
      "74d82284-ca3c-443c-8630-3d225c34a9cf",
      "74D82284-ca3c-443c-8630-3d225c34a9cf",
    ),
    observed.text.replace(
      "74d82284-ca3c-443c-8630-3d225c34a9cf",
      "\\u00374d82284-ca3c-443c-8630-3d225c34a9cf",
    ),
    observed.text + observedValues[0],
    observed.text + "__RELATED_HARVEST_OBJECT_ID_0__",
    observed.text.replace(
      '{"props":',
      '{"depth":' + "[".repeat(101) + "0" + "]".repeat(101) + ',"props":',
    ),
    "x".repeat(5_000_001),
  ];
  for (const text of invalid)
    assert.throws(() => projectAuthoritySource(projectionId, text));
});

test("other provenance facts, metadata, formatting and all surrounding HTML remain binding", () => {
  const contract = authorityRenewalProjectionSchema.parse({
    ...metadata,
    reviewedSource: original,
  });
  for (const text of [
    observed.text + " ",
    observed.text.replace(
      "California Public Schools 2025-26",
      "California Public Schools 2026-27",
    ),
    observed.text.replace(
      "2a07eb34-c712-4b9b-83a0-f68a10de2d8f",
      "2a07eb34-c712-4b9b-83a0-f68a10de2d80",
    ),
    observed.text.replace('{"props":', '{ "props":'),
    observed.text.replace("<head>", "<head> "),
    observed.text.replace(
      "california-school-district-areas-2025-26",
      "california-school-district-areas-2026-27",
    ),
  ]) {
    const changed = {
      ...observed,
      text,
      contentHash: hash(text),
      byteHash: hash(text),
    };
    assert.throws(() =>
      validateAuthorityRenewalProjection(
        contract,
        changed,
        contract.approval.scopeDigest,
      ),
    );
  }
});

test("new contract retains all existing source metadata, review basis and raw observation gates", () => {
  const contract = authorityRenewalProjectionSchema.parse({
    ...metadata,
    reviewedSource: original,
  });
  for (const changed of [
    { ...observed, url: "https://example.gov/other" },
    { ...observed, publisher: "Someone else" },
    { ...observed, format: "html" as const },
    { ...observed, byteHash: undefined },
    { ...observed, contentHash: "a".repeat(64) },
  ])
    assert.throws(() =>
      validateAuthorityRenewalProjection(
        contract,
        changed,
        contract.approval.scopeDigest,
      ),
    );
  assert.throws(() =>
    validateAuthorityRenewalProjection(contract, observed, "b".repeat(64)),
  );
  assert.throws(() =>
    validateAuthorityRenewalProjection(
      { ...contract, reviewedRawHash: "c".repeat(64) },
      observed,
      contract.approval.scopeDigest,
    ),
  );
  assert.equal(
    authorityProjectionDigest(projectionId, observed.text),
    expectedDigest,
  );
});
