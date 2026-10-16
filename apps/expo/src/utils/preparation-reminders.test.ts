import assert from "node:assert/strict";
import { test } from "node:test";

import { createPreparationReminders } from "./preparation-reminders";

const now = new Date("2026-10-02T12:00:00Z");
const deadline = {
  electionKey: "e1",
  id: "receipt",
  revision: "v1",
  verified: true as const,
  applicable: true as const,
  sourceUrl: "https://elections.example.gov",
  at: "2026-10-04T12:00:00Z",
  validUntil: "2026-10-05T12:00:00Z",
};
test("opt-out, stale deadline and election change cancel without requesting permission", async () => {
  await Promise.resolve();
  let cancelled = 0;
  const reconcile = createPreparationReminders({
    cancel: async () => {
      await Promise.resolve();
      cancelled++;
    },
    permission: async () => {
      await Promise.resolve();
      throw Error("must not request");
    },
    schedule: async () => {
      await Promise.resolve();
      throw Error("must not schedule");
    },
  });
  for (const input of [
    { optedIn: false, deadline },
    { optedIn: true, deadline: { ...deadline, validUntil: now.toISOString() } },
    { optedIn: true, deadline: { ...deadline, electionKey: "e2" } },
    { optedIn: true, deadline: undefined },
  ]) {
    assert.equal(
      (await reconcile({ ...input, electionKey: "e1", previousId: "old", now }))
        .status,
      "off",
    );
  }
  assert.equal(cancelled, 4);
});
test("denial schedules nothing, revision replacement cancels before scheduling", async () => {
  await Promise.resolve();
  const calls: string[] = [];
  let granted = false;
  const reconcile = createPreparationReminders({
    cancel: async () => {
      await Promise.resolve();
      calls.push("cancel");
    },
    permission: async () => {
      await Promise.resolve();
      return granted;
    },
    schedule: async () => {
      await Promise.resolve();
      calls.push("schedule");
    },
  });
  assert.equal(
    (await reconcile({ optedIn: true, electionKey: "e1", deadline, now }))
      .status,
    "denied",
  );
  assert.deepEqual(calls, []);
  granted = true;
  const first = await reconcile({
    optedIn: true,
    electionKey: "e1",
    deadline,
    now,
  });
  const next = await reconcile({
    optedIn: true,
    electionKey: "e1",
    deadline: { ...deadline, revision: "v2" },
    previousId: first.id,
    now,
  });
  assert.notEqual(first.id, next.id);
  assert.deepEqual(calls, ["schedule", "cancel", "schedule"]);
});
