import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CreateBillSchema } from "@acme/db/schema";

import {
  htmlToText,
  openStatesSessionName,
  parseTexasBillHistory,
} from "./texas-legislature-parser.js";
import {
  bulkHtmlPath,
  listFilesRecursively,
  selectCurrentTexasSession,
  type TexasBulkClient,
} from "./texas-legislature-source.js";

const fixture = await readFile(
  new URL("./fixtures/texas-hb9-history.xml", import.meta.url),
  "utf8",
);

void test("parses official-style Texas bill history deterministically", () => {
  const bill = parseTexasBillHistory(fixture, "89R");
  assert.equal(bill.billNumber, "HB 9");
  assert.equal(bill.chamber, "House");
  assert.equal(bill.legislativeSession, "89R");
  assert.equal(bill.sponsor, "Meyer | Bonnen | Bettencourt");
  assert.equal(bill.status, "Effective immediately");
  assert.equal(bill.introducedDate?.toISOString(), "2024-11-12T12:00:00.000Z");
  assert.deepEqual(
    bill.documents.map((document) => document.type),
    ["bill_text", "bill_text", "analysis", "fiscal_note"],
  );
  assert.deepEqual(bill.votes[0], {
    identifier: "RV#2999",
    date: "2025-05-19",
    chamber: "House",
    motion: "Record vote",
    counts: [],
    votes: [],
  });
  assert.deepEqual(bill.votes[1]?.counts, [
    { option: "Yea", value: 9 },
    { option: "Nay", value: 1 },
    { option: "Present not voting", value: 0 },
    { option: "Absent", value: 1 },
  ]);
});

void test("maps public document names to the official FTP bulk tree", () => {
  const bill = parseTexasBillHistory(fixture, "89R");
  assert.equal(
    bulkHtmlPath("89R", bill.documents[0]!),
    "/bills/89R/billtext/HTML/house_bills/HB00001_HB00099/HB00009I.HTM",
  );
  assert.equal(
    bulkHtmlPath("89R", bill.documents.at(-1)!),
    "/bills/89R/fiscalNotes/HTML/house_bills/HB00001_HB00099/HB00009I.HTM",
  );
});

void test("selects only the latest Texas session and maps Open States names", () => {
  assert.equal(selectCurrentTexasSession(["88R", "89R", "891", "892"]), "892");
  assert.equal(openStatesSessionName("89R"), "89");
  assert.equal(openStatesSessionName("892"), "892");
});

void test("walks bulk directories in stable lexical order", async () => {
  const listings: Record<string, { name: string; isDirectory: boolean }[]> = {
    "/root": [
      { name: "z.xml", isDirectory: false },
      { name: "a", isDirectory: true },
    ],
    "/root/a": [{ name: "b.xml", isDirectory: false }],
  };
  const client: TexasBulkClient = {
    list: async (path) => listings[path] ?? [],
    download: async () => Buffer.alloc(0),
    close: () => undefined,
  };
  assert.deepEqual(await listFilesRecursively(client, "/root"), [
    "/root/a/b.xml",
    "/root/z.xml",
  ]);
});

void test("extracts readable deterministic text from bulk HTML", () => {
  assert.equal(
    htmlToText("<html><style>x</style><body><h1>Bill text</h1><p>Section 1.</p></body></html>"),
    "Bill text Section 1.",
  );
});

void test("parsed Texas data satisfies the shared persisted bill contract", () => {
  const parsed = parseTexasBillHistory(fixture, "89R");
  assert.equal(
    CreateBillSchema.safeParse({
      ...parsed,
      sourceWebsite: "capitol.texas.gov",
    }).success,
    true,
  );
});
