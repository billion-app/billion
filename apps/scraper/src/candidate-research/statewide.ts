import { randomUUID } from "node:crypto";

import type {
  CandidateBrief,
  ResearchPoint,
  ResearchSource,
} from "@acme/validators";
import { evidenceHashKey } from "@acme/api/lib/candidate-brief-publication";
import { candidateResearchCollectionSchema } from "@acme/validators";

import type { SourceFetcher } from "./collect.js";
import { evidence } from "./finance.js";
import { fetchSource, hash } from "./sources.js";

export const lieutenantGovernor = {
  key: "ca-lieutenant-governor-2026",
  contestCode: "030000000000",
  contestId: "ca-sos:2026-11-03:030000000000",
  electionDate: "2026-11-03",
  jurisdiction: "ocd-division/country:us/state:ca",
  candidates: [
    {
      sosId: "3550",
      name: "Fiona Ma",
      designation: "State Treasurer/CPA",
      backgroundKey: "fionaBackground",
      backgroundPublisher: "California State Treasurer's Office",
      record: [
        {
          quote: "Fiona Ma, CPA is California’s 34th State Treasurer.",
          text: "The State Treasurer's official biography identifies Ma as California's 34th State Treasurer.",
        },
        {
          quote: "reelected on November 8, 2022.",
          text: "The same official biography records Ma's reelection as Treasurer on November 8, 2022.",
        },
      ],
      title: "College affordability and paid work experience",
      quote:
        "As Lieutenant Governor, I will make higher education more affordable, expand paid internships, and strengthen career pathways.",
      claim:
        "Ma promises to make higher education more affordable, expand paid internships and strengthen career pathways.",
      change:
        "Ma proposes lower barriers to higher education and more paid work experience. Her statement does not identify a tuition reduction, internship count or eligibility rules.",
      costs:
        "Lower student costs and more paid internships require a funding plan and decisions about who qualifies. The statement gives no budget, funding source or implementation timetable.",
      affected:
        "Students and families paying for college, employers offering internships and the public university systems could be affected. The statement does not quantify benefits or costs for any group.",
      questions:
        "How much would students save, and who would pay for additional internships? Would support reach students who need it most? These are questions for review, not demonstrated outcomes.",
    },
    {
      sosId: "3652",
      name: "Gloria Romero",
      designation: "Educator/Businesswoman",
      backgroundKey: "gloriaBackground",
      backgroundPublisher: "California Senate Office of Senate Floor Analyses",
      record: [
        {
          quote:
            "Assemblywoman Gloria Romero was successful in March of 2001 in filling the vacancy of Hilda Solis.",
          text: "The Senate's 2001 legislative digest records that Romero filled Hilda Solis's Senate vacancy in March 2001.",
        },
        {
          quote:
            "When Gloria Romero was elected to the Senate, she was elected to replace Edward Vincent on Senate Rules Committee.",
          text: "The same Senate digest records Romero's election to the Senate Rules Committee, replacing Edward Vincent.",
        },
      ],
      title: "Education standards and economic development",
      quote:
        "I will restore education standards, develop a bold economic plan that helps businesses thrive, rein in politicized commissions that have failed to protect our water, farmland, and way of life, defend Title IX for our daughters in sports, and fight antisemitism on our campuses.",
      claim:
        "Romero promises to restore education standards, develop an economic plan, change commission oversight, defend Title IX in sports and fight campus antisemitism.",
      change:
        "Romero proposes changes in education, economic development and commission oversight. Her statement does not specify the education standards, business measures, commission decisions or campus rules she would change.",
      costs:
        "Changing education standards, campus rules or commission decisions requires specific proposals and agreement by the responsible institutions. The statement gives no cost estimate, funding source or legal implementation plan.",
      affected:
        "Students, families, campus communities, businesses and people affected by state land and water decisions could be affected. The statement does not establish which groups would benefit or bear costs.",
      questions:
        "Which standards and commission decisions would change, and how would success be measured? How would campus policies protect safety and rights? The statement does not resolve these questions.",
    },
  ],
} as const;

export const statewideUrls = {
  roster:
    "https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf",
  identifiers: "https://media.sos.ca.gov/media/C26GG.txt",
  statements:
    "https://voterguide.sos.ca.gov/candidates/lt-governor-candidate-statements.htm",
  powers: "https://ltg.ca.gov/about-the-office-of-lt-governor/",
  finance: "https://powersearch.sos.ca.gov/",
  fionaBackground: "https://www.treasurer.ca.gov/bio",
  gloriaBackground:
    "https://sfa.senate.ca.gov/annualdigests/introduction-2001-digest-legislation/government",
} as const;

