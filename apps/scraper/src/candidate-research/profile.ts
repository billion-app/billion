import type { CandidateBrief, ResearchSource } from "@acme/validators";
import { campaignFinanceSchema } from "@acme/validators";

import { evidence } from "./finance.js";
import { money } from "./sources.js";

/** The public FEC summary remains useful when the itemized API is unavailable. */
export function profileFinance(
  source: ResearchSource,
  candidate: {
    fecId: string;
    fecName: string;
    district?: string;
    cycle?: number;
  },
  citations: CandidateBrief["evidence"],
) {
  const text = source.text;
  const district = String(Number(candidate.district ?? "17"));
  const cycle = candidate.cycle ?? 2026;
  const url = new URL(source.url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.fec.gov" ||
    url.pathname !== `/data/candidate/${candidate.fecId}/` ||
    !text.includes(candidate.fecName) ||
    !text.includes(`ID: ${candidate.fecId}`) ||
    !text.includes("Candidate for House") ||
    !new RegExp(`California\\s*-\\s*0?${district}(?!\\d)`).test(text) ||
    url.searchParams.get("cycle") !== String(cycle)
  )
    throw new Error("Public FEC profile does not match the selected identity");
  const section = text.split("Data is included from these committees:")[1];
  const committeeText = section?.split("Total raised")[0];
  const committees = [
    ...(committeeText ?? "").matchAll(/([^()]+) \((C\d{8})\)/g),
  ];
  if (!section || !committees.length || committees.length > 3)
    throw new Error("Public FEC committee coverage is missing or changed");
  const dates =
    /Coverage dates: (\d{2})\/(\d{2})\/(\d{4}) to (\d{2})\/(\d{2})\/(\d{4})/.exec(
      section,
    );
  if (
    !dates ||
    ![cycle - 1, cycle].includes(Number(dates[3])) ||
    ![cycle - 1, cycle].includes(Number(dates[6]))
  )
    throw new Error(
      "Public FEC coverage is missing or outside the selected cycle",
    );
  const amount = (label: string) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `(?:^| )${escaped} \\$([\\d,]+\\.\\d{2})(?: |$)`,
    ).exec(section);
    if (!match) throw new Error(`Missing FEC summary field: ${label}`);
    return money(Number(match[1]!.replaceAll(",", "")));
  };
  const start = section.indexOf("Total receipts");
  const end = section.indexOf("Newly filed summary data", start);
  if (start < 0 || end < start)
    throw new Error("FEC summary structure changed");
  const quote = section.slice(start, end).trim();
  const refundQuote = /Total contribution refunds \$[\d,]+\.\d{2}/.exec(
    section,
  )?.[0];
  if (!refundQuote) throw new Error("FEC refund total missing");
  citations.push(
    evidence(
      source,
      `${candidate.fecId}:summary`,
      "FEC campaign financial summary",
      quote,
      "primary_record",
      `${cycle} election; ${dates[0]}`,
    ),
  );
  citations.push(
    evidence(
      source,
      `${candidate.fecId}:refunds`,
      "FEC contribution refunds",
      refundQuote,
      "primary_record",
      `${cycle} election; ${dates[0]}`,
    ),
  );
  const optionalAmount = (label: string) => {
    try {
      return amount(label);
    } catch {
      return null;
    }
  };
  const summaryFields = {
    spentCents: optionalAmount("Total disbursements"),
    cashCents: optionalAmount("Ending cash on hand"),
    debtCents: optionalAmount("Debts/loans owed by committee"),
    itemizedIndividualCents: optionalAmount(
      "Itemized individual contributions",
    ),
    unitemizedIndividualCents: optionalAmount(
      "Unitemized individual contributions",
    ),
  };
  const summaryRefs = [
    `${candidate.fecId}:summary`,
    `${candidate.fecId}:refunds`,
  ];
  for (const label of [
    "Total disbursements",
    "Ending cash on hand",
    "Debts/loans owed by committee",
    "Itemized individual contributions",
    "Unitemized individual contributions",
  ]) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const quote = new RegExp(`${escaped} \\$[\\d,]+\\.\\d{2}`).exec(
      section,
    )?.[0];
    if (!quote) continue;
    const id = `${candidate.fecId}:summary:${summaryRefs.length}`;
    citations.push(
      evidence(
        source,
        id,
        "FEC campaign financial summary",
        quote,
        "primary_record",
        `${cycle} election; ${dates[0]}`,
      ),
    );
    summaryRefs.push(id);
  }
  const unavailable = (reason: string) => ({
    status: "unavailable" as const,
    reason,
    evidenceIds: summaryRefs,
  });
  return campaignFinanceSchema.parse({
    observation: {
      schemaVersion: 1,
      summary: {
        status: "available",
        basis: "reported_campaign_totals",
        periodStart: `${dates[3]}-${dates[1]}-${dates[2]}`,
        periodEnd: `${dates[6]}-${dates[4]}-${dates[5]}`,
        updatedAt: source.fetchedAt,
        evidenceIds: summaryRefs,
        ...summaryFields,
      },
      donorSelection: unavailable(
        "Itemized filing transactions have not been retrieved.",
      ),
      independentExpenditures: unavailable(
        "Processed independent expenditures have not been retrieved.",
      ),
      filingStatus: unavailable(
        "The official filing index has not been retrieved.",
      ),
    },
    committeeId: committees.map((m) => m[2]).join(", "),
    committeeName: committees.map((m) => m[1]!.trim()).join("; "),
    periodStart: `${dates[3]}-${dates[1]}-${dates[2]}`,
    periodEnd: `${dates[6]}-${dates[4]}-${dates[5]}`,
    currency: "USD",
    coverage: "partial",
    coverageNote:
      "Campaign totals come from the FEC public financial summary. Itemized contributions and outside spending could not be retrieved in this run. Donor identities, lobbying roles and interests are not established. Newly filed summaries may take up to 48 hours to appear on the FEC website.",
    updatedAt: source.fetchedAt,
    filingEvidenceIds: summaryRefs,
    receipts: {
      totalCents: amount("Total receipts"),
      refundsCents: amount("Total contribution refunds"),
      breakdown: {
        individuals: amount("Total individual contributions"),
        committees:
          amount("Party committee contributions") +
          amount("Other committee contributions"),
        self_contributions: amount("Candidate contributions"),
        candidate_loans: amount("Loans made by candidate"),
        transfers: amount("Transfers from other authorized committees"),
        other:
          amount("Other loans") +
          amount("Offsets to operating expenditures") +
          amount("Other receipts"),
      },
    },
    donors: [],
    donorCoverage: "unavailable",
    donorAmounts: "contribution",
    outsideSpending: null,
  });
}
