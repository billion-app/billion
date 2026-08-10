import assert from "node:assert/strict";
import test from "node:test";

import type { OpenStatesBill } from "@acme/api/clients/open-states";

import {
  buildBillNumber,
  formatSessionLabel,
  formatSponsor,
  latestAction,
  mapChamber,
  mapStatus,
  normalizeActions,
  normalizeBill,
  normalizeIdentifier,
  OPEN_STATES_SOURCE,
  parseBillNumber,
  pickAbstract,
  pickSourceUrl,
  pickVersionLink,
  UnnormalizableBillError,
} from "./open-states-normalize.js";

// ---------------------------------------------------------------------------
// Identifier stability
// ---------------------------------------------------------------------------

void test("identifier spacing does not change a bill's identity", () => {
  // The CSV bulk export and the API do not always agree on spacing. If they
  // normalized differently, backfilling a session would duplicate every bill
  // the incremental walk had already stored.
  for (const raw of ["SB 243", "SB243", "sb  243", " sb.243 "]) {
    assert.equal(normalizeIdentifier(raw), "SB 243");
  }
});

void test("bill numbers carry state and session so they cannot collide", () => {
  const ca2025 = buildBillNumber({
    stateCode: "ca",
    identifier: "SB 243",
    session: "20252026",
  });
  const ca2023 = buildBillNumber({
    stateCode: "ca",
    identifier: "SB 243",
    session: "20232024",
  });
  const ny2025 = buildBillNumber({
    stateCode: "ny",
    identifier: "SB 243",
    session: "20252026",
  });

  assert.equal(ca2025, "CA SB 243 (2025-2026)");
  assert.notEqual(ca2025, ca2023);
  assert.notEqual(ca2025, ny2025);
  // And nothing here can look like a congress.gov bill number.
  assert.doesNotMatch(ca2025!, /^H\.R\.|^S\./);
});

void test("bill numbers round-trip back to their state and identifier", () => {
  const parsed = parseBillNumber("CA SB 243 (2025-2026)");
  assert.deepEqual(parsed, {
    stateCode: "CA",
    identifier: "SB 243",
    sessionLabel: "2025-2026",
  });
});

void test("only eight-digit sessions are reshaped; others pass through", () => {
  assert.equal(formatSessionLabel("20252026"), "2025-2026");
  assert.equal(formatSessionLabel("2025"), "2025");
  assert.equal(formatSessionLabel("2025S1"), "2025S1");
});

void test("an undecomposable identifier yields no bill number", () => {
  assert.equal(normalizeIdentifier("Proposition 13-A-2"), undefined);
  assert.equal(
    buildBillNumber({
      stateCode: "ca",
      identifier: "???",
      session: "20252026",
    }),
    undefined,
  );
});

// ---------------------------------------------------------------------------
// Chamber mapping
// ---------------------------------------------------------------------------

void test("California's lower chamber is the Assembly, not the House", () => {
  assert.equal(
    mapChamber({ stateCode: "ca", identifier: "AB 1064" }, "lower"),
    "Assembly",
  );
  assert.equal(
    mapChamber({ stateCode: "ca", identifier: "SB 243" }, "upper"),
    "Senate",
  );
});

void test("chamber falls back to the identifier prefix", () => {
  assert.equal(
    mapChamber({ stateCode: "ca", identifier: "SB 243" }, undefined),
    "Senate",
  );
  assert.equal(
    mapChamber({ stateCode: "ca", identifier: "AB 1064" }, undefined),
    "Assembly",
  );
  // An unlisted state keeps the common Senate/House vocabulary.
  assert.equal(
    mapChamber({ stateCode: "tx", identifier: "HB 20" }, "lower"),
    "House",
  );
});

void test("an unrecognizable chamber is left unset rather than guessed", () => {
  assert.equal(
    mapChamber({ stateCode: "ca", identifier: "XR 5" }, undefined),
    undefined,
  );
});

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const action = (
  date: string,
  description: string,
  classification: string[] = [],
) => ({ date, description, classification });

void test("status comes from the newest action, whatever order they arrive in", () => {
  const actions = [
    action("2025-10-13", "Chaptered by Secretary of State", ["became-law"]),
    action("2025-01-30", "Introduced", ["introduction"]),
  ];
  assert.equal(mapStatus(actions), "Chaptered into law");
  assert.equal(
    latestAction(actions)?.description,
    "Chaptered by Secretary of State",
  );
});

void test("terminal classifications win over procedural ones on the same action", () => {
  assert.equal(
    mapStatus([
      action("2025-10-13", "Approved by the Governor", [
        "passage",
        "executive-signature",
      ]),
    ]),
    "Signed by the governor",
  );
});

void test("vetoes and failures map to their own labels", () => {
  assert.equal(
    mapStatus([action("2025-09-01", "Vetoed", ["executive-veto"])]),
    "Vetoed by the governor",
  );
  assert.equal(
    mapStatus([action("2025-09-01", "Died in committee", ["failure"])]),
    "Failed",
  );
});

