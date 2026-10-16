import type { CandidateBrief, ResearchSource } from "@acme/validators";
import { campaignFinanceSchema } from "@acme/validators";

import { evidence } from "./finance.js";
import { money } from "./sources.js";

/** The public FEC summary remains useful when the itemized API is unavailable. */
export function profileFinance(
  source: ResearchSource,
  candidate: { fecId: string; fecName: string },
  citations: CandidateBrief["evidence"],
) {
  const text = source.text;
  if (
    !text.includes(candidate.fecName) ||
    !text.includes(`ID: ${candidate.fecId}`) ||
    !text.includes("Candidate for House") ||
    !text.includes("California - 17") ||
    new URL(source.url).searchParams.get("cycle") !== "2026"
  )
    throw new Error("Public FEC profile does not match the pilot identity");
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
  if (!dates || dates[3] !== "2025" || dates[6] !== "2026")
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
      `2026 election; ${dates[0]}`,
    ),
  );
  citations.push(
    evidence(
      source,
      `${candidate.fecId}:refunds`,
      "FEC contribution refunds",
      refundQuote,
      "primary_record",
      `2026 election; ${dates[0]}`,
    ),
  );
  return campaignFinanceSchema.parse({
    committeeId: committees.map((m) => m[2]).join(", "),
    committeeName: committees.map((m) => m[1]!.trim()).join("; "),
    periodStart: `${dates[3]}-${dates[1]}-${dates[2]}`,
    periodEnd: `${dates[6]}-${dates[4]}-${dates[5]}`,
    currency: "USD",
    coverage: "partial",
    coverageNote:
      "Campaign totals come from the FEC public financial summary. Itemized contributions and outside spending could not be retrieved in this run. Donor identities, lobbying roles and interests are not established. Newly filed summaries may take up to 48 hours to appear on the FEC website.",
    updatedAt: source.fetchedAt,
    filingEvidenceIds: [
      `${candidate.fecId}:summary`,
      `${candidate.fecId}:refunds`,
    ],
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
