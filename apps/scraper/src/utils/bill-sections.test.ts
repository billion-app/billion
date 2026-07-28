import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MAX_SECTION_BYTES, parseBillSections } from "./bill-sections.js";

const fixture = (name: string) =>
  readFile(new URL(`../fixtures/bills/${name}.xml`, import.meta.url), "utf8");

test("simple bill fixture produces stable addressable sections", async () => {
  const xml = await fixture("simple");
  const first = parseBillSections(xml);
  const second = parseBillSections(xml);

  assert.deepEqual(second, first);
  assert.deepEqual(
    first.map((section) => section.structuralPath),
    ["section-1", "section-2"],
  );
  assert.equal(first[0]?.xmlId, "H1234ABC");
  assert.ok(first[0]?.sourceStartOffset !== undefined);
  assert.ok(first[0]?.sourceEndOffset !== undefined);
  assert.match(first[1]?.sectionHash ?? "", /^[a-f0-9]{64}$/);
});

test("omnibus fixture retains hierarchy, policy details, and quoted amendments", async () => {
  const sections = parseBillSections(await fixture("omnibus"));

  assert.deepEqual(
    sections.map((section) => section.structuralPath),
    ["division-a/title-ii/subtitle-b/section-219", "division-b/section-1001"],
  );
  assert.match(
    sections[0]?.text ?? "",
    /Each agency shall make the records available verbatim/,
  );
  assert.match(sections[0]?.text ?? "", /shall submit a report/);
  assert.match(sections[1]?.text ?? "", /takes effect on enactment/);
  assert.ok(
    sections[0]?.crossReferences.some(
      (reference) => reference.toLowerCase() === "section 101",
    ),
  );
});

test("multi-megabyte omnibus sections split at subsection boundaries", async () => {
  const base = await fixture("omnibus");
  const payload = "appropriations and reporting requirement ".repeat(18_000);
  const subsections = Array.from(
    { length: 8 },
    (_, index) =>
      `<subsection id="large-${index}"><num>(${index + 1})</num><text>${payload}</text></subsection>`,
  ).join("");
  const xml = base.replace(
    "</legis-body>",
    `<section id="H8800-LARGE"><num>SEC. 9000.</num><heading>OMNIBUS APPROPRIATIONS.</heading>${subsections}</section></legis-body>`,
  );

  assert.ok(Buffer.byteLength(xml, "utf8") > 4_000_000);
  const sections = parseBillSections(xml);
  const chunks = sections.filter((section) =>
    section.structuralPath.startsWith("section-9000/part-"),
  );
  assert.ok(chunks.length > 1);
  assert.ok(
    chunks.every(
      (section) =>
        Buffer.byteLength(section.text, "utf8") <= MAX_SECTION_BYTES * 2,
    ),
  );
  assert.ok(chunks.every((section) => section.sectionHash.length === 64));
});
