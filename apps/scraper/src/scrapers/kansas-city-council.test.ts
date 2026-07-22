import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  adaptKansasCityItem,
  adaptKansasCityMeeting,
  adaptKansasCityVote,
  currentKansasCityCouncilCycleStart,
  isDiscoverableKansasCityEvent,
  parseKansasCityStart,
} from "./kansas-city-council.js";

async function fixture(name: string): Promise<unknown> {
  const url = new URL(
    `./fixtures/kansas-city-council/${name}.json`,
    import.meta.url,
  );
  return JSON.parse(await readFile(url, "utf8")) as unknown;
}

void test("maps regular, special, cancelled, and revised Council meetings", async () => {
  const events = (await fixture("events")) as unknown[];
  const [regular, special, cancelled, revised] = events.map(
    adaptKansasCityMeeting,
  );

  assert.equal(regular?.meetingType, "Regular Meeting");
  assert.match(regular?.videoUrl ?? "", /ID1=14001/);
  assert.equal(special?.meetingType, "Special Meeting");
  assert.equal(special?.location, "KCPD Headquarters - Community Room");
  assert.equal(cancelled?.isCancelled, true);
  assert.equal(cancelled?.status, "cancelled");
  assert.equal(revised?.isAmended, true);
  assert.equal(revised?.documents[0]?.title, "Revised Agenda");
  assert.equal(revised?.documents[1]?.title, "Revised Minutes");
});

void test("maps legislation references, actions, packets, and named votes", async () => {
  const [rawItem, rawRollCall] = (await fixture("items")) as unknown[];
  const [rawNay, rawAye] = (await fixture("votes")) as unknown[];
  const item = adaptKansasCityItem(rawItem);
  const rollCall = adaptKansasCityItem(rawRollCall);
  const nay = adaptKansasCityVote(rawNay);
  const aye = adaptKansasCityVote(rawAye);

  assert.equal(item.itemNumber, "260582");
  assert.equal(item.itemType, "Ordinance");
  assert.equal(item.action, "Passed as Substituted");
  assert.equal(item.outcome, "Pass");
  assert.equal(item.shouldFetchVotes, true);
  assert.equal(item.documents[0]?.type, "packet");
  assert.equal(item.documents[1]?.type, "attachment");
  assert.equal(rollCall.section, "ROLL CALL");
  assert.equal(rollCall.shouldFetchVotes, true);
  assert.deepEqual(
    [nay.voterName, nay.value, aye.voterName, aye.value],
    ["Quinton Lucas", "Nay", "Kevin O'Neill", "Aye"],
  );
});

void test("keeps stable IDs while revisions and document replacements change hashes", async () => {
  const [raw] = (await fixture("events")) as Record<string, unknown>[];
  const original = adaptKansasCityMeeting(raw);
  const replacement = adaptKansasCityMeeting({
    ...raw,
    EventAgendaFile:
      "https://kansascity.legistar1.com/meetings/19001-agenda-v2.pdf",
    EventAgendaLastPublishedUTC: "2026-01-08T19:00:00.000",
    EventLastModifiedUtc: "2026-01-08T19:01:00.000",
    EventRowVersion: "kc-event-v2",
  });

  assert.equal(original.externalId, replacement.externalId);
  assert.notEqual(original.sourceVersion, replacement.sourceVersion);
  assert.notEqual(original.contentHash, replacement.contentHash);
  assert.notEqual(
    original.documents[0]?.checksum,
    replacement.documents[0]?.checksum,
  );
});

void test("uses Central Time DST and the active four-year Council term", () => {
  assert.equal(
    parseKansasCityStart("2026-01-08T00:00:00", "2:00 PM").toISOString(),
    "2026-01-08T20:00:00.000Z",
  );
  assert.equal(
    parseKansasCityStart("2026-07-02T00:00:00", "2:00 PM").toISOString(),
    "2026-07-02T19:00:00.000Z",
  );
  assert.equal(
    currentKansasCityCouncilCycleStart(
      new Date("2026-07-22T00:00:00Z"),
    ).toISOString(),
    "2023-08-01T00:00:00.000Z",
  );
});

void test("excludes hidden test meetings from primary-body discovery", async () => {
  const [raw] = (await fixture("events")) as Record<string, unknown>[];
  assert.equal(isDiscoverableKansasCityEvent(raw), true);
  assert.equal(
    isDiscoverableKansasCityEvent({
      ...raw,
      EventId: 99999,
      EventAgendaStatusName: "Hidden",
      EventComment: "Test Meeting",
    }),
    false,
  );
});
