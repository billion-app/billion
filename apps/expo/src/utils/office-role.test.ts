import assert from "node:assert/strict";
import test from "node:test";

import { officeRoles, resolveOfficeRole } from "./office-role";

test("a title cannot borrow another jurisdiction's powers", () => {
  assert.equal(
    resolveOfficeRole({
      office: "Governor",
      state: "TX",
      districtId: "ocd-division/country:us/state:tx",
    }),
    undefined,
  );
  assert.equal(
    resolveOfficeRole({ office: "Governor", state: "CA" }),
    undefined,
  );
  assert.equal(
    resolveOfficeRole({
      office: "City Council",
      state: "MA",
      districtId: "ocd-division/country:us/state:ma/place:cambridge",
    }),
    undefined,
  );
  assert.equal(
    resolveOfficeRole({
      office: "U.S. Representative",
      districtId: "ocd-division/country:us/state:ca",
    }),
    undefined,
  );
});
test("race and candidate contexts resolve to one shared role", () => {
  assert.equal(
    resolveOfficeRole({
      office: "Governor",
      state: "CA",
      districtId: "ocd-division/country:us/state:ca",
    }),
    officeRoles[1],
  );
  assert.equal(
    resolveOfficeRole({
      office: "U.S. Representative",
      districtId: "ocd-division/country:us/state:tx/cd:7",
    }),
    officeRoles[0],
  );
  assert.equal(
    resolveOfficeRole({
      office: "City Council",
      state: "MA",
      districtId: "ocd-division/country:us/state:ma/place:boston",
    }),
    officeRoles[2],
  );
});

test("nonvoting delegations and contradictory district context cannot claim House powers", () => {
  for (const districtId of [
    "ocd-division/country:us/state:dc/cd:0",
    "ocd-division/country:us/state:pr/cd:0",
    "ocd-division/country:us/state:ca/place:boston/cd:2",
    "ocd-division/country:us/state:xx/cd:1",
  ]) {
    assert.equal(
      resolveOfficeRole({ office: "U.S. Representative", districtId }),
      undefined,
    );
  }
  assert.equal(
    resolveOfficeRole({
      office: "U.S. Representative",
      state: "MA",
      districtId: "ocd-division/country:us/state:ca/cd:1",
    }),
    undefined,
  );
});
