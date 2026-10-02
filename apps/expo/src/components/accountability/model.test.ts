import assert from "node:assert/strict";
import { test } from "node:test";

import { historical, synthetic } from "./examples";
import { actionsFor, resolveOfficeholder } from "./model";

const historicalEntry = historical.entry;
const syntheticEntry = synthetic.entry;
const syntheticAction = synthetic.actions[0];
const historicalCandidate = historical.candidates[0];
assert.ok(historicalEntry);
assert.ok(syntheticEntry);
assert.ok(syntheticAction);
assert.ok(historicalCandidate);
const resolve = (example = historical) =>
  resolveOfficeholder(
    example.identity,
    example.candidates,
    example.result,
    example.entry,
  );
test("certification and separate inauguration identify the historical term", () => {
  assert.equal(resolve()?.name, "Gavin Newsom");
  assert.equal(resolve()?.tookOffice, "2023-01-06");
});
test("missing, projected, preliminary, disputed and absent term records cannot identify an officeholder", () => {
  for (const stage of ["missing", "projected", "preliminary"] as const)
    assert.equal(
      resolve({ ...historical, result: { ...historical.result, stage } }),
      undefined,
    );
  assert.equal(
    resolve({
      ...historical,
      result: { ...historical.result, disputed: true },
    }),
    undefined,
  );
  assert.equal(resolve({ ...historical, entry: undefined }), undefined);
  assert.equal(resolve({ ...historical, candidates: [] }), undefined);
  assert.equal(
    resolve({
      ...historical,
      result: { ...historical.result, evidence: undefined },
    }),
    undefined,
  );
});
test("each identity dimension and candidate ID must match; names do not substitute", () => {
  for (const key of [
    "electionId",
    "districtId",
    "officeId",
    "contestId",
  ] as const) {
    assert.equal(
      resolve({
        ...historical,
        result: {
          ...historical.result,
          identity: { ...historical.identity, [key]: "other" },
        },
      }),
      undefined,
    );
    assert.equal(
      resolve({
        ...historical,
        entry: {
          ...historicalEntry,
          identity: { ...historical.identity, [key]: "other" },
        },
      }),
      undefined,
    );
  }
  assert.equal(
    resolve({
      ...historical,
      result: { ...historical.result, candidateId: "other" },
    }),
    undefined,
  );
});
test("actions are term, office, district and person scoped, with missing records empty", () => {
  const entry = syntheticEntry;
  const action = syntheticAction;
  assert.equal(actionsFor(entry, synthetic.actions).length, 1);
  assert.deepEqual(actionsFor(entry, []), []);
  for (const changed of [
    { personId: "other" },
    { officeId: "other" },
    { districtId: "other" },
    { date: "2026-01-01" },
  ])
    assert.deepEqual(actionsFor(entry, [{ ...action, ...changed }]), []);
});
test("duplicate candidate IDs and invalid term dates fail closed", () => {
  assert.equal(
    resolve({
      ...historical,
      candidates: [...historical.candidates, historicalCandidate],
    }),
    undefined,
  );
  assert.equal(
    resolve({
      ...historical,
      entry: { ...historicalEntry, tookOffice: "2023-02-30" },
    }),
    undefined,
  );
  assert.equal(
    resolve({
      ...historical,
      entry: { ...historicalEntry, leftOffice: "2022-01-01" },
    }),
    undefined,
  );
});
test("invalid and out-of-term action dates are withheld", () => {
  const entry = { ...syntheticEntry, leftOffice: "2028-01-01" };
  const action = syntheticAction;
  for (const date of ["2027-02-30", "2028-01-01", "2029-01-01", "unknown"])
    assert.deepEqual(actionsFor(entry, [{ ...action, date }]), []);
});
