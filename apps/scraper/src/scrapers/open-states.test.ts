import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenStatesUrl, leginfoTextFallbackUrl } from "./open-states.js";

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

test("California PDF trampolines fall back to the official HTML text page", () => {
  assert.equal(
    leginfoTextFallbackUrl(
      "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202520260AB2047&version=20250AB204796AMD",
    ),
    "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB2047",
  );
  assert.equal(
    leginfoTextFallbackUrl("https://example.com/billPdf.xhtml?bill_id=nope"),
    undefined,
  );
});
