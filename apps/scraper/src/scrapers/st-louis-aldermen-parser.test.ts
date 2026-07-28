import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  adaptStLouisCivicItems,
  civicMeetingDocuments,
  parseActiveAgendaSession,
  parseActiveCalendarSession,
  parseStLouisAgendaDetail,
  parseStLouisAgendaIndex,
  parseStLouisCalendar,
  parseStLouisEventDetail,
  parseStLouisLegislationDetail,
} from "./disabled/st-louis-aldermen-parser.js";

const fixture = (name: string) =>
  readFile(
    new URL(`./fixtures/st-louis-aldermen/${name}`, import.meta.url),
    "utf8",
  );

void test("discovers only the selected active session metadata", async () => {
  const agenda = await fixture("agenda-index.html");
  const calendar = await fixture("calendar.html");
  assert.deepEqual(parseActiveAgendaSession(agenda), {
    id: "202",
    label: "2026-2027",
  });
  assert.deepEqual(parseActiveCalendarSession(calendar), {
    id: "202",
    label: "2026-2027",
  });
  assert.equal(parseStLouisAgendaIndex(agenda).length, 2);
});

void test("maps current-session full-board and committee meeting identities", async () => {
  const meetings = parseStLouisCalendar(await fixture("calendar.html"));
  assert.equal(meetings[0]?.eventId, "53891");
  assert.equal(meetings[0]?.civicClerkId, "2408");
  assert.equal(meetings[0]?.startsAt.toISOString(), "2026-07-20T15:00:00.000Z");
  assert.equal(meetings[1]?.civicClerkId, "2409");
});

void test("preserves agendaViewID, session, revised documents, bill IDs, and sponsors", async () => {
  const [week] = parseStLouisAgendaIndex(await fixture("agenda-index.html"));
  assert.ok(week);
  const detail = parseStLouisAgendaDetail(
    await fixture("agenda-detail.html"),
    week,
  );
  assert.equal(detail.agendaViewId, "12765");
  assert.equal(detail.sessionId, "202");
  assert.equal(detail.eventId, "53891");
  assert.equal(detail.documents.length, 2);
  assert.equal(detail.legislation[0]?.externalId, "17901");
  assert.deepEqual(detail.legislation[0]?.sponsors, ["Shameem Clark Hubbard"]);
});

void test("links CivicClerk agenda items to official legislative metadata", async () => {
  const civic = JSON.parse(await fixture("civic-meetings.json")) as unknown[];
  const event = parseStLouisEventDetail(
    await fixture("event-detail.html"),
    "53958",
  );
  const bill = parseStLouisLegislationDetail(
    await fixture("board-bill.html"),
    event.legislation[0]!,
  );
  const items = adaptStLouisCivicItems(
    civic[0],
    event.legislation[0]!.sourceUrl,
    [bill],
  );
  assert.equal(event.meetingType, "Aldermanic Committee Meeting");
  assert.equal(event.civicClerkId, "2409");
  assert.match(event.videoUrl ?? "", /youtube\.com/);
  assert.equal(items[1]?.legislativeId, "board-bill:17901");
  assert.equal(items[1]?.title, "Youthbuild Award");
  assert.deepEqual(items[1]?.sponsors, ["Shameem Clark Hubbard"]);
  assert.equal(items[1]?.action, "Committee Assignment");
  assert.equal(items[1]?.documents[0]?.externalId, "civicclerk:3724");
});

void test("uses stable file IDs while allowing signed URLs and revisions to change", async () => {
  const [meeting] = JSON.parse(await fixture("civic-meetings.json")) as Record<
    string,
    unknown
  >[];
  assert.ok(meeting);
  const original = civicMeetingDocuments(meeting);
  const rotated = civicMeetingDocuments({
    ...meeting,
    files: (meeting.files as Record<string, unknown>[]).map((file) => ({
      ...file,
      url: `${String(file.url).split("?")[0]}?sig=rotated`,
    })),
  });
  const revised = civicMeetingDocuments({
    ...meeting,
    files: (meeting.files as Record<string, unknown>[]).map((file, index) => ({
      ...file,
      fileId: Number(file.fileId) + 100 + index,
      publishedOn: "2026-07-21T09:00:00.000",
    })),
  });
  assert.equal(original[0]?.externalId, rotated[0]?.externalId);
  assert.equal(original[0]?.checksum, rotated[0]?.checksum);
  assert.notEqual(original[0]?.externalId, revised[0]?.externalId);
  assert.notEqual(original[0]?.checksum, revised[0]?.checksum);
});
