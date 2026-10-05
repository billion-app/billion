import { randomUUID } from "node:crypto";

import type {
  CampaignFinance,
  CandidateBrief,
  ResearchPoint,
  ResearchSource,
} from "@acme/validators";
import { candidateResearchTemplateVersion } from "@acme/validators";

import { evidence } from "./finance.js";

export const pilot = {
  key: "ca-house-17-2026",
  contestId: "ca-sos:2026-11-03:110000170000",
  jurisdiction: "ocd-division/country:us/state:ca/cd:17",
  electionDate: "2026-11-03",
  candidates: [
    {
      sosId: "3220",
      name: "Ro Khanna",
      fecId: "H4CA12055",
      fecName: "KHANNA, ROHIT",
      platformUrl: "https://khanna.house.gov/issues/health",
      publisher: "Office of Representative Ro Khanna",
      quote:
        "I support the creation of a single-payer health care system, or Medicare for All.",
      title: "A single-payer health care system",
      claim: "Supports a single-payer health care system, or Medicare for All.",
      emphasis: ["single-payer health care system"],
    },
    {
      sosId: "3430",
      name: "Ritesh Tandon",
      fecId: "H0CA17193",
      fecName: "TANDON, RITESH",
      platformUrl: "https://www.tandonforcongress.com/",
      publisher: "Ritesh Tandon campaign",
      quote:
        "Expand federal incentives for new housing supply, reward faster local permitting, support first-time homebuyer savings tools, and grow workforce housing near jobs and transit.",
      title: "Housing supply and faster permitting",
      claim:
        "Proposes federal incentives for more housing and faster local permitting.",
      emphasis: ["more housing", "faster local permitting"],
    },
  ],
} as const;
export function draftBrief(input: {
  candidate: (typeof pilot.candidates)[number];
  roster: ResearchSource;
  metadata: ResearchSource;
  platform: ResearchSource | null;
  powers: ResearchSource;
  finance: CampaignFinance | null;
  financeGap: string | null;
  evidence: CandidateBrief["evidence"];
}): CandidateBrief {
  const { candidate, platform, powers } = input;
  const candidateId = `ca-sos:2026-11-03:110000170000:${candidate.sosId}`;
  const record = input.roster.text
    .split("United States Representative District 17")[1]!
    .split("United States Representative District 18")[0]!
    .trim();
  const rosterEvidence = evidence(
    input.roster,
    "roster",
    "Certified candidate roster",
    record,
    "primary_record",
    "Certified List of Candidates, page 7, US Representative District 17",
  );
  const powersQuote = "First, a representative sponsors a bill.";
  const powersStart = powers.text.indexOf(powersQuote);
  if (powersStart < 0)
    throw new Error("House legislative-process passage changed");
  const powersEvidence = evidence(
    powers,
    "powers",
    "How federal laws are made",
    powers.text.slice(powersStart),
    "primary_record",
    "How Are Laws Made?",
  );
  const allEvidence = [rosterEvidence, powersEvidence, ...input.evidence];
  const point = (
    title: string,
    text: string,
    refs: string[],
    emphasis: string[] = [],
  ): ResearchPoint => ({ title, text, evidenceIds: refs, emphasis });
  const authority = point(
    "Who decides",
    "A representative can sponsor legislation and vote. A proposal still needs House and Senate approval and action by the president. One representative cannot enact it alone.",
    ["powers"],
    ["House and Senate approval"],
  );
  const missing = point(
    "What is unresolved",
    "The quoted pledge does not specify a complete bill, implementation timetable, or funding plan. Those details are needed to assess its cost and likely results.",
    ["platform"],
    ["funding plan"],
  );
  const healthcare = candidate.sosId === "3220";
  const change = point(
    "The proposal",
    candidate.claim,
    ["platform"],
    [...candidate.emphasis],
  );
  const benefits = point(
    "The candidate’s aim",
    healthcare
      ? "Khanna argues that a single-payer system would expand coverage and address high health-care costs. These are stated aims; the pledge does not establish the outcome of a specific bill."
      : "Tandon proposes more housing near jobs and transit, faster permitting, and help for first-time buyers. These are stated aims; the pledge does not establish how many homes would be built or who could afford them.",
    ["platform"],
  );
  const costs = point(
    "Funding and implementation",
    healthcare
      ? "A new health-care system would require decisions about what is covered and how it is paid for. The quoted pledge does not identify those terms, so it cannot tell a household what it would pay."
      : "Federal incentives need defined eligibility, funding, and participation rules. The quoted pledge does not specify those terms or which local permitting changes would qualify.",
    ["platform", "powers"],
  );
  const promises: NonNullable<CandidateBrief["research"]>["promises"] = [];
  const promiseClaim: CandidateBrief["sections"][number]["claims"] = [];
  if (platform) {
    if (!platform.text.includes(candidate.quote))
      throw new Error(
        `Campaign pledge changed for ${candidate.name}; manual update required`,
      );
    const ev = evidence(
      platform,
      "platform",
      healthcare
        ? "Health care and the social safety net"
        : "Housing affordability agenda",
      healthcare
        ? candidate.quote +
            " We must increase coverage, support small businesses, expand primary care, and lower premiums. Medicare for All is the next step toward addressing the high costs and inequalities in the current health care system."
        : candidate.quote,
      "candidate",
      healthcare
        ? "Health Care and the Social Safety Net, position statement"
        : "My Affordability Agenda, item 2: Make Housing Affordable Again",
    );
    ev.shows = "This establishes the candidate's stated position.";
    ev.limits =
      "It does not establish results, an enacted law, a funded program, or independent validation of campaign claims.";
    allEvidence.push(ev);
    if (healthcare) {
      const start = platform.text.indexOf(
        "I will fight to protect the guarantees",
      );
      const end = platform.text.indexOf("I will also stand up", start);
      if (start < 0 || end < start)
        throw new Error("Supporting position context changed");
      allEvidence.push(
        evidence(
          platform,
          "platform-context",
          "Existing health and safety-net programs",
          platform.text.slice(start, end).trim(),
          "candidate",
          "Opening position statement",
        ),
      );
    }
    promiseClaim.push({
      id: "pledge",
      kind: "promise",
      text: candidate.claim,
      emphasis: [...candidate.emphasis],
      evidenceIds: ["platform"],
    });
    promises.push({
      claimId: "pledge",
      title: candidate.title,
      brief: { change, authority, unknowns: missing },
      benefits: [benefits],
      costs: [costs],
      affected: [
        point(
          "Who would be affected",
          healthcare
            ? "The proposal concerns people seeking health coverage and the organizations that provide or pay for care. The pledge does not identify all eligibility or transition rules."
            : "The proposal names renters, first-time buyers, and workforce families. Its effect would depend on where housing is built and the terms of any incentives.",
          ["platform"],
        ),
      ],
      perspectives: [
        point(
          "Two questions to weigh",
          healthcare
            ? "Would the eventual plan improve access to care? How would its funding and transition affect households and providers? The pledge alone does not settle either question."
            : "Would incentives lead to more affordable homes? What would participating governments and taxpayers be asked to fund or change? The pledge alone does not settle either question.",
          ["platform", "powers"],
        ),
      ],
      steps: [authority],
      alternatives: [
        point(
          "Other approaches in the source",
          healthcare
            ? "Khanna also states support for protecting the Affordable Care Act, Medicare, and Medicaid. Those existing-program commitments are separate from creating a new single-payer system."
            : "Tandon also proposes first-time homebuyer savings tools. Buyer assistance and incentives to build housing are different approaches; their effects require separate assessment.",
          [healthcare ? "platform-context" : "platform"],
        ),
      ],
      unknowns: [missing],
    });
  }
  const sections: CandidateBrief["sections"] = [
    {
      topic: "priorities",
      claims: promiseClaim,
      missingEvidence: platform
        ? null
        : "The candidate's position page could not be collected. No priorities were inferred.",
    },
    {
      topic: "record",
      claims: [],
      missingEvidence:
        "Voting and professional history have not been reviewed in this collection.",
    },
    {
      topic: "mechanisms",
      claims: [
        {
          id: "authority",
          kind: "analysis",
          text: authority.text,
          evidenceIds: ["powers"],
        },
      ],
      missingEvidence: null,
    },
    {
      topic: "effects",
      claims: platform
        ? [
            {
              id: "aim",
              kind: "analysis",
              text: benefits.text,
              evidenceIds: ["platform"],
            },
          ]
        : [],
      missingEvidence: platform
        ? null
        : "A proposal is needed before assessing effects.",
    },
    {
      topic: "tradeoffs",
      claims: platform
        ? [
            {
              id: "costs",
              kind: "analysis",
              text: costs.text,
              evidenceIds: ["platform", "powers"],
            },
          ]
        : [],
      missingEvidence: platform
        ? null
        : "Costs and tradeoffs have not been assessed.",
    },
    {
      topic: "unknowns",
      claims: platform
        ? [
            {
              id: "unknown",
              kind: "analysis",
              text: missing.text,
              evidenceIds: ["platform"],
            },
          ]
        : [],
      missingEvidence:
        "This bounded collection is not a complete account of the candidate's history or platform.",
    },
  ];
  return {
    schemaVersion: 1,
    identity: {
      candidateId,
      contestId: pilot.contestId,
      electionDate: pilot.electionDate,
      jurisdiction: pilot.jurisdiction,
    },
    revisionId: randomUUID(),
    supersedes: null,
    createdAt: new Date().toISOString(),
    authorId: `source-pipeline:${candidateResearchTemplateVersion}`,
    authorship: {
      kind: "generated",
      model: "Codex-assisted source template",
      promptVersion: candidateResearchTemplateVersion,
    },
    evidence: allEvidence,
    sections,
    correction: null,
    research: {
      headlineClaimId: platform ? "pledge" : "authority",
      promises,
      finance: input.finance,
      financeGap: input.financeGap,
    },
  };
}
