import type {
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";

import {
  fecRows,
  field,
  hash,
  money,
  processedTransactions,
} from "./sources.js";

type Evidence = CandidateBrief["evidence"][number];
export function evidence(
  source: ResearchSource,
  id: string,
  title: string,
  excerpt: string,
  origin: Evidence["origin"] = "primary_record",
  locator = "Collected source text",
): Evidence {
  if (!source.text.includes(excerpt) || excerpt.length > 4000)
    throw new Error(`Quote missing in ${id}`);
  return {
    id,
    title,
    url: source.url,
    publisher: source.publisher,
    locator,
    origin,
    excerpt,
    contentHash: source.contentHash,
    retrievedAt: source.fetchedAt,
    documentDate: null,
  };
}
export function rowSource(
  parent: ResearchSource,
  row: Record<string, unknown>,
  id: string,
): ResearchSource {
  const text = JSON.stringify(row, null, 2);
  return {
    ...parent,
    id,
    text,
    contentHash: hash(text),
    url: parent.url,
  };
}
export function buildFinance(input: {
  candidateId: string;
  metadata: ResearchSource;
  totals: ResearchSource;
  committees: ResearchSource;
  receipts: ResearchSource[];
  outside: ResearchSource;
  sources: ResearchSource[];
  evidence: Evidence[];
}): CampaignFinance {
  const candidates = fecRows(input.metadata).results;
  const c = candidates[0];
  if (
    candidates.length !== 1 ||
    c?.candidate_id !== input.candidateId ||
    c.state !== "CA" ||
    c.district !== "17" ||
    c.office !== "H" ||
    !(c.cycles as unknown[])?.includes(2026)
  )
    throw new Error("FEC identity does not match the pilot");
  const totalRows = fecRows(input.totals).results;
  const t = totalRows[0];
  if (
    totalRows.length !== 1 ||
    t?.candidate_id !== input.candidateId ||
    t.cycle !== 2026
  )
    throw new Error("FEC totals missing or ambiguous");
  const committees = fecRows(input.committees).results.filter(
    (r) => r.designation === "P" || r.designation === "A",
  );
  if (
    !committees.length ||
    committees.some(
      (r) => !(r.candidate_ids as unknown[])?.includes(input.candidateId),
    )
  )
    throw new Error("Unverified candidate committee link");
  const committeeIds = committees.map((r) => field(r, "committee_id"));
  const totalSource = rowSource(input.totals, t, `${input.candidateId}:totals`);
  input.sources.push(totalSource);
  const filingId = totalSource.id;
  input.evidence.push(
    evidence(
      totalSource,
      filingId,
      "FEC processed campaign totals",
      totalSource.text,
      "primary_record",
      "Candidate totals, 2025–2026 cycle; latest processed amendments",
    ),
  );
  const periodStart = field(t, "coverage_start_date").slice(0, 10);
  const periodEnd = field(t, "coverage_end_date").slice(0, 10);
  const inPeriod = (date: string) =>
    date.slice(0, 10) >= periodStart && date.slice(0, 10) <= periodEnd;
  const donors: CampaignFinance["donors"] = [];
  const seen = new Set<string>();
  for (const receiptSource of input.receipts)
    for (const row of processedTransactions(receiptSource)) {
      if (!committeeIds.includes(field(row, "committee_id")))
        throw new Error("Receipt belongs to another committee");
      if (!inPeriod(field(row, "contribution_receipt_date")))
        throw new Error("Contribution outside reporting period");
      // Do not label refunds, loans, offsets, transfers or memo-only entries as donations.
      if (
        !["11AI", "11AII", "11B", "11C", "11D"].includes(
          String(row.line_number),
        ) ||
        Number(row.contribution_receipt_amount) <= 0
      )
        continue;
      const id = field(row, "sub_id");
      if (seen.has(id)) continue;
      seen.add(id);
      if (donors.length >= 20) continue;
      const source = rowSource(
        receiptSource,
        row,
        `${input.candidateId}:receipt:${id}`,
      );
      input.sources.push(source);
      const start = source.text.indexOf('"contribution_receipt_amount"');
      const excerpt = source.text.slice(
        Math.max(0, start),
        Math.max(0, start) + 3000,
      );
      const ev = evidence(
        source,
        source.id,
        "Itemized contribution",
        excerpt,
        "primary_record",
        `Processed Schedule A; file ${String(row.file_number)}, transaction ${String(row.transaction_id)}, sub-ID ${id}`,
      );
      if (typeof row.pdf_url === "string") ev.filingUrl = row.pdf_url;
      ev.documentDate = field(row, "contribution_receipt_date").slice(0, 10);
      ev.shows =
        "One reported contribution, not this person's total giving or proof of influence.";
      ev.limits =
        "A bounded selection of processed records; memo entries and non-contribution receipts are excluded. Interests and lobbying status require separate evidence.";
      input.evidence.push(ev);
      donors.push({
        id,
        name: field(row, "contributor_name"),
        type:
          row.entity_type === "IND"
            ? "individual"
            : ["COM", "PAC", "PTY", "CCM"].includes(String(row.entity_type))
              ? "committee"
              : row.entity_type === "ORG"
                ? "organization"
                : "unknown",
        amountCents: money(row.contribution_receipt_amount),
        evidenceIds: [ev.id],
        lobbying: null,
        interests: [],
        positions: [],
      });
    }
  const outside: NonNullable<CampaignFinance["outsideSpending"]> = [];
  for (const row of processedTransactions(input.outside).slice(0, 20)) {
    if (
      row.candidate_id !== input.candidateId ||
      row.most_recent !== true ||
      row.is_notice !== false
    )
      throw new Error("Invalid processed outside-spending record");
    if (Number(row.expenditure_amount) < 0)
      throw new Error(
        "Negative outside-spending adjustment requires reconciliation",
      );
    if (!inPeriod(field(row, "expenditure_date")))
      throw new Error("Outside spending outside reporting period");
    const id = field(row, "sub_id");
    const source = rowSource(
      input.outside,
      row,
      `${input.candidateId}:outside:${id}`,
    );
    input.sources.push(source);
    const start = source.text.indexOf('"expenditure_amount"');
    const ev = evidence(
      source,
      source.id,
      "Independent expenditure",
      source.text.slice(Math.max(0, start), Math.max(0, start) + 3000),
      "primary_record",
      `Processed Schedule E; file ${String(row.file_number)}, transaction ${String(row.transaction_id)}`,
    );
    if (typeof row.pdf_url === "string") ev.filingUrl = row.pdf_url;
    input.evidence.push(ev);
    const committee = row.committee as Record<string, unknown> | null;
    outside.push({
      id,
      spender: committee
        ? field(committee, "name")
        : field(row, "committee_id"),
      direction:
        row.support_oppose_indicator === "S"
          ? "support"
          : row.support_oppose_indicator === "O"
            ? "oppose"
            : "unspecified",
      amountCents: money(row.expenditure_amount),
      evidenceIds: [ev.id],
    });
  }
  return {
    committeeId: committeeIds.join(", "),
    committeeName: committees.map((r) => field(r, "name")).join("; "),
    periodStart: field(t, "coverage_start_date").slice(0, 10),
    periodEnd: field(t, "coverage_end_date").slice(0, 10),
    currency: "USD",
    coverage: "partial",
    coverageNote:
      "FEC processed totals include the latest processed amendments for authorized committees. Named contributions and outside-spending entries are bounded selections (up to 20 each), not exhaustive totals. Each donor row is one contribution; repeated names are not combined. Lobbying roles and interests have not been established. Newly filed reports may take time to appear.",
    updatedAt: input.totals.fetchedAt,
    filingEvidenceIds: [filingId],
    receipts: {
      totalCents: money(t.receipts),
      refundsCents: money(t.contribution_refunds),
      breakdown: {
        individuals: money(t.individual_contributions),
        committees:
          money(t.other_political_committee_contributions) +
          money(t.political_party_committee_contributions),
        self_contributions: money(t.candidate_contribution),
        candidate_loans: money(t.loans_made_by_candidate),
        transfers: money(t.transfers_from_other_authorized_committee),
        other:
          money(t.all_other_loans) +
          money(t.offsets_to_operating_expenditures) +
          money(t.other_receipts),
      },
    },
    donors,
    donorCoverage: "selected",
    donorAmounts: "contribution",
    outsideSpending: outside,
  };
}
