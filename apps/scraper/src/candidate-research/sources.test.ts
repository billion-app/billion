import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchSource } from "@acme/validators";

import { profileFinance } from "./profile.js";
import { hash, htmlText, money, processedTransactions } from "./sources.js";

const source = (text: string): ResearchSource => ({
  id: "fixture",
  url: "https://www.fec.gov/data/candidate/H4CA12055/?cycle=2026",
  publisher: "Test fixture",
  text,
  contentHash: hash(text),
  format: "html",
  fetchedAt: new Date().toISOString(),
});
const summary =
  "KHANNA, ROHIT Candidate for House California - 17 ID: H4CA12055 Data is included from these committees: TEST COMMITTEE (C00503185) Total raised Coverage dates: 01/01/2025 to 06/30/2026 Total receipts $100.00 Total individual contributions $70.00 Party committee contributions $5.00 Other committee contributions $5.00 Candidate contributions $5.00 Transfers from other authorized committees $5.00 Loans made by candidate $5.00 Other loans $1.00 Offsets to operating expenditures $1.00 Other receipts $3.00 Newly filed summary data may not appear for up to 48 hours. Total contribution refunds $2.00";
const person = { fecId: "H4CA12055", fecName: "KHANNA, ROHIT" };
void test("public FEC fallback reconciles totals and keeps unavailable detail unknown", () => {
  const citations: Parameters<typeof profileFinance>[2] = [];
  const result = profileFinance(source(summary), person, citations);
  assert.equal(result.receipts?.totalCents, 10000);
  assert.equal(result.receipts?.refundsCents, 200);
  assert.equal(result.donorCoverage, "unavailable");
  assert.equal(result.outsideSpending, null);
  assert.equal(citations.length, 2);
  for (const quote of citations) assert.ok(summary.includes(quote.excerpt));
});
void test("changed identity, incomplete columns and unreconciled totals fail closed", () => {
  for (const text of [
    summary.replace("California - 17", "California - 18"),
    summary.replace("Other receipts $3.00", ""),
    summary.replace("Total receipts $100.00", "Total receipts $120.00"),
  ])
    assert.throws(() => profileFinance(source(text), person, []));
});
void test("processed transactions exclude memos, deduplicate exact rows, reject conflicts", () => {
  const row = {
    sub_id: "1",
    memo_code: null,
    memoed_subtotal: false,
    contribution_receipt_amount: 10,
  };
  const make = (results: unknown[]) =>
    source(
      JSON.stringify({
        results,
        pagination: { count: results.length, pages: 1 },
      }),
    );
  assert.deepEqual(
    processedTransactions(
      make([
        row,
        row,
        { ...row, sub_id: "2", memo_code: "X" },
        { ...row, sub_id: "3", memoed_subtotal: true },
      ]),
    ),
    [row],
  );
  assert.throws(() =>
    processedTransactions(
      make([row, { ...row, contribution_receipt_amount: 20 }]),
    ),
  );
});
void test("money rejects unknown, negative and fractional-cent values", () => {
  assert.equal(money(1.23), 123);
  for (const value of [null, undefined, -1, 1.001, Number.MAX_SAFE_INTEGER])
    assert.throws(() => money(value));
});
void test("HTML extraction retains candidate identity but drops executable and navigation text", () => {
  assert.equal(
    htmlText(
      "<main><header>Candidate identity</header><p>Source text</p><script>bad</script><nav>menu</nav></main>",
    ),
    "Candidate identitySource text",
  );
});

void test("derived API evidence retains the fetched URL, not an unfetched PDF", async () => {
  const { rowSource } = await import("./finance.js");
  const parent = source('{"results":[]}');
  parent.url = "https://api.open.fec.gov/v1/schedules/schedule_a/";
  const row = {
    pdf_url: "https://docquery.fec.gov/example.pdf",
    contribution_receipt_amount: 10,
  };
  const derived = rowSource(parent, row, "receipt");
  assert.equal(derived.url, parent.url);
  assert.equal(derived.contentHash, hash(derived.text));
  assert.ok(derived.text.includes(row.pdf_url));
});

void test("missing campaign pages produce an explicit-gap draft, not a dangling headline", async () => {
  const { draftBrief, pilot } = await import("./drafts.js");
  const { candidateBriefSchema, candidateResearchTemplateVersion } =
    await import("@acme/validators");
  const brief = candidateBriefSchema.parse(
    draftBrief({
      candidate: pilot.candidates[0],
      roster: source(
        "United States Representative District 17\nRo Khanna Democratic\nUnited States Representative District 18",
      ),
      metadata: source("Not used"),
      platform: null,
      powers: source("First, a representative sponsors a bill."),
      finance: null,
      financeGap: "Not collected in this fixture",
      evidence: [],
    }),
  );
  assert.equal(brief.research?.headlineClaimId, "authority");
  assert.equal(brief.research?.promises.length, 0);
  assert.equal(
    brief.sections.find((s) => s.topic === "record")?.claims.length,
    0,
  );
  assert.match(
    brief.sections.find((s) => s.topic === "priorities")?.missingEvidence ?? "",
    /could not be collected/,
  );
  assert.equal(brief.authorship.kind, "generated");
  if (brief.authorship.kind === "generated")
    assert.equal(
      brief.authorship.promptVersion,
      candidateResearchTemplateVersion,
    );
});
