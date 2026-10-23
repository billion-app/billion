import assert from "node:assert/strict";
import test from "node:test";

import type { ContentItem } from "./content";
import type { DecisionRow } from "./local-government";
import { hydrateSavedRows } from "./saved-content";

const bill: ContentItem = {
  id: "bill",
  type: "bill",
  title: "Bill",
  description: "Description",
};
const decision: DecisionRow = {
  id: "local",
  jurisdiction: "City of Santa Clara",
  jurisdictionKey: "santaclara",
  fileNumber: "26-1005",
  title: "Street improvements",
  type: "Report",
  status: "Agenda Ready",
  topic: "transportation",
  scope: "citywide",
  districtNumbers: null,
  geographicText: null,
  sourceUrl: "https://santaclara.legistar.com",
  meetingItemId: "item",
  sourceEventItemId: 1,
  agendaNumber: "4",
  proposedAction: null,
  outcome: null,
  passed: null,
  tally: null,
  meetingId: "meeting",
  sourceEventId: 2,
  meetingStartsAt: new Date(),
  meetingCancelled: false,
  body: "City Council",
  bodyRelevanceTier: 1,
};

void test("saved records retain cross-type save order and removable missing rows", () => {
  const rows = hydrateSavedRows(
    ["local", "missing", "bill"],
    [bill],
    [decision],
  );
  assert.deepEqual(
    rows.map(({ kind, id }) => [kind, id]),
    [
      ["local", "local"],
      ["unavailable", "missing"],
      ["content", "bill"],
    ],
  );
});
void test("one failed source does not erase rows from the other source or saved IDs", () => {
  assert.deepEqual(
    hydrateSavedRows(["bill", "local"], [], [decision]).map(({ kind }) => kind),
    ["unavailable", "local"],
  );
  assert.deepEqual(
    hydrateSavedRows(["bill", "local"], [bill], []).map(({ kind }) => kind),
    ["content", "unavailable"],
  );
});
