import assert from "node:assert/strict";
import test from "node:test";

import {
  matchSpurMeasure,
  parseSpurGuideLinks,
  parseSpurMeasurePage,
} from "@acme/api/lib/measure-sources/spur";

const url = "https://www.spur.org/voter-guide/2026-06/sf-prop-a-earthquake-bond";
const html = `
<meta property="og:title" content="San Francisco Prop A - Earthquake Bond">
<meta name="description" content="Official ballot description">
<meta property="article:published_time" content="2026-04-30T06:00:00-0700">
<div class="field--name-field-body"><h3>What the Measure Would Do</h3><p>Issue a bond.</p>
<h3>The Backstory</h3><p>Prior bonds funded safety work.</p>
<h3>Equity Impacts</h3><p>Faster recovery benefits lower-income residents.</p>
<h3>Pros</h3><ul><li>Improves emergency response infrastructure.</li></ul>
<h3>Cons</h3><ul><li>Repayment would constrain future budgets.</li></ul></div>
<div id="recommendation"><div class="field--name-field-recommendation-summary"><h3>SPUR's Recommendation</h3><div><p>Safety infrastructure merits investment.</p></div></div>
<span class="field--name-field-recommendation">Vote YES</span>
<span class="field--name-field-short-title">Earthquake Bond</span></div>
<div class="field--name-field-footnotes"></div>`;

test("discovers only measure pages for the requested guide", () => {
  const index = `<a href="/voter-guide/2026-06/sf-prop-a-earthquake-bond">A</a><a href="/voter-guide/2026-06/pdf">PDF</a>`;
  assert.deepEqual(parseSpurGuideLinks(index, 2026, 6), [url]);
});

test("parses and matches separately attributed SPUR analysis", () => {
  const measure = parseSpurMeasurePage(html, url);
  assert.ok(measure);
  assert.equal(measure.jurisdiction, "SF");
  assert.equal(measure.equityImpacts, "Faster recovery benefits lower-income residents.");
  assert.deepEqual(measure.pros, ["Improves emergency response infrastructure."]);
  assert.equal(measure.recommendation, "Vote YES");
  assert.equal(matchSpurMeasure([measure], "Proposition A Earthquake Bond", "San Francisco"), measure);
  assert.equal(matchSpurMeasure([measure], "Measure A", "Alameda"), undefined);
});
