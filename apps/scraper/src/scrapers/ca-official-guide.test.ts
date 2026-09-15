import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GUIDE_BASE,
  guideElectionDate,
  guideLinks,
  parseGuideCandidates,
  parseGuideMeasure,
} from "./ca-official-guide-parser.js";
import { collectOfficialGuide } from "./ca-official-guide-source.js";

const measure = readFileSync(
  new URL(
    "./__fixtures__/ca-official-guide/proposition-42.html",
    import.meta.url,
  ),
  "utf8",
);
const governor = readFileSync(
  new URL("./__fixtures__/ca-official-guide/governor.html", import.meta.url),
  "utf8",
);
const date = "2026-11-03";
const url = `${GUIDE_BASE}/propositions/42/`;
test("official overview separates summary, fiscal impact, arguments and proposed law", () => {
  const parsed = parseGuideMeasure(measure, url, date)!;
  assert.equal(parsed.number, "42");
  assert.match(parsed.officialSummary!, /^Prohibits any new state tax/);
  assert.doesNotMatch(
    parsed.officialSummary!,
    /Fiscal Impact|Supporters|Opponents/,
  );
  assert.equal(
    parsed.fiscalImpact,
    "Possibility that tax revenues will not go up as much in the future.",
  );
  assert.match(parsed.proArguments![0]!.text, /California’s Constitution/);
  assert.match(parsed.conArguments![0]!.text, /billionaire-funded/);
  assert.match(parsed.fullTextUrl!, /^https:\/\/vig.cdn.sos.ca.gov\/2026\//);
  assert.equal(parsed.sourceUrl, url);
});
test("primary/general and proposition identity mismatches cannot produce data", () => {
  assert.equal(guideElectionDate(measure), date);
  assert.equal(parseGuideMeasure(measure, url, "2026-06-02"), null);
  assert.equal(
    parseGuideMeasure(measure, `${GUIDE_BASE}/propositions/1/`, date),
    null,
  );
  assert.equal(
    guideElectionDate(measure.replace('id="txtBnr"', 'id="removed"')),
    null,
  );
});
test("no statement remains missing; footer and another candidate never become a statement", () => {
  assert.deepEqual(
    parseGuideCandidates(
      governor,
      `${GUIDE_BASE}/candidates/governor-candidate-statements.htm`,
      date,
    ),
    [],
  );
  const prose =
    "I will serve the people of California with transparent government and accountable public services.";
  const html = governor.replace("No candidate statement&#46;", prose);
  const parsed = parseGuideCandidates(
    html,
    `${GUIDE_BASE}/candidates/governor-candidate-statements.htm`,
    date,
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.statement, prose);
  assert.equal(parsed[0]!.name, "Xavier Becerra");
  assert.deepEqual(
    parseGuideCandidates(
      html,
      `${GUIDE_BASE}/candidates/boe-candidate-statements.htm`,
      date,
    ),
    [],
  );
});
test("discovery only uses supported official detail links", () => {
  const links = guideLinks(
    measure + '<a href="https://evil.test/propositions/42/">bad</a>',
    "measures",
  );
  assert.ok(links.includes(url));
  assert.ok(links.every((link) => link.startsWith(GUIDE_BASE)));
  assert.ok(
    !guideLinks(governor, "candidates").some((link) => link.includes("boe-")),
  );
});
test("collector has bounded detail reads and refuses a cycle change before persistence", async () => {
  const fetched: string[] = [];
  const fetchPage = async (source: string) => {
    fetched.push(source);
    return source.endsWith("/propositions/")
      ? `<div id="txtBnr">November 3, 2026</div><a href="/propositions/42/">42</a>`
      : source.includes("candidates")
        ? governor
        : measure;
  };
  const data = await collectOfficialGuide(date, 1, fetchPage);
  assert.equal(fetched.length, 3);
  assert.equal(data.measures.length, 1);
  await assert.rejects(
    collectOfficialGuide("2026-06-02", 1, fetchPage),
    /does not match/,
  );
});

test("official candidate prose preserves complete statement and excludes contact/footer", () => {
  const html = readFileSync(
    new URL(
      "./__fixtures__/ca-official-guide/lt-governor.html",
      import.meta.url,
    ),
    "utf8",
  );
  const parsed = parseGuideCandidates(
    html,
    `${GUIDE_BASE}/candidates/lt-governor-candidate-statements.htm`,
    date,
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]!.name, "Fiona Ma");
  assert.equal(parsed[0]!.statement.length, 1858);
  assert.doesNotMatch(
    parsed[0]!.statement,
    /Tel:|The views and opinions expressed/,
  );
  assert.equal(parsed[1]!.name, "Gloria Romero");
});

test("a same-year primary law link is not a general-election full text", () => {
  const html = measure.replaceAll("/2026/general/", "/2026/primary/");
  assert.equal(parseGuideMeasure(html, url, date)?.fullTextUrl, undefined);
});
