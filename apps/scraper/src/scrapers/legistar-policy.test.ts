import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  LegistarAgendaItem,
  LegistarAttachment,
  LegistarMatter,
} from "@acme/api/integrations/legistar";

import {
  bodyPolicy,
  classifyDocument,
  classifyTopic,
  inferGeographicScope,
} from "./legistar-policy.js";
import {
  nativeTextQuality,
  needsOcr,
  parseLegistarMeetingStart,
} from "./legistar.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/legistar/san-jose-sample.json", import.meta.url),
    "utf8",
  ),
) as {
  item: LegistarAgendaItem;
  matter: LegistarMatter;
  staffDocument: LegistarAttachment;
  publicCommentDocument: LegistarAttachment;
};

test("curates resident-facing bodies and excludes closed-session buckets", () => {
  assert.deepEqual(bodyPolicy(138), { included: true, relevanceTier: 1 });
  assert.deepEqual(bodyPolicy(212), { included: true, relevanceTier: 2 });
  assert.equal(bodyPolicy(269).included, false);
  assert.equal(bodyPolicy(244).included, false);
});

test("classifies topic and conservative geographic scope", () => {
  assert.equal(classifyTopic(fixture.matter), "housing-land-use");
  assert.deepEqual(inferGeographicScope(fixture.matter, fixture.item), {
    kind: "district",
    districtNumbers: [3],
    text: "Council District 3",
  });
});

test("keeps public comments link-only while extracting staff evidence", () => {
  assert.deepEqual(classifyDocument(fixture.publicCommentDocument), {
    category: "public_comment",
    processingPolicy: "link_only",
    isPublicComment: true,
  });
  assert.deepEqual(classifyDocument(fixture.staffDocument), {
    category: "staff_report",
    processingPolicy: "extract_text",
    isPublicComment: false,
  });
});

test("marks image-only PDFs for OCR and accepts dense native text", () => {
  assert.equal(needsOcr("", 1), true);
  assert.equal(needsOcr("A".repeat(79), 1), true);
  assert.equal(needsOcr("A".repeat(80), 1), false);
  assert.ok(nativeTextQuality("City budget report. ".repeat(50), 1) > 0.9);
});

test("interprets Legistar local meeting times in San José's timezone", () => {
  assert.equal(
    parseLegistarMeetingStart(
      "2026-06-23T00:00:00",
      "1:30 PM",
      "America/Los_Angeles",
    ).toISOString(),
    "2026-06-23T20:30:00.000Z",
  );
  assert.equal(
    parseLegistarMeetingStart(
      "2026-12-15T00:00:00",
      "1:30 PM",
      "America/Los_Angeles",
    ).toISOString(),
    "2026-12-15T21:30:00.000Z",
  );
});
