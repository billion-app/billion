import assert from "node:assert/strict";
import test from "node:test";

import type { CourtBriefRecord } from "@acme/validators";

import { selectReaderBrief } from "./reader-brief";

void test("a court response selects its structured brief instead of raw article text", () => {
  const courtBrief = {
    takeaway: { text: "Structured result" },
  } as CourtBriefRecord;
  const selected = selectReaderBrief({
    type: "court_case",
    courtBrief,
    // A new court row has raw source in articleContent; it must not decide the renderer.
    articleContent: "RAW COURT SOURCE",
  } as Parameters<typeof selectReaderBrief>[0] & { articleContent: string });
  assert.deepEqual(selected, { kind: "court", brief: courtBrief });
});

void test("briefs never cross content-type boundaries", () => {
  const courtBrief = { takeaway: { text: "Court" } } as CourtBriefRecord;
  assert.equal(selectReaderBrief({ type: "bill", courtBrief }), null);
  assert.equal(
    selectReaderBrief({ type: "government_content", courtBrief }),
    null,
  );
});
