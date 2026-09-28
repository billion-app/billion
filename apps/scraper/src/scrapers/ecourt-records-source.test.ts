import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverCriminalCases,
  parseCriminalCase,
} from "./ecourt-records-source.js";

const url =
  "https://ecourtrecords.org/us/massachusetts/barnstable-county/orleans/commonwealth-vs-peters-braden-e/2626cr000731/c09bb285/";
const index = `<article class="case-card"><div class="eyebrow">Orleans District Court · Criminal</div><a href="${url}">Commonwealth vs. Peters</a></article>`;

function casePage(lastEntry = "September 8, 2026", entries = "") {
  return `<link rel="canonical" href="${url}">
    <div class="breadcrumb">Massachusetts <span>/</span> Orleans District Court <span>/</span> 2626CR000731</div>
    <div class="case-heading"><div class="eyebrow">CRIMINAL CASE <span class="pill">Pending</span></div><h1>Commonwealth vs. Peters, Braden E</h1><p class="lede">Braden E. Peters · Clavicular</p></div>
    <section class="facts"><div><small>CASE NUMBER</small><strong>2626CR000731</strong></div><div><small>FILED</small><strong>September 8, 2026</strong></div><div><small>LAST DOCKET ENTRY</small><strong>${lastEntry}</strong></div></section>
    <section id="charges"><article class="content-card"><h3>Charge A</h3></article></section>
    <section id="docket"><article class="entry" id="complaint"><time datetime="2026-09-08">Sep 8, 2026</time><p class="entry-text">Complaint issued.</p></article>${entries}</section>
    <section id="schedule"><div class="content-card">10/14/2026 08:30 AM · Arraignment Session</div></section>
    <aside><section class="panel"></section><section class="panel">No public document image links.</section></aside>`;
}

test("discovers the criminal docket without searching for a named person", () => {
  assert.deepEqual(discoverCriminalCases(index), [url]);
  assert.throws(() => discoverCriminalCases("<main></main>"), /no case links/);
});

test("keeps docket text and treats the latest entry as the browse date", () => {
  const page = casePage(
    "October 14, 2026",
    '<article class="entry" id="arraignment"><time datetime="2026-10-14">Oct 14, 2026</time><p class="entry-text">Arraignment held.</p></article>',
  );
  const record = parseCriminalCase(page, url);
  assert.equal(record.caseNumber, "2626CR000731");
  assert.match(record.title, /Clavicular/);
  assert.equal(record.filedDate?.toISOString().slice(0, 10), "2026-10-14");
  assert.match(record.fullText ?? "", /2026-10-14: Arraignment held/);
  assert.match(record.fullText ?? "", /Charges \(allegations, not findings\)/);
  assert.match(record.fullText ?? "", /No public document image links/);
});

test("refuses an incomplete or inconsistent snapshot", () => {
  assert.throws(
    () => parseCriminalCase(casePage("October 14, 2026"), url),
    /disagrees/,
  );
  assert.throws(
    () => parseCriminalCase(casePage().replace("Complaint issued.", ""), url),
    /Incomplete docket entry/,
  );
  assert.throws(
    () => parseCriminalCase(casePage(), url, new Date("2026-10-18T00:00:00Z")),
    /snapshot may be stale/,
  );
});