export function statewideMembers(
  certified: ResearchSource,
  identifiers: ResearchSource,
) {
  if (!certified.text.includes("November 3, 2026"))
    throw new Error("Wrong certified election date");
  const sections = certified.text.split("\nLieutenant Governor\n");
  if (sections.length !== 2)
    throw new Error("Expected one certified Lieutenant Governor contest");
  const section = sections[1]!.split("\nSecretary of State\n")[0]!;
  const rows = section
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const candidates = rows.filter((row) =>
    / (Democratic|Republican|No Party Preference|Non-Partisan)$/.test(row),
  );
  const feed = identifiers.text
    .split(/\r?\n/)
    .filter((row) => row.startsWith("[C|CAS|"))
    .map((row) => row.slice(1, -1).split("|"))
    .filter((row) => row[3] === lieutenantGovernor.contestCode);
  if (
    candidates.length !== lieutenantGovernor.candidates.length ||
    feed.length !== candidates.length
  )
    throw new Error("Certified and machine statewide rosters disagree");
  const members = feed.map((row) => {
    const expected = lieutenantGovernor.candidates.find(
      (candidate) => candidate.sosId === row[4] && candidate.name === row[10],
    );
    const matches = candidates.filter((line) => line.startsWith(`${row[10]} `));
    if (
      !expected ||
      matches.length !== 1 ||
      rows[rows.indexOf(matches[0]!) + 1] !== expected.designation
    )
      throw new Error("Statewide roster identity changed; review mapping");
    return {
      candidateId: `${lieutenantGovernor.contestId}:${expected.sosId}`,
      name: expected.name,
      description: expected.designation,
      ballotStatus: "on_ballot" as const,
    };
  });
  if (
    new Set(members.map((member) => member.candidateId)).size !==
    candidates.length
  )
    throw new Error("Duplicate statewide roster identity");
  return { members, section: section.trim() };
}

const authorityText =
  "The Lieutenant Governor has a vote on public higher-education boards and the State Lands Commission, chairs the economic development commission, and casts a Senate vote in a tie. These are shared decision-making roles. The office alone cannot set every education, budget or campus policy in these promises.";
const powersQuote =
  "The Lieutenant Governor serves as a voting member of the Board of Regents of the University of California, the Board of Trustees of the California State University system, and the Board of Governors of the California Community Colleges system.";
const financeQuote =
  "Only electronically-reported, state-level, campaign contribution and independent expenditure data is provided through Power Search at this time.";

