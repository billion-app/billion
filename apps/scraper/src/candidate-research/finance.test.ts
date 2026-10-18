import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateBrief, ResearchSource } from "@acme/validators";
import { campaignFinanceSchema } from "@acme/validators";

import { buildFinance } from "./finance.js";
import { hash } from "./sources.js";

const candidateId = "H4CA12055";
const committeeId = "C00503185";
function source(id: string, results: unknown[]): ResearchSource {
  const text = JSON.stringify(
    { results, pagination: { count: results.length, pages: 1 } },
    null,
    2,
  );
  return {
    id,
    url: `https://api.open.fec.gov/v1/${id}/`,
    publisher: "Synthetic fixture",
    format: "json",
    text,
    contentHash: hash(text),
    fetchedAt: new Date().toISOString(),
  };
}
function input() {
  return {
    candidateId,
    metadata: source("identity", [
      {
        candidate_id: candidateId,
        state: "CA",
        district: "17",
        office: "H",
        cycles: [2026],
      },
    ]),
    committees: source("committees", [
      {
        designation: "P",
        candidate_ids: [candidateId],
        committee_id: committeeId,
        name: "Synthetic committee",
      },
    ]),
    totals: source("totals", [
      {
        candidate_id: candidateId,
        cycle: 2026,
        coverage_start_date: "2025-01-01",
        coverage_end_date: "2026-06-30",
        receipts: 300,
        contribution_refunds: 10,
        individual_contributions: 200,
        other_political_committee_contributions: 100,
        political_party_committee_contributions: 0,
        candidate_contribution: 0,
        loans_made_by_candidate: 0,
        transfers_from_other_authorized_committee: 0,
        all_other_loans: 0,
        offsets_to_operating_expenditures: 0,
        other_receipts: 0,
      },
    ]),
    receipts: [
      source("receipts", [
        {
          sub_id: "one",
          committee_id: committeeId,
          line_number: "11AI",
          contribution_receipt_amount: 50,
          contribution_receipt_date: "2026-05-01",
          contributor_name: "Synthetic donor",
          entity_type: "IND",
          file_number: 1,
          transaction_id: "t1",
          pdf_url: "https://docquery.fec.gov/fixture.pdf",
        },
      ]),
    ],
    outside: source("outside", [
      {
        sub_id: "outside-one",
        candidate_id: candidateId,
        most_recent: true,
        is_notice: false,
        expenditure_amount: 25,
        expenditure_date: "2026-05-02",
        support_oppose_indicator: "O",
        committee_id: "C00000001",
        committee: { name: "Synthetic independent committee" },
        file_number: 2,
        transaction_id: "t2",
      },
    ]),
    sources: [] as ResearchSource[],
    evidence: [] as CandidateBrief["evidence"],
  };
}
void test("processed finance keeps payments, refunds and outside spending separate", () => {
  const collected = input();
  const finance = campaignFinanceSchema.parse(buildFinance(collected));
  assert.equal(finance.receipts?.totalCents, 30000);
  assert.equal(finance.receipts?.refundsCents, 1000);
  assert.equal(finance.donors[0]?.amountCents, 5000);
  assert.equal(finance.donorAmounts, "contribution");
  assert.equal(finance.outsideSpending?.[0]?.direction, "oppose");
  assert.equal(finance.outsideSpending[0]?.amountCents, 2500);
  const quote = collected.evidence.find((e) => e.id.includes(":receipt:"));
  assert.ok(quote);
  assert.equal(quote.url, collected.receipts[0]?.url);
  assert.equal(quote.filingUrl, "https://docquery.fec.gov/fixture.pdf");
  assert.ok(
    collected.sources.some(
      (s) =>
        s.url === quote.url &&
        s.contentHash === quote.contentHash &&
        s.text.includes(quote.excerpt),
    ),
  );
});
void test("wrong committee ownership or reporting dates reject a financial snapshot", () => {
  for (const changed of [
    { committee_id: "C99999999" },
    { contribution_receipt_date: "2026-08-01" },
  ]) {
    const collected = input();
    const parsed = JSON.parse(collected.receipts[0]!.text);
    Object.assign(parsed.results[0], changed);
    collected.receipts[0] = source("receipts", parsed.results);
    assert.throws(() => buildFinance(collected));
  }
  const collected = input();
  collected.committees = source("committees", [
    {
      designation: "P",
      candidate_ids: ["H00000000"],
      committee_id: committeeId,
      name: "Different candidate",
    },
  ]);
  assert.throws(() => buildFinance(collected));
});
