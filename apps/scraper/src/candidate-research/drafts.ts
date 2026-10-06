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
      title: "More homes and faster building approvals",
      claim:
        "Proposes federal incentives to build more homes and speed up local building approvals.",
      emphasis: ["more homes", "speed up local building approvals"],
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
    "A representative can propose a law and vote on it. Both parts of Congress must approve it before it goes to the president. One representative cannot make it law alone.",
    ["powers"],
    ["cannot make it law alone"],
  );
  const missing = point(
    "What we still don’t know",
    "The statement does not include a full plan, when it would start or where the money would come from. We need those details to understand what it would cost and who it would help.",
    ["platform"],
    ["when it would start", "money"],
  );
  const healthcare = candidate.sosId === "3220";
  const change = point(
    "What could change",
    healthcare
      ? "Khanna says the goal is to help more people get health care and lower costs. The statement does not show which care would be covered or what people would pay."
      : "Tandon wants more homes built and local building approvals to take less time. The statement does not say how many homes, where they would be built or how prices might change.",
    ["platform"],
    healthcare
      ? ["get health care", "lower costs"]
      : ["more homes", "less time"],
  );
  const benefits = point(
    "The candidate’s aim",
    healthcare
      ? "Khanna says a single-payer system would help more people get health care and lower costs. These are his goals, not results shown by the statement."
      : "Tandon wants more homes near jobs and public transport, faster building approvals and help for first-time buyers. The statement does not show how many homes would be built or who could afford them.",
    ["platform"],
  );
  const costs = point(
    "What it would take",
    healthcare
      ? "A new health-care system needs rules for which care it pays for and where the money comes from. This statement does not give those details, so we cannot tell a household what it would pay."
      : "The plan needs rules for who could get government help, where the money would come from and what local governments would need to change. This statement does not give those details.",
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
    ev.shows = "This shows what the candidate says they support.";
    ev.limits =
      "It does not show that the plan has become law, has money set aside, or has delivered results. It is the candidate’s own statement.";
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
            ? "This could affect people who need health insurance, doctors, hospitals and insurers. The statement does not explain who would qualify or how people would move to a new plan."
            : "The proposal names renters, first-time buyers and working families. What it means for them depends on where homes are built and the rules for government help.",
          ["platform"],
        ),
      ],
      perspectives: [
        point(
          "Two questions to weigh",
          healthcare
            ? "Would the plan make it easier to get care? What would people and health-care services pay or need to change? The statement alone does not answer those questions."
            : "Would government help lead to homes people can afford? What would local governments and taxpayers pay or need to change? The statement alone does not answer those questions.",
          ["platform", "powers"],
        ),
      ],
      steps: [authority],
      alternatives: [
        point(
          "Other approaches in the source",
          healthcare
            ? "Khanna also says he would protect existing health-care programs: the Affordable Care Act, Medicare and Medicaid. Keeping those programs is a different goal from creating a new single-payer system."
            : "Tandon also wants to help first-time buyers save for a home. Helping people buy and helping people build are different plans. Each needs its own costs and expected results explained.",
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
      terms: [
        {
          term: "Congress",
          plain:
            "The U.S. law-making body. It has two parts: the House of Representatives and the Senate.",
        },
        ...(healthcare
          ? [
              {
                term: "single-payer",
                plain:
                  "One public program pays for covered health care. The term alone does not say which services are covered or how the program is paid for.",
              },
              {
                term: "Medicare for All",
                plain:
                  "A name used for proposals for a national public health insurance program. The name alone does not describe a complete plan.",
              },
              {
                term: "Affordable Care Act",
                plain:
                  "A U.S. law that changed health insurance rules and created ways for more people to get coverage. It is also called the ACA or Obamacare.",
              },
              {
                term: "Medicare",
                plain:
                  "A U.S. health insurance program mainly for people age 65 and older, and some younger people with disabilities or certain conditions.",
              },
              {
                term: "Medicaid",
                plain:
                  "A public health coverage program for people who qualify based on income and other rules. Federal and state governments fund it together.",
              },
            ]
          : [
              {
                term: "federal incentives",
                plain:
                  "Money, tax breaks or other help from the U.S. government meant to encourage an action. This statement does not say which kind.",
              },
            ]),
      ],
      promises,
      finance: input.finance,
      financeGap: input.financeGap,
    },
  };
}