void test("an unclassified action falls back to its own description, unsliced", () => {
  const long = `Read third time. ${"Amended. ".repeat(40)}Passed.`;
  assert.equal(mapStatus([action("2025-05-01", long)]), long);
});

void test("a bill with no actions has an explicit unknown status", () => {
  assert.equal(mapStatus(undefined), "Unknown");
  assert.equal(mapStatus([]), "Unknown");
});

void test("undated actions never outrank dated ones", () => {
  assert.equal(
    latestAction([
      action("", "Unknown-date filing"),
      action("2025-01-30", "Introduced", ["introduction"]),
    ])?.description,
    "Introduced",
  );
});

void test("same-day actions keep source order so the later step wins", () => {
  assert.equal(
    latestAction([
      action("2025-01-30", "Introduced", ["introduction"]),
      action("2025-01-30", "Referred to Com. on JUD.", ["referral-committee"]),
    ])?.description,
    "Referred to Com. on JUD.",
  );
});

// ---------------------------------------------------------------------------
// Optional fields
// ---------------------------------------------------------------------------

void test("sponsor formatting degrades as the source thins out", () => {
  assert.equal(
    formatSponsor([
      {
        name: "Padilla",
        entity_type: "person",
        classification: "primary",
        primary: true,
        person: {
          id: "ocd-person/1",
          name: "Steve Padilla",
          party: "Democratic",
          current_role: {
            title: "Senator",
            org_classification: "upper",
            district: "18",
            division_id: "ocd-division/x",
          },
        },
      },
    ]),
    "Steve Padilla (D-18)",
  );

  // No resolved person: the bare sponsorship name is still worth showing.
  assert.equal(
    formatSponsor([
      {
        name: "Committee on Judiciary",
        entity_type: "organization",
        classification: "primary",
        primary: true,
      },
    ]),
    "Committee on Judiciary",
  );

  assert.equal(formatSponsor([]), undefined);
  assert.equal(formatSponsor(undefined), undefined);
});

void test("a non-primary sponsorship is used when no primary one exists", () => {
  assert.equal(
    formatSponsor([
      {
        name: "A Cosponsor",
        entity_type: "person",
        classification: "cosponsor",
        primary: false,
      },
    ]),
    "A Cosponsor",
  );
});

void test("the longest abstract is kept as summary source", () => {
  assert.equal(
    pickAbstract([
      { abstract: "Short digest.", note: "digest" },
      {
        abstract: "A considerably longer legislative counsel's digest.",
        note: "counsel",
      },
    ]),
    "A considerably longer legislative counsel's digest.",
  );
  assert.equal(pickAbstract([{ abstract: "   ", note: "" }]), undefined);
  assert.equal(pickAbstract(undefined), undefined);
});

void test("text selection prefers the newest text version and skips PDF-only ones", () => {
  const picked = pickVersionLink([
    {
      note: "Introduced",
      date: "2025-01-30",
      links: [
        { url: "https://example.gov/introduced.html", media_type: "text/html" },
      ],
    },
    {
      note: "Chaptered",
      date: "2025-10-13",
      links: [
        {
          url: "https://example.gov/chaptered.pdf",
          media_type: "application/pdf",
        },
        { url: "https://example.gov/chaptered.html", media_type: "text/html" },
      ],
    },
  ]);
  assert.equal(picked?.url, "https://example.gov/chaptered.html");
  assert.equal(picked?.note, "Chaptered");
});

void test("a PDF-only bill yields no text link rather than a PDF one", () => {
  assert.equal(
    pickVersionLink([
      {
        note: "Introduced",
        date: "2025-01-30",
        links: [
          { url: "https://example.gov/x.pdf", media_type: "application/pdf" },
        ],
      },
    ]),
    undefined,
  );
  assert.equal(pickVersionLink(undefined), undefined);
});

void test("the official state URL beats the Open States mirror", () => {
  assert.equal(
    pickSourceUrl({
      sources: [
        { url: "https://example.com/aggregator" },
        { url: "https://leginfo.legislature.ca.gov/faces/x.xhtml?bill_id=1" },
      ],
      openstates_url: "https://openstates.org/CA/bills/20252026/SB243/",
    }),
    "https://leginfo.legislature.ca.gov/faces/x.xhtml?bill_id=1",
  );

  assert.equal(
    pickSourceUrl({
      sources: [{ url: "not a url" }],
      openstates_url: "https://openstates.org/CA/bills/20252026/SB243/",
    }),
    "https://openstates.org/CA/bills/20252026/SB243/",
  );

  assert.equal(pickSourceUrl({}), undefined);
});

