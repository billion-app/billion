import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  parseAgendaOutline,
  parseItemAttachments,
  parseMeetingIndex,
} from "./durham-onbase-parser.js";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("Durham OnBase deterministic parsers", () => {
  it("parses the embedded meeting index JSON and preserves timezone", async () => {
    const meetings = parseMeetingIndex(
      await fixture("durham-onbase-index.html"),
    );
    assert.equal(meetings.length, 2);
    assert.deepEqual(
      {
        id: meetings[0]?.id,
        type: meetings[0]?.meetingType,
        iso: meetings[0]?.date.toISOString(),
        latestDocumentType: meetings[1]?.latestDocumentType,
      },
      {
        id: 748,
        type: "City Council Meeting Agenda",
        iso: "2026-05-18T23:00:00.000Z",
        latestDocumentType: 2,
      },
    );
  });

  it("parses sections, items, action text, and vote text", async () => {
    const items = parseAgendaOutline(
      await fixture("durham-onbase-agenda.html"),
    );
    assert.equal(items.length, 2);
    assert.deepEqual(
      {
        externalId: items[0]?.externalId,
        section: items[0]?.section,
        number: items[0]?.agendaNumber,
        title: items[0]?.title,
        vote: items[0]?.voteText,
      },
      {
        externalId: "47768",
        section: "Consent Agenda",
        number: "1",
        title: "Approval of City Council Minutes",
        vote: "[Approved by Vote: 7/0]",
      },
    );
    assert.match(items[1]?.voteText ?? "", /FAILED by Vote: 0\/7/i);
    assert.match(items[1]?.voteText ?? "", /No vote taken/i);
  });

  it("parses stable attachment IDs and absolute official URLs", async () => {
    const attachments = parseItemAttachments(
      await fixture("durham-onbase-item.html"),
    );
    assert.equal(attachments.length, 2);
    assert.equal(attachments[0]?.externalId, "272813");
    assert.equal(
      new URL(attachments[0]!.url).hostname,
      "cityordinances.durhamnc.gov",
    );
    assert.equal(attachments[1]?.title, "March 16 City Council Minutes");
  });
});
