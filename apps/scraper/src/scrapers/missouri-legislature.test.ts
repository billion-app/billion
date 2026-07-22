import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CreateBillSchema } from "@acme/db/schema";

import {
  missouriCommitteesFromActions,
  missouriEffectiveDateFromActions,
  parseMissouriBill,
  parseMissouriBillList,
  parseMissouriSenateActionList,
  parseMissouriSessions,
} from "./missouri-legislature-parser.js";
import { missouriRefreshExpiresAt } from "./missouri-legislature-source.js";

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

void test("uses an exact 30-minute durable refresh expiration", () => {
  assert.equal(
    missouriRefreshExpiresAt(
      new Date("2026-07-22T18:00:00.000Z"),
    ).toISOString(),
    "2026-07-22T18:30:00.000Z",
  );
});

void test("discovers enabled regular and special sessions from SessionSet.js", async () => {
  assert.deepEqual(
    parseMissouriSessions(await fixture("missouri-session-set.js")),
    [
      {
        code: "261",
        baseUrl: "https://documents.house.mo.gov/xml/261-",
        kind: "regular",
      },
      {
        code: "263",
        baseUrl: "https://documents.house.mo.gov/xml/263-",
        kind: "special",
      },
      {
        code: "264",
        baseUrl: "https://documents.house.mo.gov/xml/264-",
        kind: "special",
      },
    ],
  );
});

void test("parses stable bill-list versions for changed-row filtering", async () => {
  const entries = parseMissouriBillList(
    await fixture("missouri-bill-list.xml"),
  );
  assert.equal(entries[0]?.billNumber, "HB 42");
  assert.equal(entries[0]?.sourceVersion, "07-22-2026 10:30:48.253");
  assert.equal(
    entries[0]?.sourceUpdatedAt?.toISOString(),
    "2026-07-22T15:30:48.253Z",
  );
  const persisted = new Map([["HB 42", entries[0]!.sourceVersion]]);
  assert.deepEqual(
    entries
      .filter(
        (entry) => persisted.get(entry.billNumber) !== entry.sourceVersion,
      )
      .map((entry) => entry.billNumber),
    ["HJR 7"],
  );
});

void test("normalizes Missouri sponsors, actions, committees, dates, votes, and documents", async () => {
  const bill = parseMissouriBill(await fixture("missouri-hb42.xml"), {
    session: "261",
    sourceVersion: "07-22-2026 10:30:48.253",
    sourceUpdatedAt: new Date("2026-07-22T15:30:48.253Z"),
    coverage: "complete_house_export",
  });
  assert.equal(bill.billNumber, "HB 42");
  assert.equal(bill.sponsor, "Jamie Example");
  assert.equal(missouriEffectiveDateFromActions(bill.actions), "2026-08-28");
  assert.deepEqual(missouriCommitteesFromActions(bill.actions), [
    "Crime Prevention and Public Safety",
  ]);
  assert.deepEqual(bill.votes[0]?.counts, [
    { option: "Yes", value: 10 },
    { option: "No", value: 2 },
    { option: "Present", value: 1 },
  ]);
  assert.deepEqual(
    bill.documents.map((document) => document.type),
    ["bill_text", "analysis", "fiscal_note", "analysis", "analysis"],
  );
  assert.equal(
    CreateBillSchema.safeParse({
      ...bill,
      sourceWebsite: "documents.house.mo.gov",
    }).success,
    true,
  );
});

void test("labels SenateActList rows as House-actions-only coverage", async () => {
  const [bill] = parseMissouriSenateActionList(
    await fixture("missouri-senate-actions.xml"),
    "261",
    "sha256:fixture",
    new Date("2026-07-22T18:00:00.000Z"),
  );
  assert.equal(bill?.billNumber, "SB 9");
  assert.equal(bill?.chamber, "Senate");
  assert.equal(bill?.versions[0]?.changes, "senate_with_house_actions_only");
  assert.equal(bill?.versions[0]?.updatedAt, "2026-07-22T18:00:00.000Z");
  assert.deepEqual(missouriCommitteesFromActions(bill?.actions ?? []), [
    "Health and Mental Health",
  ]);
});
