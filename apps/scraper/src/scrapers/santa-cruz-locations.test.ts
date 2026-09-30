import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseSantaCruzLocations } from "./santa-cruz-locations-parser.js";
import { collectSantaCruzLocations } from "./santa-cruz-locations-source.js";

const html = readFileSync(
  new URL(
    "./__fixtures__/santa-cruz-locations/primary-2026.html",
    import.meta.url,
  ),
  "utf8",
);
const url =
  "https://votescount.santacruzcountyca.gov/Home/Elections/June2,2026CaliforniaPrimaryElection/VoteCenterDropBoxLocations.aspx";
test("actual official primary extract yields 24 centers and preserves exception notes", () => {
  const result = parseSantaCruzLocations(html, url, "2026-06-02");
  assert.equal(result.locations.length, 24);
  assert.equal(result.locations.filter((x) => x.earlyVoting).length, 20);
  assert.equal(result.locations[0]?.line1, "701 Ocean St., Room 310");
  assert.equal(result.locations[0]?.city, "Santa Cruz");
  const special = result.locations.find((x) => x.name.includes("John"));
  assert.match(special?.notes ?? "", /1pm to 9pm/);
  assert.match(special?.schedule ?? "", /7am to 8pm/);
  assert.equal(result.coverage, "published_vote_centers_only");
});
test("primary locations cannot populate general; unrelated year in navigation is ignored", () => {
  assert.throws(() => parseSantaCruzLocations(html, url, "2026-11-03"));
  assert.throws(() =>
    parseSantaCruzLocations(
      html,
      url.replace(
        "June2,2026CaliforniaPrimary",
        "November3,2026CaliforniaGeneral",
      ),
      "2026-06-02",
    ),
  );
  assert.throws(() =>
    parseSantaCruzLocations(
      html.replace('class="subtitle"', 'class="other"'),
      url,
      "2026-06-02",
    ),
  );
  assert.throws(() =>
    parseSantaCruzLocations(
      html,
      url.replace("https://", "https://user:secret@"),
      "2026-06-02",
    ),
  );
});

test("updated general heading cannot relabel old primary schedules", () => {
  assert.throws(
    () =>
      parseSantaCruzLocations(
        html.replace(
          "June 2, 2026 California Primary Election",
          "November 3, 2026 California General Election",
        ),
        url.replace(
          "June2,2026CaliforniaPrimary",
          "November3,2026CaliforniaGeneral",
        ),
        "2026-11-03",
      ),
    /different election/,
  );
});

test("landing discovery fetches only exact election child and rejects unpublished pages", async () => {
  const landing = url.replace("/VoteCenterDropBoxLocations.aspx", ".aspx");
  const requests: string[] = [];
  const fetchPage = (path: string) => {
    requests.push(path);
    return Promise.resolve(
      path === landing ? `<a href="${url}">Locations</a>` : html,
    );
  };
  const parsed = await collectSantaCruzLocations(
    landing,
    "2026-06-02",
    fetchPage,
  );
  assert.equal(parsed.locations.length, 24);
  assert.equal(requests.length, 2);
  await assert.rejects(
    collectSantaCruzLocations(landing, "2026-06-02", () =>
      Promise.resolve(
        '<a href="https://evil.test/other/VoteCenterDropBoxLocations.aspx">Locations</a>',
      ),
    ),
    /no unambiguous/,
  );
});
