import type {
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";
import { campaignFinanceSchema } from "@acme/validators";

import { selectFecFilingContributions } from "./fec-filing-transactions.js";
import { evidence, rowSource } from "./finance.js";
import { field, hash, money } from "./sources.js";

type Get = (
  url: string,
  format: ResearchSource["format"],
  keyed?: boolean,
) => Promise<ResearchSource>;
export function fecBatchUrl(
  path: string,
  cycle: number,
  filter: "candidate_id" | "committee_id",
  ids: string[],
): string {
  if (
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !/^[HC][A-Z0-9]{8}$/.test(id))
  )
    throw new Error("Invalid bounded FEC batch identities");
  const url = new URL(`https://api.open.fec.gov/v1/${path}`);
  url.searchParams.set("cycle", String(cycle));
  for (const id of [...new Set(ids)].sort())
    url.searchParams.append(filter, id);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", "1");
  return url.toString();
}
export function exactFecRows(
  source: ResearchSource,
): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(source.text);
  if (!parsed || typeof parsed !== "object")
    throw new Error("Invalid FEC page");
  const { results, pagination } = parsed as {
    results?: unknown;
    pagination?: Record<string, unknown>;
  };
  if (
    !Array.isArray(results) ||
    results.length > 100 ||
    pagination?.is_count_exact !== true ||
    pagination.page !== 1 ||
    (pagination.pages !== (results.length ? 1 : 0) && pagination.pages !== 1) ||
    pagination.count !== results.length ||
    results.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  )
    throw new Error("FEC batch is not exactly exhausted");
  return results as Record<string, unknown>[];
}
export function applyIndependentExpenditures(input: {
  source: ResearchSource;
  candidateId: string;
  candidateIds: string[];
  cycle: number;
  finance: CampaignFinance;
  sources: ResearchSource[];
  evidence: CandidateBrief["evidence"];
}) {
  if (!input.candidateIds.includes(input.candidateId))
    throw new Error("Independent expenditure candidate is outside query scope");
  const expected = fecBatchUrl(
    "schedules/schedule_e/by_candidate/",
    input.cycle,
    "candidate_id",
    input.candidateIds,
  );
  if (input.source.url !== expected)
    throw new Error(
      "Independent expenditure scope differs from requested candidate batch",
    );
  const rows = exactFecRows(input.source);
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      !input.candidateIds.includes(String(row.candidate_id)) ||
      row.cycle !== input.cycle ||
      !["S", "O"].includes(String(row.support_oppose_indicator)) ||
      !Number.isInteger(row.count) ||
      Number(row.count) < 1 ||
      !/^C\d{8}$/.test(String(row.committee_id))
    )
      throw new Error(
        "Independent expenditure aggregate outside verified scope",
      );
    money(row.total);
    const id = `${String(row.candidate_id)}:${String(row.committee_id)}:${String(row.support_oppose_indicator)}`;
    if (seen.has(id))
      throw new Error("Duplicate independent expenditure aggregate");
    seen.add(id);
  }
  const selected = rows.filter((row) => row.candidate_id === input.candidateId);
  if (selected.length > 10)
    throw new Error(
      "Independent expenditure spender coverage exceeds source bound",
    );
  const outside: NonNullable<CampaignFinance["outsideSpending"]> = [];
  const refs: string[] = [];
  let count = 0;
  let support = 0;
  let oppose = 0;
  for (const row of selected) {
    const id = `${input.candidateId}:outside:${String(row.committee_id)}:${String(row.support_oppose_indicator)}`;
    const child = rowSource(input.source, row, id);
    input.sources.push(child);
    const citation = evidence(
      child,
      id,
      "Processed independent expenditures",
      child.text,
      "primary_record",
      `FEC processed periodic Schedule E aggregate; ${input.cycle - 1}–${input.cycle} cycle; spender and direction`,
    );
    citation.shows =
      "The processed periodic-report aggregate for this spender and candidate. This is separate from campaign receipts and spending.";
    citation.limits =
      "The cycle window is independent of the campaign summary cutoff. Newly filed reports may not yet be processed; notices are not added to periodic totals.";
    input.evidence.push(citation);
    refs.push(id);
    const amount = money(row.total);
    if (row.support_oppose_indicator === "S") support += amount;
    else oppose += amount;
    count += Number(row.count);
    outside.push({
      id,
      spender: field(row, "committee_name"),
      direction: row.support_oppose_indicator === "S" ? "support" : "oppose",
      amountCents: amount,
      evidenceIds: [id],
    });
  }
  const scopeId = `${input.candidateId}:outside:scope`;
  if (input.source.text.length > 4000)
    throw new Error(
      "Independent expenditure query proof exceeds evidence bound",
    );
  input.evidence.push(
    evidence(
      input.source,
      scopeId,
      "Processed independent expenditure query",
      input.source.text,
      "primary_record",
      `Exactly exhausted ${input.cycle} candidate-scoped aggregate query; requested IDs include ${input.candidateId}`,
    ),
  );
  refs.push(scopeId);
  input.finance.outsideSpending = outside;
  if (!input.finance.observation)
    throw new Error("Finance observation missing");
  input.finance.observation.independentExpenditures = {
    status: "available",
    basis: "processed_periodic_reports",
    completeness: "complete",
    periodStart: `${input.cycle - 1}-01-01`,
    periodEnd: `${input.cycle}-12-31`,
    updatedAt: input.source.fetchedAt,
    evidenceIds: refs,
    supportCents: support,
    opposeCents: oppose,
    transactionCount: count,
  };
}

