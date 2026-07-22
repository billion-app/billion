import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  adaptDurhamItem,
  adaptDurhamMeeting,
  adaptDurhamVote,
  currentElectionCycleStart,
  parseDurhamStart,
} from "./durham-bocc.js";

async function fixture(name: string): Promise<unknown> {
  const url = new URL(`./fixtures/durham-bocc/${name}.json`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8")) as unknown;
}

void test("maps regular, work, cancelled, and amended meetings", async () => {
  const events = (await fixture("events")) as unknown[];
  const [regular, work, cancelled, amended] = events.map(adaptDurhamMeeting);

  assert.equal(regular?.meetingType, "Regular Session");
  assert.equal(regular?.isCancelled, false);
  assert.match(regular?.videoUrl ?? "", /ID1=1539/);
  assert.equal(work?.meetingType, "Work Session");
  assert.equal(cancelled?.isCancelled, true);
  assert.equal(cancelled?.status, "cancelled");
  assert.equal(amended?.isAmended, true);
  assert.equal(amended?.documents[0]?.title, "Amended Agenda");
});

void test("maps actions, consent status, official attachments, and named votes", async () => {
  const [rawItem] = (await fixture("items")) as unknown[];
  const [rawVote] = (await fixture("votes")) as unknown[];
  const item = adaptDurhamItem(rawItem);
  const vote = adaptDurhamVote(rawVote);

  assert.equal(item.isConsent, true);
  assert.equal(item.action, "Approved");
  assert.equal(item.outcome, "Passed");
  assert.equal(item.tally, "5-0");
  assert.equal(item.documents.length, 2);
  assert.equal(item.documents[1]?.language, "es");
  assert.equal(vote.personName, "Commissioner A");
  assert.equal(vote.value, "Aye");
});

void test("uses stable source ids and changes checksum when an amendment changes", async () => {
  const [raw] = (await fixture("events")) as Record<string, unknown>[];
  const original = adaptDurhamMeeting(raw);
  const replaced = adaptDurhamMeeting({
    ...raw,
    EventRowVersion: "replacement-v2",
    EventLastModifiedUtc: "2026-01-13T00:00:00.000",
  });

  assert.equal(original.sourceId, replaced.sourceId);
  assert.notEqual(original.contentHash, replaced.contentHash);
});

void test("parses Durham local time with DST and bounds to the current cycle", () => {
  assert.equal(
    parseDurhamStart("2026-01-12T00:00:00", "6:00 PM").toISOString(),
    "2026-01-12T23:00:00.000Z",
  );
  assert.equal(
    parseDurhamStart("2026-07-13T00:00:00", "5:00 PM").toISOString(),
    "2026-07-13T21:00:00.000Z",
  );
  assert.equal(
    currentElectionCycleStart(new Date("2026-07-21T00:00:00Z")).toISOString(),
    "2025-01-01T00:00:00.000Z",
  );
});
