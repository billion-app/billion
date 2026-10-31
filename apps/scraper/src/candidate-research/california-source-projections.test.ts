import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  AuthorityRenewalProjection,
  ResearchSource,
} from "@acme/validators";

import {
  authorityProjectionDigest,
  projectAuthoritySource,
  validateAuthorityRenewalProjection,
} from "./california-source-projections.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const read = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const metadata = JSON.parse(read("authority-projection-sources.json")) as {
  id: string;
  url: string;
  publisher: string;
  format: "text";
  fetchedAt: string;
}[];
export function projectionFixtures(scopeDigest = "a".repeat(64)) {
  return metadata.map((meta) => {
    const prefix = meta.id === "mvla-authority" ? "mvla-authority" : "cde-item";
    const originalText = read(`${prefix}-reviewed.txt`),
      observedText = read(`${prefix}-observed.txt`);
    const original: ResearchSource = {
      ...meta,
      fetchedAt: meta.fetchedAt.replace(/\+00:00$/, "Z"),
      text: originalText,
      contentHash: hash(originalText),
    };
    const observed: ResearchSource = {
      ...original,
      text: observedText,
      contentHash: hash(observedText),
      byteHash: hash(observedText),
      fetchedAt: "2026-10-30T20:15:18.192Z",
    };
    const projectionId =
      meta.id === "mvla-authority"
        ? ("mvla-trustee-authority-seven-asset-versions-v1" as const)
        : ("cde-item-48870daecfe14c6ab376f6a673491914-telemetry-v1" as const);
    const contract: AuthorityRenewalProjection = {
      projectionId,
      url: meta.url,
      publisher: meta.publisher,
      format: "text",
      reviewedContentHash: original.contentHash,
      reviewedRawHash: original.contentHash,
      canonicalDigest: authorityProjectionDigest(projectionId, original.text),
      reviewedSource: original,
      approval: {
        actorId: "test-source-specific-reviewer",
        reviewedAt: "2026-10-30T20:18:50.276421Z",
        receiptHash: "b".repeat(64),
        scopeDigest,
        reviewedSourceBundleHash: "c".repeat(64),
      },
    };
    return { contract, original, observed };
  });
}
test("exact approved projections reproduce independently acknowledged digests", () => {
  const data = projectionFixtures();
  for (const { contract, observed } of data) {
    const { proof } = validateAuthorityRenewalProjection(
      contract,
      observed,
      contract.approval.scopeDigest,
    );
    assert.equal(
      proof.canonicalDigest,
      contract.projectionId.startsWith("cde")
        ? "720348bff7cd6b05bf80f187822ccf406d659566dfa28d548d05f7812489d2fc"
        : "23e6295294ed84717528e916f9ce5f69ddd4ae22f43adfa27d734ccbd80ee2ff",
    );
    assert.equal(proof.observedRawHash, observed.byteHash);
    assert.equal(proof.checkedAt, observed.fetchedAt);
    assert.notEqual(proof.observedContentHash, proof.reviewedContentHash);
  }
});
test("actual CDE unavailable last-viewed time renews the exact approved source without changing retained metadata", () => {
  const { contract, original } = projectionFixtures().find((row) =>
    row.contract.projectionId.startsWith("cde"),
  )!;
  const text = read("cde-item-unavailable-view-time.txt");
  const item = JSON.parse(text) as Record<string, unknown>;
  const reviewed = JSON.parse(original.text) as Record<string, unknown>;
  assert.equal(item.lastViewed, -1);
  assert.equal(item.numViews, 0);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(item).filter(
        ([key]) => !["lastViewed", "numViews"].includes(key),
      ),
    ),
    Object.fromEntries(
      Object.entries(reviewed).filter(
        ([key]) => !["lastViewed", "numViews"].includes(key),
      ),
    ),
  );
  const observed: ResearchSource = {
    ...original,
    text,
    contentHash: hash(text),
    byteHash: hash(text),
    fetchedAt: "2026-10-31T07:26:40.727Z",
  };
  const result = validateAuthorityRenewalProjection(
    contract,
    observed,
    contract.approval.scopeDigest,
  );
  assert.deepEqual(result.contract, contract);
  assert.equal(
    result.proof.canonicalDigest,
    "720348bff7cd6b05bf80f187822ccf406d659566dfa28d548d05f7812489d2fc",
  );
  assert.equal(result.proof.canonicalDigest, contract.canonicalDigest);
  assert.equal(result.proof.observedRawHash, hash(text));
  assert.equal(result.proof.observedContentHash, hash(text));
  assert.equal(result.proof.checkedAt, observed.fetchedAt);
  assert.equal(result.proof.approvalReceiptHash, contract.approval.receiptHash);
  assert.equal(observed.text, text);
  assert.equal(
    (JSON.parse(observed.text) as Record<string, unknown>).lastViewed,
    -1,
  );
  assert.notEqual(result.proof.observedRawHash, result.proof.reviewedRawHash);
});
test("CDE unavailable view time does not admit malformed telemetry or retained source changes", () => {
  const { contract, original } = projectionFixtures().find((row) =>
    row.contract.projectionId.startsWith("cde"),
  )!;
  const item = JSON.parse(read("cde-item-unavailable-view-time.txt")) as Record<
    string,
    unknown
  >;
  for (const value of [-2, 1.5, null, true, "-1"]) {
    assert.throws(() =>
      projectAuthoritySource(
        contract.projectionId,
        JSON.stringify({ ...item, lastViewed: value }),
      ),
    );
  }
  for (const value of [-1, -2, 1.5, null, true, "0"]) {
    assert.throws(() =>
      projectAuthoritySource(
        contract.projectionId,
        JSON.stringify({ ...item, numViews: value }),
      ),
    );
  }
  for (const key of Object.keys(item).filter(
    (key) => !["lastViewed", "numViews"].includes(key),
  )) {
    const text = JSON.stringify({
      ...item,
      [key]: key === "id" ? "wrong-id" : { changed: true },
    });
    assert.throws(() =>
      validateAuthorityRenewalProjection(
        contract,
        {
          ...original,
          text,
          contentHash: hash(text),
          byteHash: hash(text),
        },
        contract.approval.scopeDigest,
      ),
    );
  }
});
test("CDE projection rejects duplicate keys, nonfinite values and malformed excluded counters", () => {
  const { contract, original } = projectionFixtures().find((row) =>
    row.contract.projectionId.startsWith("cde"),
  )!;
  const id = contract.projectionId;
  for (const text of [
    original.text.replace("{", '{"id":"48870daecfe14c6ab376f6a673491914",'),
    original.text.replace("{", '{"lastViewed":0,'),
    original.text.replace(
      "{",
      '{"\\u0069d":"48870daecfe14c6ab376f6a673491914",',
    ),
    original.text.replace("{", '{"nonfinite":1e309,'),
  ])
    assert.throws(() => projectAuthoritySource(id, text));
  const parsed = JSON.parse(original.text);
  for (const value of [-1, 1.5, null, true, "10"]) {
    assert.throws(() =>
      projectAuthoritySource(
        id,
        JSON.stringify({ ...parsed, numViews: value }),
      ),
    );
  }
  assert.throws(
    () =>
      projectAuthoritySource(id, JSON.stringify({ ...parsed, numViews: "10" })),
    /CDE telemetry numViews is not a nonnegative integer/,
  );
  const missing = { ...parsed };
  delete missing.lastViewed;
  assert.throws(
    () => projectAuthoritySource(id, JSON.stringify(missing)),
    /CDE telemetry lastViewed is not a nonnegative integer/,
  );
});
test("every retained CDE field remains binding, including nested names matching ignored counters", () => {
  const { contract, original, observed } = projectionFixtures().find((row) =>
    row.contract.projectionId.startsWith("cde"),
  )!;
  const item = JSON.parse(original.text);
  for (const key of Object.keys(item).filter(
    (key) => !["lastViewed", "numViews"].includes(key),
  )) {
    const changed = JSON.stringify({
      ...item,
      [key]: key === "id" ? "wrong-id" : { changed: true },
    });
    if (key === "id")
      assert.throws(() =>
        projectAuthoritySource(contract.projectionId, changed),
      );
    else
      assert.notEqual(
        authorityProjectionDigest(contract.projectionId, changed),
        contract.canonicalDigest,
      );
  }
  assert.notEqual(
    authorityProjectionDigest(
      contract.projectionId,
      JSON.stringify({ ...item, extra: { lastViewed: 1, numViews: 2 } }),
    ),
    contract.canonicalDigest,
  );
  assert.equal(
    authorityProjectionDigest(contract.projectionId, observed.text),
    contract.canonicalDigest,
  );
});
test("MVLA preserves every character except seven synchronized valid cache timestamps", () => {
  const { contract, original } = projectionFixtures().find((row) =>
    row.contract.projectionId.startsWith("mvla"),
  )!;
  const id = contract.projectionId;
  for (const text of [
    original.text.replace("/js/general.js", "/js/generalXjs"),
    original.text.replace("/js/general.js", "/js/other.js"),
    original.text.replace("20261030182853", "20260230000000"),
    original.text.replace("20261030182853", "20261030182854"),
    original.text.replace('<script src="/js/general.js?v=20261030182853">', ""),
    original.text + '<script src="/js/general.js?v=20261030182853">',
  ])
    assert.throws(() => projectAuthoritySource(id, text));
  for (const text of [
    original.text + " ",
    original.text.replace(
      "trustee_boundary_map_c1.pdf",
      "different_boundary_map.pdf",
    ),
    original.text.replace("Trustee", "AlteredTrustee"),
  ])
    assert.notEqual(
      authorityProjectionDigest(id, text),
      contract.canonicalDigest,
    );
  assert.equal(
    authorityProjectionDigest(
      id,
      original.text.replaceAll("20261030182853", "20261031235959"),
    ),
    contract.canonicalDigest,
  );
});
test("a projection cannot authorize changed URL, publisher, format, review basis or missing raw observation", () => {
  for (const { contract, observed } of projectionFixtures()) {
    for (const changed of [
      { ...observed, url: "https://example.gov/wrong" },
      { ...observed, publisher: "Someone else" },
      { ...observed, format: "html" as const },
      { ...observed, byteHash: undefined },
    ])
      assert.throws(() =>
        validateAuthorityRenewalProjection(
          contract,
          changed,
          contract.approval.scopeDigest,
        ),
      );
    assert.throws(() =>
      validateAuthorityRenewalProjection(
        { ...contract, approval: undefined },
        observed,
        contract.approval.scopeDigest,
      ),
    );
    assert.throws(() =>
      validateAuthorityRenewalProjection(contract, observed, "f".repeat(64)),
    );
  }
});
