import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  BulkExportShapeError,
  parseCsv,
  parseCsvRecords,
  readBulkBills,
} from "./open-states-bulk.js";
import { normalizeBill } from "./open-states-normalize.js";

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

void test("quoted fields keep the commas that would otherwise shift columns", () => {
  // "Chaptered by Secretary of State, Chapter 677" is a real CA action text;
  // splitting on commas would push every later column one to the left.
  assert.deepEqual(
    parseCsv('a,b,c\n1,"Chaptered by Secretary of State, Chapter 677",3'),
    [
      ["a", "b", "c"],
      ["1", "Chaptered by Secretary of State, Chapter 677", "3"],
    ],
  );
});

void test("escaped quotes and embedded newlines survive", () => {
  assert.deepEqual(
    parseCsv('title,note\n"He said ""no""","line one\nline two"'),
    [
      ["title", "note"],
      ['He said "no"', "line one\nline two"],
    ],
  );
});

void test("CRLF files and missing trailing newlines parse the same", () => {
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
  assert.deepEqual(parseCsv("a,b\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

void test("a UTF-8 BOM does not become part of the first column name", () => {
  const [record] = parseCsvRecords("﻿id,title\n1,Something");
  assert.equal(record?.id, "1");
});

void test("short rows read as empty strings rather than undefined", () => {
  const [record] = parseCsvRecords("a,b,c\n1,2");
  assert.deepEqual(record, { a: "1", b: "2", c: "" });
});

// ---------------------------------------------------------------------------
// Export reading
// ---------------------------------------------------------------------------

function withExport(
  files: Record<string, string>,
  run: (directory: string) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "openstates-bulk-"));
  try {
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(directory, name), contents);
    }
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const BILLS_CSV = [
  "id,identifier,title,session,organization_classification,created_at,updated_at,openstates_url",
  "ocd-bill/abc,SB 243,Companion chatbots,20252026,upper,2025-01-30T00:00:00Z,2025-10-14T12:00:00Z,https://openstates.org/CA/bills/20252026/SB243/",
].join("\n");

void test("a full export rebuilds a bill the normalizer accepts", () => {
  withExport(
    {
      "CA_2025-2026_bills.csv": BILLS_CSV,
      "CA_2025-2026_bill_actions.csv": [
        "bill_id,date,description,classification",
        "ocd-bill/abc,2025-01-30,Introduced,introduction",
        'ocd-bill/abc,2025-10-13,"Chaptered by Secretary of State, Chapter 677",became-law',
      ].join("\n"),
      "CA_2025-2026_bill_abstracts.csv": [
        "bill_id,abstract,note",
        "ocd-bill/abc,Regulates companion chatbots.,digest",
      ].join("\n"),
      "CA_2025-2026_bill_sponsorships.csv": [
        "bill_id,name,entity_type,classification,primary,party,district",
        "ocd-bill/abc,Steve Padilla,person,primary,true,Democratic,18",
      ].join("\n"),
      "CA_2025-2026_bill_sources.csv": [
        "bill_id,url",
        "ocd-bill/abc,https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB243",
      ].join("\n"),
      "CA_2025-2026_bill_versions.csv": [
        "id,bill_id,note,date",
        "ocd-version/1,ocd-bill/abc,Chaptered,2025-10-13",
      ].join("\n"),
      "CA_2025-2026_bill_version_links.csv": [
        "version_id,url,media_type",
        "ocd-version/1,https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB243,text/html",
      ].join("\n"),
    },
    (directory) => {
      const [bill] = readBulkBills(directory);
      assert.ok(bill);

      // The whole point of the bulk path: it must land on the same row the
      // incremental API walk would produce, not a parallel one.
      const normalized = normalizeBill(bill, { stateCode: "ca" });
      assert.equal(normalized.billNumber, "CA SB 243 (2025-2026)");
      assert.equal(normalized.status, "Chaptered into law");
      assert.equal(normalized.chamber, "Senate");
      assert.equal(normalized.sponsor, "Steve Padilla (D-18)");
      assert.equal(normalized.summary, "Regulates companion chatbots.");
      assert.match(normalized.url, /leginfo\.legislature\.ca\.gov/);
      assert.match(normalized.textLink!.url, /billTextClient/);
      assert.equal(normalized.actions.length, 2);
    },
  );
});

void test("an export with only bills.csv still yields storable bills", () => {
  withExport({ "CA_2025-2026_bills.csv": BILLS_CSV }, (directory) => {
    const [bill] = readBulkBills(directory);
    const normalized = normalizeBill(bill!, { stateCode: "ca" });
    assert.equal(normalized.billNumber, "CA SB 243 (2025-2026)");
    assert.equal(normalized.status, "Unknown");
    assert.equal(normalized.sponsor, undefined);
    // Falls back to the Open States page when no sources table was exported.
    assert.equal(
      normalized.url,
      "https://openstates.org/CA/bills/20252026/SB243/",
    );
  });
});

void test("a renamed or reshaped export fails loudly with the columns it saw", () => {
  withExport(
    { "CA_2025-2026_bills.csv": "bill_id,name\nocd-bill/abc,Something" },
    (directory) => {
      assert.throws(
        () => readBulkBills(directory),
        (error: unknown) => {
          assert.ok(error instanceof BulkExportShapeError);
          // The operator needs to see both what was expected and what arrived.
          assert.match(error.message, /identifier/);
          assert.match(error.message, /bill_id, name/);
          return true;
        },
      );
    },
  );
});

void test("a directory that is not an export says so instead of importing nothing", () => {
  withExport({ "readme.txt": "not csv" }, (directory) => {
    assert.throws(() => readBulkBills(directory), /No bills\.csv found/);
  });
});