export async function applyReportedContributions(input: {
  source: ResearchSource;
  committeeIds: string[];
  candidateId: string;
  cycle: number;
  finance: CampaignFinance;
  get: Get;
  sources: ResearchSource[];
  evidence: CandidateBrief["evidence"];
  layout: readonly string[];
}) {
  const url = new URL(input.source.url);
  const scopedCommittees = url.searchParams.getAll("committee_id");
  if (
    url.origin !== "https://api.open.fec.gov" ||
    url.pathname !== "/v1/reports/house-senate/" ||
    url.searchParams.get("cycle") !== String(input.cycle) ||
    url.searchParams.get("most_recent") !== "true" ||
    input.committeeIds.some((id) => !scopedCommittees.includes(id))
  )
    throw new Error(
      "Processed financial report query differs from verified committee scope",
    );
  const rows = exactFecRows(input.source);
  if (rows.some((row) => !scopedCommittees.includes(String(row.committee_id))))
    throw new Error("Processed report belongs to an unrequested committee");
  const filings = new Set<string>();
  for (const row of rows) {
    if (
      !/^C\d{8}$/.test(String(row.committee_id)) ||
      !Number.isSafeInteger(row.file_number) ||
      Number(row.file_number) <= 0 ||
      row.report_form !== "Form 3"
    )
      throw new Error(
        "Processed report index contains an invalid filing identity",
      );
    if (
      row.cycle !== input.cycle ||
      row.most_recent !== true ||
      row.is_amended !== false ||
      Number(row.most_recent_file_number) !== row.file_number
    )
      throw new Error("Financial report is not a latest processed amendment");
    const key = `${String(row.committee_id)}:${String(row.file_number)}`;
    if (filings.has(key))
      throw new Error(
        "Processed report index contains a duplicate filing identity",
      );
    filings.add(key);
  }
  const selected = rows.filter((row) =>
    input.committeeIds.includes(String(row.committee_id)),
  );
  if (!selected.length) return false;
  const latest = new Map<string, Record<string, unknown>>();
  const periods = new Set<string>();
  for (const row of selected) {
    const start = field(row, "coverage_start_date").slice(0, 10);
    const end = field(row, "coverage_end_date").slice(0, 10);
    if (
      start > end ||
      start < `${input.cycle - 1}-01-01` ||
      end > `${input.cycle}-12-31`
    )
      throw new Error("Report coverage outside cycle");
    const key = `${String(row.committee_id)}:${start}:${end}`;
    if (periods.has(key))
      throw new Error("Ambiguous processed report amendment");
    periods.add(key);
    const prior = latest.get(String(row.committee_id));
    if (!prior || end > String(prior.coverage_end_date).slice(0, 10))
      latest.set(String(row.committee_id), row);
  }
  if (latest.size !== input.committeeIds.length || latest.size > 3)
    throw new Error("Authorized committee report coverage incomplete");
  const index = {
    query: {
      cycle: input.cycle,
      committee_ids: scopedCommittees,
      most_recent: true,
    },
    pagination: (JSON.parse(input.source.text) as { pagination: unknown })
      .pagination,
    reports: rows.map((row) => ({
      committee_id: row.committee_id,
      file_number: row.file_number,
      report_form: row.report_form,
    })),
  };
  const readableIndex = JSON.stringify(index, null, 2);
  const indexText =
    readableIndex.length <= 4000 ? readableIndex : JSON.stringify(index);
  if (indexText.length > 4000)
    throw new Error("Processed report index proof exceeds evidence bound");
  const indexSource: ResearchSource = {
    ...input.source,
    id: `${input.candidateId}:financial-report-index`,
    text: indexText,
    contentHash: hash(indexText),
  };
  input.sources.push(indexSource);
  input.evidence.push(
    evidence(
      indexSource,
      indexSource.id,
      "Complete processed financial report index",
      indexSource.text,
      "primary_record",
      "Exactly exhausted FEC report query; every returned filing identity and original pagination",
    ),
  );
  const donors: CampaignFinance["donors"] = [];
  const refs: string[] = [];
  const filingNumbers: number[] = [];
  let start = "9999-12-31";
  let end = "0000-01-01";
  for (const row of [...latest.values()].sort((a, b) =>
    String(a.committee_id).localeCompare(String(b.committee_id)),
  )) {
    const fileNumber = Number(row.file_number);
    const raw = await input.get(
      `https://docquery.fec.gov/dcdev/posted/${fileNumber}.fec`,
      "text",
    );
    const report = {
      committeeId: field(row, "committee_id"),
      fileNumber,
      periodStart: field(row, "coverage_start_date").slice(0, 10),
      periodEnd: field(row, "coverage_end_date").slice(0, 10),
    };
    const parsed = selectFecFilingContributions({
      source: raw,
      report,
      candidateId: input.candidateId,
      limit: 10 - donors.length,
      layout: input.layout,
    });
    donors.push(...parsed.donors);
    input.sources.push(...parsed.sources);
    input.evidence.push(...parsed.evidence);
    const source = rowSource(
      input.source,
      {
        committee_id: report.committeeId,
        file_number: fileNumber,
        coverage_start_date: report.periodStart,
        coverage_end_date: report.periodEnd,
        most_recent: true,
        is_amended: false,
        report_form: "Form 3",
      },
      `${input.candidateId}:report:${fileNumber}`,
    );
    input.sources.push(source);
    input.evidence.push(
      evidence(
        source,
        source.id,
        "Latest processed financial report",
        source.text,
        "primary_record",
        `FEC processed reports index; selected latest coverage for authorized committee ${report.committeeId}`,
      ),
    );
    refs.push(source.id, ...parsed.evidence.map((citation) => citation.id));
    filingNumbers.push(fileNumber);
    if (report.periodStart < start) start = report.periodStart;
    if (report.periodEnd > end) end = report.periodEnd;
  }
  if (!input.finance.observation)
    throw new Error("Finance observation missing");
  input.finance.donors = donors;
  input.finance.donorAmounts = "contribution";
  input.finance.donorCoverage = "selected";
  input.finance.observation.donorSelection = {
    status: "available",
    basis: "selected_filing_transactions",
    periodStart: start,
    periodEnd: end,
    updatedAt: input.source.fetchedAt,
    evidenceIds: refs,
    filingNumbers,
    limit: 10,
    selection:
      "Up to 10 positive, non-memo Schedule A contribution transactions across authorized committees' latest processed Form 3 filings. Committees are ordered by ID; transactions within each filing are ordered by receipt date descending then transaction ID. Repeated names are not combined; this is not a top-donor ranking or a cycle-wide donor list.",
  };
  input.finance.observation.filingStatus = {
    status: "available",
    basis: "official_filing_index",
    kind: "financial_reports",
    latestForm: "Form 3",
    observedForms: [
      `Form 3 (${selected.length} ${selected.length === 1 ? "filing" : "filings"})`,
    ],
    statement: null,
    periodStart: start,
    periodEnd: end,
    updatedAt: input.source.fetchedAt,
    evidenceIds: [
      indexSource.id,
      ...refs.filter((id) => id.includes(":report:")),
    ],
  };
  campaignFinanceSchema.parse(input.finance);
  return true;
}

