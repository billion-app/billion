import assert from "node:assert/strict";
import test from "node:test";

import { courtIdentityNames } from "./court-identity.js";

void test("official SCOTUS refreshes recognize legacy CourtListener identities", () => {
  const names = courtIdentityNames("Supreme Court of the United States");
  assert.ok(
    names.includes("HTTPS://WWW.COURTLISTENER.COM/API/REST/V4/COURTS/SCOTUS/"),
  );
  assert.deepEqual(courtIdentityNames(names[1]!), names);
});

void test("docket numbers shared by different courts remain separate", () => {
  assert.deepEqual(
    courtIdentityNames("United States Court of Appeals for the Ninth Circuit"),
    ["United States Court of Appeals for the Ninth Circuit"],
  );
});