function statewideBrief(
  candidate: (typeof lieutenantGovernor.candidates)[number],
  sources: {
    roster: ResearchSource;
    statement: ResearchSource;
    powers: ResearchSource;
    finance: ResearchSource;
    background: ResearchSource;
  },
  rosterExcerpt: string,
): CandidateBrief {
  const point = (
    title: string,
    text: string,
    evidenceIds: string[],
  ): ResearchPoint => ({ title, text, evidenceIds, emphasis: [] });
  const hasStatement = sources.statement.text.includes(`${candidate.name} |`);
  if (!sources.background.text.includes(candidate.name))
    throw new Error(
      `Official background identity changed for ${candidate.name}`,
    );
  const citations = [
    evidence(
      sources.roster,
      "roster",
      "Certified Lieutenant Governor roster",
      rosterExcerpt,
      "primary_record",
      "Certified List of Candidates, PDF page 2",
    ),
    evidence(
      sources.powers,
      "powers",
      "Official duties of the Lieutenant Governor",
      sources.powers.text,
      "primary_record",
      "About the Office of Lt. Governor",
    ),
    evidence(
      sources.finance,
      "state-finance",
      "Search California campaign filings",
      financeQuote,
      "primary_record",
      "Power Search coverage notice",
    ),
  ];
  const recordClaims = candidate.record.map((record, index) => {
    const id = `background-${index + 1}`;
    const citation = evidence(
      sources.background,
      id,
      `${candidate.name}: official office history`,
      record.quote,
      "primary_record",
      candidate.backgroundKey === "fionaBackground"
        ? "Biography, State Treasurer"
        : "2001 Digest of Legislation, Government, State Senate",
    );
    citation.limits =
      "This source establishes only the stated office history. It does not establish professional performance, outcomes of legislation, or the accuracy of campaign claims.";
    citations.push(citation);
    return { id, kind: "fact" as const, text: record.text, evidenceIds: [id] };
  });
  if (!sources.powers.text.includes(powersQuote))
    throw new Error("Official office authority changed");
  const authority = point(
    "Who decides",
    sources.powers.text.includes("there is no quorum to meet")
      ? `${authorityText} The official office page reports that the Economic Development Commission currently has no quorum to meet.`
      : authorityText,
    ["powers"],
  );
  const unknowns = point(
    "What is not established",
    "This is a candidate statement, not an independently verified result or a complete platform. It supplies no detailed budget, timetable or measurable targets for this pledge. The collection does not establish the effects of the proposed changes.",
    ["platform"],
  );
  if (hasStatement) {
    const start = sources.statement.text.indexOf(`${candidate.name} |`);
    const end = sources.statement.text.indexOf("Back to the Top", start);
    const next = lieutenantGovernor.candidates
      .filter((other) => other.sosId !== candidate.sosId)
      .map((other) =>
        sources.statement.text.indexOf(`${other.name} |`, start + 1),
      )
      .filter((index) => index > start);
    const statement = sources.statement.text.slice(
      start,
      Math.min(end < 0 ? sources.statement.text.length : end, ...next),
    );
    if (!statement.includes(candidate.quote))
      throw new Error(
        `Selected statewide pledge changed for ${candidate.name}`,
      );
    citations.push(
      evidence(
        sources.statement,
        "platform",
        `${candidate.name}'s candidate statement`,
        statement.trim(),
        "candidate",
        `${candidate.name}, Lieutenant Governor Candidate Statements`,
      ),
    );
    citations[citations.length - 1]!.limits =
      "Candidate-supplied statement. The Secretary of State says statements have not been checked for accuracy by an official agency. Historical claims and endorsements are not independently verified here.";
  }
  const change = point("What could change", candidate.change, ["platform"]);
  const costs = point("What it would take", candidate.costs, [
    "platform",
    "powers",
  ]);
  const gap =
    "No candidate statement was found for this certified candidate. No position was inferred from another candidate or from the absence of a statement.";
  return {
    schemaVersion: 1,
    identity: {
      candidateId: `${lieutenantGovernor.contestId}:${candidate.sosId}`,
      contestId: lieutenantGovernor.contestId,
      electionDate: lieutenantGovernor.electionDate,
      jurisdiction: lieutenantGovernor.jurisdiction,
    },
    revisionId: randomUUID(),
    supersedes: null,
    createdAt: new Date().toISOString(),
    authorId: "source-pipeline:ca-lt-governor-v1",
    authorship: {
      kind: "generated",
      model: "Codex-assisted source template",
      promptVersion: "ca-lt-governor-v1",
    },
    evidence: citations,
    correction: null,
    sections: [
      {
        topic: "priorities",
        claims: hasStatement
          ? [
              {
                id: "pledge",
                kind: "promise",
                text: candidate.claim,
                evidenceIds: ["platform"],
              },
            ]
          : [],
        missingEvidence: hasStatement ? null : gap,
      },
      {
        topic: "record",
        claims: [
          ...recordClaims,
          {
            id: "designation",
            kind: "fact",
            text: `The certified ballot designation for ${candidate.name} is “${candidate.designation}.” This is the election record's designation, not a review of professional performance.`,
            evidenceIds: ["roster"],
          },
        ],
        missingEvidence:
          "Only the cited office-history facts and ballot designation are established here. A comprehensive voting record, professional performance and the statement's retrospective claims have not been independently reviewed.",
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
        claims: hasStatement
          ? [
              {
                id: "effects",
                kind: "analysis",
                text: candidate.change,
                evidenceIds: ["platform"],
              },
            ]
          : [],
        missingEvidence: hasStatement
          ? "No measured outcomes or independent impact estimate are established by this collection."
          : gap,
      },
      {
        topic: "tradeoffs",
        claims: hasStatement
          ? [
              {
                id: "costs",
                kind: "analysis",
                text: candidate.costs,
                evidenceIds: ["platform", "powers"],
              },
            ]
          : [],
        missingEvidence: hasStatement ? null : gap,
      },
      {
        topic: "unknowns",
        claims: hasStatement
          ? [
              {
                id: "unknowns",
                kind: "analysis",
                text: unknowns.text,
                evidenceIds: ["platform"],
              },
            ]
          : [],
        missingEvidence:
          "This bounded collection does not cover every promise, endorsement, controversy or historical action.",
      },
    ],
    research: {
      headlineClaimId: hasStatement ? "pledge" : "authority",
      terms: [
        {
          term: "Lieutenant Governor",
          plain:
            "A separately elected state officer with succession duties and votes on specified boards and commissions.",
        },
      ],
      promises: hasStatement
        ? [
            {
              claimId: "pledge",
              title: candidate.title,
              brief: { change, authority, unknowns },
              benefits: [change],
              costs: [costs],
              affected: [
                point("Who could be affected", candidate.affected, [
                  "platform",
                  "powers",
                ]),
              ],
              perspectives: [
                point("Questions to weigh", candidate.questions, [
                  "platform",
                  "powers",
                ]),
              ],
              steps: [authority],
              alternatives: [],
              unknowns: [unknowns],
            },
          ]
        : [],
      finance: null,
      financeGap:
        "California campaign-finance totals, named contributors, refunds and independent spending have not been collected and reconciled for this candidate and election. This is missing coverage, not zero dollars. Open the California Secretary of State Power Search source to search candidate-controlled committees and independent expenditures; federal FEC filings are not used for this state race.",
    },
  };
}

