import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenStatesUrl } from "./open-states.js";

test("Open States include filters use repeated query parameters", () => {
  const url = buildOpenStatesUrl("/bills", {
    jurisdiction: "ocd-jurisdiction/country:us/state:ca/government",
    include: ["sponsorships", "abstracts", "actions", "versions"],
    per_page: 20,
  });

  assert.deepEqual(url.searchParams.getAll("include"), [
    "sponsorships",
    "abstracts",
    "actions",
    "versions",
  ]);
  assert.equal(url.searchParams.get("per_page"), "20");
});