export async function collectCommitteeReportingStatus(input: {
  index: ResearchSource;
  committeeId: string;
  committeeName: string;
  candidateId: string;
  cycle: number;
  get: Get;
  sources: ResearchSource[];
  evidence: CandidateBrief["evidence"];
}): Promise<CampaignFinance> {
  const url = new URL(input.index.url);
  if (
    url.origin !== "https://api.open.fec.gov" ||
    url.pathname !== "/v1/filings/" ||
    url.searchParams.getAll("committee_id").join() !== input.committeeId ||
    url.searchParams.get("cycle") !== String(input.cycle)
  )
    throw new Error(
      "Filing status index scope differs from verified committee",
    );
  const rows = exactFecRows(input.index);
  if (
    !rows.length ||
    rows.some(
      (row) =>
        !["F1", "F99"].includes(String(row.form_type)) ||
        row.most_recent !== true,
    )
  )
    throw new Error(
      "Filing index does not establish a committee without financial reports",
    );
  const statements = rows
    .filter((row) => row.form_type === "F99")
    .sort(
      (a, b) =>
        String(b.receipt_date).localeCompare(String(a.receipt_date)) ||
        Number(b.file_number) - Number(a.file_number),
    );
  const latest = statements[0];
  if (!latest || !Number.isSafeInteger(latest.file_number))
    throw new Error("No latest committee statement");
  const raw = await input.get(
    `https://docquery.fec.gov/dcdev/posted/${String(latest.file_number)}.fec`,
    "text",
  );
  const lines = raw.text.split(/\r?\n/);
  const form = lines[1]?.split("\u001c");
  if (form?.[0] !== "F99" || form[1] !== input.committeeId)
    throw new Error("Committee statement identity mismatch");
  const statement = /\[BEGINTEXT\]\s*([\s\S]*?)\s*\[ENDTEXT\]/.exec(
    raw.text,
  )?.[1];
  if (
    !statement ||
    statement.length > 3500 ||
    !statement.includes(input.committeeId) ||
    !/has not received contributions or made expenditures aggregating in excess of \$5,000/.test(
      statement,
    )
  )
    throw new Error(
      "Committee statement does not establish threshold reporting status",
    );
  const date = /through ([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(statement)?.[1];
  const parsed = date ? new Date(date + " 00:00:00 UTC") : null;
  if (!parsed || !Number.isFinite(parsed.getTime()))
    throw new Error("Committee statement coverage unavailable");
  const periodEnd = parsed.toISOString().slice(0, 10);
  if (
    periodEnd < `${input.cycle - 1}-01-01` ||
    periodEnd > `${input.cycle}-12-31`
  )
    throw new Error("Committee statement outside cycle");
  const id = `${input.candidateId}:reporting-status`;
  const citation = evidence(
    raw,
    id,
    "Committee reporting-threshold statement",
    statement,
    "primary_record",
    `Form 99, file ${String(latest.file_number)}; committee statement, not a financial total`,
  );
  citation.documentDate = String(latest.receipt_date).slice(0, 10);
  citation.shows =
    "The committee states that it had not crossed the reporting threshold through the stated date.";
  citation.limits =
    "This statement does not establish exact receipts, exact spending, zero donations or zero outside spending.";
  input.evidence.push(citation);
  const indexId = `${input.candidateId}:filing-index`;
  const indexSource = rowSource(
    input.index,
    {
      committee_id: input.committeeId,
      exact_count: rows.length,
      filings: rows.map((row) => ({
        file_number: row.file_number,
        form_type: row.form_type,
        receipt_date: row.receipt_date,
      })),
    },
    indexId,
  );
  input.sources.push(indexSource);
  input.evidence.push(
    evidence(
      indexSource,
      indexId,
      "Official committee filing index",
      indexSource.text,
      "primary_record",
      "Exactly exhausted committee-scoped FEC filing index; observed forms only",
    ),
  );
  const unavailable = (reason: string) => ({
    status: "unavailable" as const,
    reason,
    evidenceIds: [id, indexId],
  });
  return campaignFinanceSchema.parse({
    committeeId: input.committeeId,
    committeeName: form[2] || input.committeeName,
    periodStart: `${input.cycle - 1}-01-01`,
    periodEnd,
    currency: "USD",
    coverage: "partial",
    coverageNote:
      "The committee's official Form 99 describes its reporting status. No financial report was present in the exactly exhausted filing index. Exact campaign totals and donors remain unavailable; they are not zero.",
    updatedAt: raw.fetchedAt,
    filingEvidenceIds: [id, indexId],
    receipts: null,
    donors: [],
    donorCoverage: "unavailable",
    donorAmounts: "contribution",
    outsideSpending: null,
    observation: {
      schemaVersion: 1,
      summary: unavailable(
        "The observed filing index contains no Form 3 financial report; the committee's threshold statement supplies no exact financial totals.",
      ),
      donorSelection: unavailable(
        "No itemized contribution schedule can be selected because the observed filing index contains no financial report.",
      ),
      independentExpenditures: unavailable(
        "Processed independent expenditures have not been retrieved.",
      ),
      filingStatus: {
        status: "available",
        basis: "official_filing_index",
        kind: "committee_threshold_statement",
        latestForm: "F99",
        observedForms: [...new Set(rows.map((row) => String(row.form_type)))]
          .sort()
          .map((form) => {
            const count = rows.filter((row) => row.form_type === form).length;
            return `${form} (${count} ${count === 1 ? "filing" : "filings"})`;
          }),
        statement,
        periodStart: `${input.cycle - 1}-01-01`,
        periodEnd,
        updatedAt: raw.fetchedAt,
        evidenceIds: [id, indexId],
      },
    },
  });
}