export async function collectLieutenantGovernor(
  fetcher: SourceFetcher = fetchSource,
) {
  const sources: ResearchSource[] = [];
  const get = async (
    id: string,
    url: string,
    format: ResearchSource["format"],
    publisher = "California Secretary of State",
  ) => {
    const source = await fetcher(id, url, publisher, format);
    if (source.contentHash !== hash(source.text))
      throw new Error(`Invalid source hash for ${id}`);
    sources.push(source);
    return source;
  };
  const roster = await get("certified-roster", statewideUrls.roster, "pdf");
  const identifiers = await get(
    "roster-identifiers",
    statewideUrls.identifiers,
    "text",
  );
  const verified = statewideMembers(roster, identifiers);
  const statement = await get(
    "lt-governor-statements",
    statewideUrls.statements,
    "html",
  );
  if (
    !statement.text.includes("November 3, 2026") ||
    !statement.text.includes("Lieutenant Governor Candidate Statements")
  )
    throw new Error("Wrong statewide statement election or office");
  const powers = await get(
    "lt-governor-powers",
    statewideUrls.powers,
    "html",
    "Office of the California Lieutenant Governor",
  );
  const finance = await get(
    "california-finance-search",
    statewideUrls.finance,
    "html",
  );
  const briefs: CandidateBrief[] = [];
  for (const candidate of lieutenantGovernor.candidates) {
    const background = await get(
      `${candidate.sosId}:official-background`,
      statewideUrls[candidate.backgroundKey],
      "html",
      candidate.backgroundPublisher,
    );
    briefs.push(
      statewideBrief(
        candidate,
        { roster, statement, powers, finance, background },
        verified.section,
      ),
    );
  }
  const checkedAt = new Date().toISOString();
  return candidateResearchCollectionSchema.parse({
    pilotKey: lieutenantGovernor.key,
    briefs,
    sources,
    problems: [],
    manifest: {
      id: randomUUID(),
      contestId: lieutenantGovernor.contestId,
      jurisdiction: lieutenantGovernor.jurisdiction,
      electionDate: lieutenantGovernor.electionDate,
      jurisdictionLabel: "California · Statewide",
      office: "Lieutenant Governor",
      rosterSourceUrl: roster.url,
      rosterHash: roster.contentHash,
      rosterVerifiedAt: checkedAt,
      rosterVerifiedBy:
        "source-pipeline:certified-list-and-official-identifiers",
      members: verified.members.map((member) => ({
        ...member,
        revisionId: briefs.find(
          (brief) => brief.identity.candidateId === member.candidateId,
        )!.revisionId,
      })),
      policyVersion: "pending",
      sourceCheckedAt: checkedAt,
      expiresAt: new Date(Date.parse(checkedAt) + 86_400_000).toISOString(),
      currentHashes: Object.fromEntries(
        briefs.flatMap((brief) =>
          brief.evidence.map((entry) => [
            evidenceHashKey(brief.identity, entry.id),
            entry.contentHash,
          ]),
        ),
      ),
    },
  });
}