void test("actions keep their classifications and drop empty descriptions", () => {
  assert.deepEqual(
    normalizeActions([
      action("2025-01-30", "  Introduced  ", ["introduction", "reading-1"]),
      action("2025-02-01", "   "),
    ]),
    [
      {
        date: "2025-01-30",
        text: "Introduced",
        type: "introduction, reading-1",
      },
    ],
  );
  assert.deepEqual(normalizeActions(undefined), []);
});

// ---------------------------------------------------------------------------
// Whole-bill normalization
// ---------------------------------------------------------------------------

const sb243: OpenStatesBill = {
  id: "ocd-bill/abc",
  identifier: "SB 243",
  title: "Companion chatbots",
  session: "20252026",
  classification: ["bill"],
  from_organization: {
    id: "ocd-organization/senate",
    name: "Senate",
    classification: "upper",
  },
  jurisdiction: {
    id: "ocd-jurisdiction/country:us/state:ca/government",
    name: "California",
    classification: "state",
  },
  abstracts: [{ abstract: "Regulates companion chatbots.", note: "digest" }],
  actions: [
    {
      date: "2025-01-30",
      description: "Introduced",
      classification: ["introduction"],
    },
    {
      date: "2025-10-13",
      description: "Chaptered by Secretary of State, Chapter 677",
      classification: ["became-law"],
    },
  ],
  sponsorships: [
    {
      name: "Padilla",
      entity_type: "person",
      classification: "primary",
      primary: true,
      person: {
        id: "ocd-person/1",
        name: "Steve Padilla",
        party: "Democratic",
        current_role: {
          title: "Senator",
          org_classification: "upper",
          district: "18",
          division_id: "ocd-division/x",
        },
      },
    },
  ],
  versions: [
    {
      note: "Chaptered",
      date: "2025-10-13",
      links: [
        {
          url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB243",
          media_type: "text/html",
        },
      ],
    },
  ],
  sources: [
    {
      url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB243",
    },
  ],
  created_at: "2025-01-30T00:00:00Z",
  updated_at: "2025-10-14T12:00:00Z",
  openstates_url: "https://openstates.org/CA/bills/20252026/SB243/",
};

void test("California SB 243 normalizes with full jurisdiction metadata", () => {
  const normalized = normalizeBill(sb243, { stateCode: "ca" });

  assert.equal(normalized.billNumber, "CA SB 243 (2025-2026)");
  assert.equal(normalized.title, "Companion chatbots");
  assert.equal(normalized.chamber, "Senate");
  assert.equal(normalized.session, "20252026");
  assert.equal(normalized.stateCode, "CA");
  assert.equal(normalized.sponsor, "Steve Padilla (D-18)");
  assert.equal(normalized.status, "Chaptered into law");
  assert.equal(normalized.summary, "Regulates companion chatbots.");
  assert.equal(normalized.sourceWebsite, OPEN_STATES_SOURCE);
  assert.match(normalized.url, /leginfo\.legislature\.ca\.gov/);
  assert.equal(
    normalized.introducedDate?.toISOString(),
    "2025-01-30T00:00:00.000Z",
  );
  assert.equal(
    normalized.sourceUpdatedAt?.toISOString(),
    "2025-10-14T12:00:00.000Z",
  );
  assert.equal(normalized.actions.length, 2);
  assert.match(normalized.textLink!.url, /billTextClient/);
});

void test("a bill stripped of every optional field still normalizes", () => {
  const bare: OpenStatesBill = {
    id: "ocd-bill/bare",
    identifier: "AB 1",
    title: "A bare bill",
    session: "20252026",
    classification: ["bill"],
    jurisdiction: sb243.jurisdiction,
    created_at: "2025-01-05T00:00:00Z",
    updated_at: "2025-01-06T00:00:00Z",
    openstates_url: "https://openstates.org/CA/bills/20252026/AB1/",
  };

  const normalized = normalizeBill(bare, { stateCode: "ca" });
  assert.equal(normalized.billNumber, "CA AB 1 (2025-2026)");
  assert.equal(normalized.chamber, "Assembly");
  assert.equal(normalized.status, "Unknown");
  assert.equal(normalized.sponsor, undefined);
  assert.equal(normalized.summary, undefined);
  assert.equal(normalized.textLink, undefined);
  assert.deepEqual(normalized.actions, []);
  // With no introduction action, the source's creation date stands in.
  assert.equal(
    normalized.introducedDate?.toISOString(),
    "2025-01-05T00:00:00.000Z",
  );
  assert.equal(normalized.url, bare.openstates_url);
});

void test("a bill with no stable identifier is refused, not stored", () => {
  assert.throws(
    () => normalizeBill({ ...sb243, identifier: "???" }, { stateCode: "ca" }),
    UnnormalizableBillError,
  );
});

void test("a bill with no title is refused", () => {
  assert.throws(
    () => normalizeBill({ ...sb243, title: "   " }, { stateCode: "ca" }),
    UnnormalizableBillError,
  );
});
