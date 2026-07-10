import assert from "node:assert/strict";
import test from "node:test";

import {
  findPhraseTime,
  formatSrt,
  parseSrt,
  splitCaptionCues,
} from "./captions";

const SAMPLE = `1
00:00:00,000 --> 00:00:02,000
Here is what the bill does.

2
00:00:02,000 --> 00:00:05,000
The biggest change affects renters this year.
`;

test("parses and formats SRT captions", () => {
  const cues = parseSrt(SAMPLE);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], {
    start: 0,
    end: 2,
    text: "Here is what the bill does.",
  });
  assert.deepEqual(parseSrt(formatSrt(cues)), cues);
});

test("finds phrase anchors across caption boundaries", () => {
  const cues = parseSrt(SAMPLE);
  const match = findPhraseTime(cues, "does the biggest");
  assert.ok(match);
  assert.ok(match.start > 1.5 && match.start < 2);
  assert.ok(match.end > 2 && match.end < 3);
});

test("splits long captions into readable chunks", () => {
  const cues = splitCaptionCues(parseSrt(SAMPLE), 4);
  assert.equal(cues.length, 4);
  assert.equal(cues[0]?.text, "Here is what the");
  assert.equal(cues[1]?.text, "bill does.");
  assert.equal(cues.at(-1)?.end, 5);
});
