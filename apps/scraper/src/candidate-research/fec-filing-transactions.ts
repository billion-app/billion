import type {
  CampaignFinance,
  CandidateBrief,
  ResearchSource,
} from "@acme/validators";

import { evidence, rowSource } from "./finance.js";
import { hash, money } from "./sources.js";

// FEC electronic filing format 8.5, Sch A columns 1–45.
export const fecScheduleALayout = [
  "form_type",
  "filer_committee_id_number",
  "transaction_id_number",
  "back_reference_transaction_id_number",
  "back_reference_schedule_name",
  "entity_type",
  "organization_name",
  "last_name",
  "first_name",
  "middle_name",
  "prefix",
  "suffix",
  "street_1",
  "street_2",
  "city",
  "state",
  "zip",
  "election_code",
  "election_other",
  "contribution_date",
  "contribution_amount",
  "contribution_aggregate",
  "contribution_purpose",
  "employer",
  "occupation",
  "donor_committee_id",
  "donor_committee_name",
  "donor_candidate_id",
  "donor_candidate_last_name",
  "donor_candidate_first_name",
  "donor_candidate_middle_name",
  "donor_candidate_prefix",
  "donor_candidate_suffix",
  "donor_candidate_office",
  "donor_candidate_state",
  "donor_candidate_district",
  "conduit_name",
  "conduit_street_1",
  "conduit_street_2",
  "conduit_city",
  "conduit_state",
  "conduit_zip",
  "memo_code",
  "memo_text",
  "account_code",
] as const;

export interface FecFilingReport {
  committeeId: string;
  fileNumber: number;
  periodStart: string;
  periodEnd: string;
}
/** FEC electronic filings use ASCII file separators and versioned field layouts. */
export function selectFecFilingContributions(input: {
  source: ResearchSource;
  report: FecFilingReport;
  candidateId: string;
  limit: number;
  layout: readonly string[];
}): {
  donors: CampaignFinance["donors"];
  sources: ResearchSource[];
  evidence: CandidateBrief["evidence"];
} {
  const { source, report } = input;
  if (
    source.url !==
    `https://docquery.fec.gov/dcdev/posted/${report.fileNumber}.fec`
  )
    throw new Error(
      "Raw FEC filing URL does not match selected processed report",
    );
  const lines = source.text.split(/\r?\n/).filter(Boolean);
  const header = lines[0]?.split("\u001c");
  const form = lines[1]?.split("\u001c");
  if (
    header?.[0] !== "HDR" ||
    header[1] !== "FEC" ||
    header[2] !== "8.5" ||
    !/^F3[NAT]$/.test(form?.[0] ?? "") ||
    form?.[1] !== report.committeeId
  )
    throw new Error("Unsupported FEC filing version, form or committee");
  const rawDate = (value: string | undefined) =>
    value && /^\d{8}$/.test(value)
      ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
      : null;
  if (
    rawDate(form?.[15]) !== report.periodStart ||
    rawDate(form?.[16]) !== report.periodEnd
  )
    throw new Error("Raw filing coverage differs from processed report");
  if (
    input.layout.length < 40 ||
    new Set(input.layout).size !== input.layout.length
  )
    throw new Error("Invalid official Schedule A field layout");
  const records = new Map<string, Record<string, string>>();
  for (const line of lines.slice(2)) {
    const fields = line.split("\u001c");
    if (!/^SA11A[I]?$|^SA11B$|^SA11C$/.test(fields[0] ?? "")) continue;
    while (fields.length > input.layout.length && fields.at(-1) === "")
      fields.pop();
    if (fields.length > input.layout.length || fields.length < 43)
      throw new Error("Schedule A exceeds official field layout");
    const row = Object.fromEntries(
      input.layout.map((name, i) => [name, fields[i] ?? ""]),
    );
    if (row.filer_committee_id_number !== report.committeeId)
      throw new Error("Schedule A committee mismatch");
    if (!["", "X"].includes(row.memo_code ?? ""))
      throw new Error("Unsupported Schedule A memo marker");
    if (row.memo_code === "X") continue;
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(row.contribution_amount ?? ""))
      throw new Error("Invalid Schedule A money format");
    const amount = Number(row.contribution_amount);
    if (!Number.isFinite(amount))
      throw new Error("Invalid Schedule A contribution amount");
    if (amount <= 0) continue;
    const date = row.contribution_date ?? "";
    if (!/^\d{8}$/.test(date)) throw new Error("Invalid Schedule A date");
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    if (iso < report.periodStart || iso > report.periodEnd)
      throw new Error("Schedule A date outside selected report");
    const id = row.transaction_id_number;
    if (!id) throw new Error("Schedule A transaction identity missing");
    const sanitized = {
      form_type: fields[0]!,
      committee_id: report.committeeId,
      file_number: String(report.fileNumber),
      transaction_id: id,
      contributor_name:
        row.organization_name ||
        [row.first_name, row.middle_name, row.last_name, row.suffix]
          .filter(Boolean)
          .join(" "),
      entity_type: row.entity_type ?? "",
      contribution_receipt_date: iso,
      contribution_receipt_amount: String(amount),
    };
    if (!sanitized.contributor_name)
      throw new Error("Schedule A contributor name missing");
    const previous = records.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(sanitized))
      throw new Error("Conflicting Schedule A transaction");
    records.set(id, sanitized);
  }
  const sources: ResearchSource[] = [];
  const citations: CandidateBrief["evidence"] = [];
  const donors: CampaignFinance["donors"] = [];
  const rows = [...records.values()]
    .sort(
      (a, b) =>
        b.contribution_receipt_date!.localeCompare(
          a.contribution_receipt_date!,
        ) || a.transaction_id!.localeCompare(b.transaction_id!),
    )
    .slice(0, input.limit);
  for (const row of rows) {
    const id = `${input.candidateId}:receipt:${report.fileNumber}:${hash(row.transaction_id!).slice(0, 12)}`;
    const child = rowSource(source, row, id);
    delete child.byteHash;
    delete child.binaryBase64;
    sources.push(child);
    const citation = evidence(
      child,
      id,
      "Reported contribution",
      child.text,
      "primary_record",
      `FEC electronic Schedule A parsed from file ${report.fileNumber}, transaction ${row.transaction_id}`,
    );
    citation.documentDate = row.contribution_receipt_date!;
    citation.shows =
      "One contribution selected from a processed filing. Repeated contributor names are not combined.";
    citation.limits =
      "Selected transactions exclude memo records. This is not a ranking or a complete donor list. Lobbying and interests are not established.";
    citations.push(citation);
    donors.push({
      id,
      name: row.contributor_name!,
      type:
        row.entity_type === "IND"
          ? "individual"
          : ["COM", "PAC", "PTY", "CCM"].includes(row.entity_type!)
            ? "committee"
            : row.entity_type === "ORG"
              ? "organization"
              : "unknown",
      amountCents: money(Number(row.contribution_receipt_amount)),
      evidenceIds: [id],
      lobbying: null,
      interests: [],
      positions: [],
    });
  }
  return { donors, sources, evidence: citations };
}
