import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  authorCaliforniaBrief,
  californiaModelInput,
} from "./california-ai.js";
import { buildCaliforniaDossier } from "./california-dossier.js";
import { fixtureDossier } from "./california-dossier.test.js";

async function financialProfile(records: number, financial = true) {
  const original = fixtureDossier();
  const excerpt = "Fixture processed financial record ".padEnd(2800, "x");
  const text = `${original.sources[0]!.text} ${excerpt}`;
  const dossier = buildCaliforniaDossier({
    ...original,
    officeKind: "federal_legislative",
    sources: [
      {
        ...original.sources[0]!,
        text,
        contentHash: createHash("sha256").update(text).digest("hex"),
      },
    ],
    evidence: [
      ...original.evidence,
      ...Array.from({ length: records }, (_, index) => ({
        ...original.evidence[0]!,
        id: `finance-${index}`,
        excerpt,
        role: financial ? ("finance" as const) : ("candidate_record" as const),
        identityQualification: "exact_election_office" as const,
      })),
    ],
    finance: financial
      ? {
          committeeId: "C00000001",
          committeeName: "Fixture committee",
          periodStart: "2025-01-01",
          periodEnd: "2026-09-30",
          currency: "USD",
          coverage: "partial",
          coverageNote: "Fixture processed record",
          updatedAt: original.createdAt,
          filingEvidenceIds: ["finance-0"],
          receipts: {
            totalCents: 10000,
            breakdown: {
              individuals: 10000,
              committees: 0,
              self_contributions: 0,
              candidate_loans: 0,
              transfers: 0,
              other: 0,
            },
            refundsCents: null,
          },
          donors: [],
          donorCoverage: "unavailable",
          outsideSpending: null,
        }
      : null,
  });
  const empty = () => ({ claims: [] });
  const authored = await authorCaliforniaBrief(
    { dossier, policyVersion: "policy" },
    {
      now: () => original.createdAt,
      invoke: async () => ({
        output: {
          priorities: {
            claims: [
              {
                kind: "promise",
                text: "Morgan Lee proposes funding public libraries.",
                evidenceIds: ["platform"],
                promiseDetails: null,
              },
            ],
          },
          record: empty(),
          mechanisms: empty(),
          effects: empty(),
          tradeoffs: empty(),
          unknowns: empty(),
          terms: [],
        },
        configuredModel: "fixture",
        actualModel: "fixture",
        provider: "fixture",
        requestId: "fixture",
        usage: { inputTokens: 1, outputTokens: 1 },
        costUsd: null,
      }),
    },
  );
  return { dossier, brief: authored.brief, policyVersion: "policy" };
}

test("a larger complete financial review retains every source passage and brief field", async () => {
  const input = await financialProfile(20);
  const packet = californiaModelInput(input);
  assert(packet.bytes > 120_000 && packet.bytes <= 160_000);
  const projected = JSON.parse(packet.prompt);
  assert.deepEqual(projected.brief, input.brief);
  assert.deepEqual(projected.dossier.evidence, input.dossier.evidence);
  assert.equal(projected.dossier.sources[0].contextWindows[0].start, 0);
  assert.equal(
    projected.dossier.sources[0].contextWindows[0].text,
    input.dossier.sources[0]!.text,
  );
  assert.equal(packet.bytes, Buffer.byteLength(packet.prompt));
  assert.equal(packet.inputTokenReservation, packet.bytes + 20_000);
});

test("larger financial review capacity never applies to author correction packets", async () => {
  const { dossier } = await financialProfile(20);
  assert.throws(
    () =>
      californiaModelInput({
        dossier,
        policyVersion: "policy",
        correction: {
          kind: "author_validation",
          previousOutput: { record: "界".repeat(40_001) },
          validationProblems: ["Fixture correction"],
        },
      }),
    /exceeds byte budget/,
  );
});

test("the financial review cap still rejects an oversized complete packet", async () => {
  const input = await financialProfile(30);
  assert.throws(() => californiaModelInput(input), /exceeds byte budget/);
});

test("ordinary nonfinancial reviewer packets retain their original byte cap", async () => {
  const input = await financialProfile(20, false);
  assert.throws(() => californiaModelInput(input), /exceeds byte budget/);
});
