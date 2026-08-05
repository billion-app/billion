import assert from "node:assert/strict";
import test from "node:test";

import type { DivisionByAddressResponse } from "./civic";
import {
  extractDistricts,
  parseCsv,
  selectFederalOfficialByName,
  selectOfficials,
} from "./elected-officials";
import { canUseDevelopmentMocks } from "./places";

void test("parseCsv handles quoted commas and escaped quotes", () => {
  assert.deepEqual(
    parseCsv(
      'name,address,note\n"Jane Doe","1 Main St, Apt 2","Said ""hi"""\n',
    ),
    [
      ["name", "address", "note"],
      ["Jane Doe", "1 Main St, Apt 2", 'Said "hi"'],
    ],
  );
});

void test("production never enables mock address predictions", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;
  process.env.NODE_ENV = "production";
  delete process.env.VERCEL;
  try {
    assert.equal(canUseDevelopmentMocks(), false);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

void test("extractDistricts reads federal and state OCD division IDs", () => {
  const response: DivisionByAddressResponse = {
    kind: "civicinfo#divisionsByAddressResponse",
    normalizedInput: {
      line1: "200 E Santa Clara St",
      city: "San Jose",
      state: "CA",
      zip: "95113",
    },
    divisions: {
      "ocd-division/country:us/state:ca": { name: "California" },
      "ocd-division/country:us/state:ca/cd:17": { name: "17th District" },
      "ocd-division/country:us/state:ca/sldu:15": { name: "15th District" },
      "ocd-division/country:us/state:ca/sldl:25": { name: "25th District" },
    },
  };

  assert.deepEqual(extractDistricts(response), {
    stateCode: "CA",
    stateName: "California",
    congressional: "17",
    stateUpper: "15",
    stateLower: "25",
  });
});

void test("extractDistricts follows D.C. aliases and normalizes at-large seats", () => {
  const response: DivisionByAddressResponse = {
    kind: "civicinfo#divisionsByAddressResponse",
    normalizedInput: {
      line1: "1600 Pennsylvania Ave NW",
      city: "Washington",
      state: "DC",
      zip: "20500",
    },
    divisions: {
      "ocd-division/country:us/district:dc": {
        name: "District of Columbia",
        alsoKnownAs: ["ocd-division/country:us/state:dc"],
      },
      "ocd-division/country:us/district:dc/cd:0": {
        name: "District of Columbia At-Large Congressional District",
      },
    },
  };

  assert.deepEqual(extractDistricts(response), {
    stateCode: "DC",
    stateName: "District of Columbia",
    congressional: "AL",
    stateUpper: undefined,
    stateLower: undefined,
  });
});

void test("selectOfficials returns the address-scoped federal and state delegation", () => {
  const row = (overrides: Record<string, string>) => ({
    id: "id",
    name: "Name",
    current_party: "Democratic",
    current_district: "California",
    current_chamber: "upper",
    image: "",
    email: "",
    links: "https://example.com",
    capitol_address: "",
    capitol_voice: "",
    district_address: "",
    district_voice: "",
    ...overrides,
  });
  const officials = selectOfficials(
    [
      row({ id: "sen-1", name: "Senator One" }),
      row({ id: "sen-2", name: "Senator Two" }),
      row({
        id: "house",
        name: "House Member",
        current_chamber: "lower",
        current_district: "CA-17",
      }),
      row({
        id: "other-house",
        current_chamber: "lower",
        current_district: "CA-18",
      }),
    ],
    [
      row({ id: "state-sen", current_district: "15" }),
      row({
        id: "assembly",
        current_chamber: "lower",
        current_district: "25",
      }),
    ],
    {
      stateCode: "CA",
      stateName: "California",
      congressional: "17",
      stateUpper: "15",
      stateLower: "25",
    },
  );

  assert.deepEqual(
    officials.map((official) => official.id),
    ["sen-1", "sen-2", "house", "state-sen", "assembly"],
  );
});

void test("selectFederalOfficialByName matches chamber and first/last name", () => {
  const row = (overrides: Record<string, string>) => ({
    id: "id",
    name: "Name",
    current_party: "Republican",
    current_district: "TX-5",
    current_chamber: "lower",
    image: "https://example.com/headshot.jpg",
    email: "",
    links: "https://example.com",
    capitol_address: "",
    capitol_voice: "",
    district_address: "",
    district_voice: "",
    ...overrides,
  });

  const official = selectFederalOfficialByName(
    [
      row({ id: "senator", name: "Lance Gooden", current_chamber: "upper" }),
      row({ id: "representative", name: "Lance E. Gooden" }),
    ],
    "Rep. Lance Gooden",
    "House",
  );

  assert.ok(official);
  assert.equal(official.id, "representative");
  assert.equal(official.image, "https://example.com/headshot.jpg");
  assert.equal(official.district, "5");
});

void test("selectFederalOfficialByName does not borrow a namesake's headshot", () => {
  // Rep. Mike Rogers (R-MI) left the House in 2015; Rep. Mike Rogers (R-AL-3)
  // still sits. Matching on name + chamber alone hands a Michigan-sponsored
  // bill the Alabama member's photo, beside the label "MI".
  const rogers = [
    {
      id: "rogers-al",
      name: "Mike Rogers",
      current_party: "Republican",
      current_district: "AL-3",
      current_chamber: "lower",
      image: "https://example.com/rogers-al.jpg",
      email: "",
      links: "https://example.com",
      capitol_address: "",
      capitol_voice: "",
      district_address: "",
      district_voice: "",
    },
  ];

  assert.equal(
    selectFederalOfficialByName(rogers, "Mike Rogers", "House", "MI"),
    undefined,
  );

  const matched = selectFederalOfficialByName(
    rogers,
    "Mike Rogers",
    "House",
    "AL",
  );
  assert.equal(matched?.id, "rogers-al");
  assert.equal(matched?.district, "3");
});

void test("selectFederalOfficialByName matches senators by full state name", () => {
  const senators = [
    {
      id: "padilla-ca",
      name: "Alex Padilla",
      current_party: "Democratic",
      current_district: "California",
      current_chamber: "upper",
      image: "https://example.com/padilla.jpg",
      email: "",
      links: "https://example.com",
      capitol_address: "",
      capitol_voice: "",
      district_address: "",
      district_voice: "",
    },
  ];

  const matched = selectFederalOfficialByName(
    senators,
    "Alex Padilla",
    "Senate",
    "CA",
  );
  assert.equal(matched?.id, "padilla-ca");
  assert.equal(matched?.office, "U.S. Senator");
  assert.equal(matched?.district, undefined);

  assert.equal(
    selectFederalOfficialByName(senators, "Alex Padilla", "Senate", "TX"),
    undefined,
  );
});
