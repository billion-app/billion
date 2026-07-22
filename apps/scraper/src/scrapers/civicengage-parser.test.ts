import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseAgendaItems,
  parseCentralMeetingDate,
  parseMunicodePublishPage,
} from "./civicengage-parser.js";
import { cedarParkCouncilSource } from "./civicengage.config.js";

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/civicengage/${name}`, import.meta.url), "utf8");

test("parses regular, special, cancelled, and amended meeting records", async () => {
  const meetings = parseMunicodePublishPage(
    await fixture("meetings.html"),
    cedarParkCouncilSource,
    { now: new Date("2026-03-01T00:00:00Z") },
  );
  assert.equal(meetings.length, 4);
  assert.deepEqual(
    meetings.map(({ title, meetingType, status }) => ({
      title,
      meetingType,
      status,
    })),
    [
      {
        title: "City Council Mtg. - CANCELLED",
        meetingType: "regular",
        status: "cancelled",
      },
      {
        title: "City Council - Special Called",
        meetingType: "special",
        status: "held",
      },
      {
        title: "City Council Mtg.",
        meetingType: "regular",
        status: "completed",
      },
      {
        title: "City Council Mtg. - Amended",
        meetingType: "regular",
        status: "amended",
      },
    ],
  );
  assert.match(meetings[2]?.externalId ?? "", /^[a-f0-9]{32}$/);
  assert.equal(
    meetings[2]?.documents[0]?.url,
    "https://mccmeetings.blob.core.usgovcloudapi.net/cptx-pubu/MEET-Agenda-2c1128fc619f48d6bf29cb94897a2d7f.pdf",
  );
  assert.equal(
    meetings[2]?.canonicalUrl,
    "https://www.cedarparktexas.gov/596/City-Council-Agendas",
  );
  assert.deepEqual(
    meetings[3]?.documents.map(({ isCurrent }) => isCurrent),
    [true, false],
  );
});

test("applies a twelve-month cutoff and parses Central daylight time", async () => {
  const meetings = parseMunicodePublishPage(
    await fixture("meetings.html"),
    cedarParkCouncilSource,
    {
      now: new Date("2026-07-21T12:00:00Z"),
      cutoff: new Date("2025-07-21T12:00:00Z"),
    },
  );
  assert.equal(meetings.length, 3);
  assert.equal(
    parseCentralMeetingDate("2/12/2026", "6:00 PM").toISOString(),
    "2026-02-13T00:00:00.000Z",
  );
  assert.equal(
    parseCentralMeetingDate("7/9/2026", "7:00 PM").toISOString(),
    "2026-07-10T00:00:00.000Z",
  );
});

test("deterministically parses items, motions, outcomes, tallies, and roll calls", async () => {
  const agenda = await fixture("agenda.txt");
  const minutes = await fixture("minutes.txt");
  const sourceUrl = "https://official.example/agenda.pdf";
  const first = parseAgendaItems(agenda, minutes, sourceUrl);
  const second = parseAgendaItems(agenda, minutes, sourceUrl);
  assert.deepEqual(first, second);
  assert.equal(first.length, 6);

  const ordinance = first.find((item) => item.itemNumber === "E.1");
  assert.equal(ordinance?.itemType, "ordinance");
  assert.equal(ordinance?.consent, true);
  assert.equal(ordinance?.outcome, "approved");

  const resolution = first.find((item) => item.itemNumber === "F.1");
  assert.equal(
    resolution?.motion,
    "Motion to approve Agenda Item F.1 as presented.",
  );
  assert.match(resolution?.voteSummary ?? "", /^6-0/);
  assert.equal(resolution?.outcome, "approved");

  const rollCall = first.find((item) => item.itemNumber === "H.1");
  assert.equal(rollCall?.votes.length, 6);
  assert.deepEqual(rollCall?.votes.at(-1), { voterName: "Darby", value: "no" });
  assert.equal(rollCall?.sourceUrl, sourceUrl);

  const noAction = first.find((item) => item.itemNumber === "H.2");
  assert.equal(noAction?.outcome, "no_action");
});
