import type {
  CandidateBrief,
  CandidateResearchRace,
  ResearchPoint,
} from "@acme/validators";
import { candidateBriefSchema } from "@acme/validators";

const point = (
  title: string,
  text: string,
  evidenceIds: string[],
  emphasis: string[] = [],
): ResearchPoint => ({ title, text, evidenceIds, emphasis });
/** Development only. Never imported by an ingestion or publication process. */
export function candidateResearchPreview(
  mode: string | undefined,
): CandidateResearchRace | null {
  if (
    !__DEV__ ||
    (mode !== "full" && mode !== "sparse" && mode !== "withdrawn")
  )
    return null;
  const sources = [
    {
      id: "platform",
      title: "Housing and getting around",
      origin: "candidate",
      excerpt:
        "My priorities are lower housing costs and reliable, frequent buses. I will seek buses every 15 minutes on two routes.",
      publisher: "Morgan Lee campaign",
      locator: "Platform · paragraphs 2–3",
      shows: "What the candidate says they would pursue.",
      limits: "It does not establish results or a funded service plan.",
    },
    {
      id: "vote",
      title: "Council meeting minutes",
      origin: "primary_record",
      excerpt:
        "Motion to permit multifamily housing within the two station areas. Morgan Lee: aye. Motion carried.",
      publisher: "Example City Clerk",
      locator: "June 12 · item 6B, roll call",
      shows: "One recorded vote to allow apartments.",
      limits:
        "The vote does not tell us how many homes were built or whether rents changed.",
    },
    {
      id: "powers",
      title: "City budget and transit responsibilities",
      origin: "primary_record",
      excerpt:
        "The mayor proposes the city budget. The council adopts appropriations. The transit board sets the operating schedule. An increase in trips requires operating funds and available drivers.",
      publisher: "Example City",
      locator: "Budget guide · transit responsibilities",
      shows: "Who makes funding and scheduling decisions.",
      limits: "It gives no budget or staffing commitment for this proposal.",
    },
    {
      id: "context",
      title: "Questions about the bus proposal",
      origin: "reporting",
      excerpt:
        "Lee proposes 15-minute service on two routes. The platform does not name the routes, hours of operation, current timetable, cost, or funding source. More frequent service could reduce waits; extra trips would require funding and drivers. No rider or operator interviews are included here.",
      publisher: "Example Local News",
      locator: "Transit article · paragraphs 1–4",
      shows: "The scope of the proposal and the details still missing.",
      limits: "This is context, not a forecast or an endorsement.",
    },
    {
      id: "filing",
      title: "Campaign receipts report",
      origin: "primary_record",
      excerpt:
        "Receipts: individuals $70,000; committees $20,000; candidate contributions $5,000; candidate loans $15,000; transfers $10,000. Total $120,000. Refunds $2,000. Jordan Bell $2,000; Neighborhood Workers Committee $8,000; Example U.S.–Israel Partnership PAC $12,000.",
      publisher: "Example Elections Office",
      locator: "DEMO-014 · January 1–June 30 · amended report",
      shows: "Reported campaign receipts and the selected donors.",
      limits:
        "A contribution does not establish influence over a candidate's decisions.",
    },
    {
      id: "lobby",
      title: "Lobbyist registration",
      origin: "primary_record",
      excerpt:
        "Jordan Bell is a registered lobbyist for this reporting period. The example does not identify clients or issue areas.",
      publisher: "Example Ethics Office",
      locator: "Registration DEMO-L01",
      shows: "A registered lobbying role.",
      limits: "It does not establish which interests this donation represents.",
    },
    {
      id: "labor",
      title: "Committee purpose",
      origin: "primary_record",
      excerpt:
        "Neighborhood Workers Committee advocates on labor and employment policy.",
      publisher: "Example Elections Office",
      locator: "Committee registration DEMO-C01",
      shows: "The committee's stated interest area.",
      limits:
        "This does not establish a candidate's position on any labor policy.",
    },
    {
      id: "foreign",
      title: "Committee purpose and position",
      origin: "primary_record",
      excerpt:
        "Example U.S.–Israel Partnership PAC advocates for U.S. foreign policy that supports U.S.–Israel relations.",
      publisher: "Example Elections Office",
      locator: "Committee registration DEMO-C02",
      shows: "A documented foreign-policy interest and stated position.",
      limits:
        "This is the committee's position, not proof of the candidate's views.",
    },
    {
      id: "outside",
      title: "Independent expenditure report",
      origin: "primary_record",
      excerpt:
        "Example Better City Committee: $32,000 supporting Morgan Lee. Example Accountability Committee: $8,000 opposing Morgan Lee. These expenditures were not campaign receipts.",
      publisher: "Example Elections Office",
      locator: "Independent expenditure reports DEMO-IE1 and DEMO-IE2",
      shows: "Reported outside support and opposition spending.",
      limits: "These amounts were not paid to the campaign.",
    },
  ].map((source) => ({
    ...source,
    origin: source.origin as "candidate" | "primary_record" | "reporting",
    url: `https://sources.example/${source.id}`,
    retrievedAt: "2026-10-04T12:00:00Z",
    documentDate: source.id === "vote" ? "2026-06-12" : "2026-06-30",
    contentHash: "a".repeat(64),
  }));
  const identity = {
    contestId: "example-mayor",
    jurisdiction: "fictional:example-city",
    electionDate: "2026-11-03",
  };
  const morgan: CandidateBrief = {
    schemaVersion: 1,
    identity: { ...identity, candidateId: "morgan" },
    revisionId: "00000000-0000-4000-8000-000000000443",
    supersedes: null,
    correction: null,
    createdAt: "2026-10-04T12:00:00Z",
    authorId: "example-author",
    authorship: {
      kind: "generated",
      model: "Fictional example",
      promptVersion: "example",
    },
    evidence: sources,
    sections: [
      {
        topic: "priorities",
        missingEvidence: null,
        claims: [
          {
            id: "priority",
            kind: "analysis",
            text: "Morgan Lee prioritizes lower housing costs and frequent buses.",
            emphasis: ["lower housing costs", "frequent buses"],
            evidenceIds: ["platform"],
          },
          {
            id: "transit",
            kind: "promise",
            text: "Seek buses every 15 minutes on two routes.",
            evidenceIds: ["platform"],
          },
        ],
      },
      {
        topic: "record",
        missingEvidence: null,
        claims: [
          {
            id: "housing",
            kind: "fact",
            text: "Voted to allow apartments near two transit stops.",
            emphasis: ["allow apartments"],
            evidenceIds: ["vote"],
          },
        ],
      },
      ...(["mechanisms", "effects", "tradeoffs", "unknowns"] as const).map(
        (topic) => ({
          topic,
          missingEvidence:
            "Explore the transit promise for its analysis and open questions.",
          claims: [],
        }),
      ),
    ],
    research: {
      headlineClaimId: "priority",
      promises: [
        {
          claimId: "transit",
          title: "Buses every 15 minutes",
          brief: {
            change: point(
              "What is being promised",
              "Morgan Lee wants buses to arrive every 15 minutes on two routes. The proposal does not yet name the routes or operating hours.",
              ["platform", "context"],
              ["every 15 minutes", "two routes"],
            ),
            authority: point(
              "Can the mayor do it?",
              "The mayor can request funding. The council must approve the budget, and the transit board must adopt the schedule. The mayor cannot set bus service alone.",
              ["powers"],
              ["cannot set bus service alone"],
            ),
            unknowns: point(
              "What would make it a workable plan?",
              "A cost estimate, a funding source and enough drivers. Without a current timetable, we also cannot tell how much service would increase.",
              ["context", "powers"],
              ["cost estimate", "funding source", "enough drivers"],
            ),
          },
          benefits: [
            point(
              "For people on these routes",
              "More frequent buses could mean less waiting and more flexible travel. The size of the benefit depends on the current timetable and which routes are chosen.",
              ["context"],
              ["less waiting"],
            ),
          ],
          costs: [
            point(
              "To keep the service running",
              "Extra trips need ongoing money and drivers. Without a funding plan, we cannot tell whether that means new revenue or changes to other services.",
              ["powers", "context"],
              ["ongoing money and drivers"],
            ),
          ],
          affected: [
            point(
              "Riders and people elsewhere in the city",
              "Riders on the selected routes could benefit. People on other routes may see no direct change. Any effect on other services depends on the funding decision.",
              ["platform", "context"],
            ),
          ],
          perspectives: [
            point(
              "Whose views are here?",
              "The campaign's proposal and reporting about its missing details are included. Rider, driver and transit-operator perspectives are not included in these sources.",
              ["platform", "context"],
            ),
          ],
          steps: [
            point(
              "Mayor",
              "Request money for the proposed bus service in the city budget.",
              ["powers"],
            ),
            point(
              "Council",
              "Decide how much to fund when adopting the budget.",
              ["powers"],
            ),
            point(
              "Transit board",
              "Decide whether to adopt the schedule and how to staff the extra trips.",
              ["powers"],
            ),
          ],
          alternatives: [
            point(
              "What else was considered?",
              "The reviewed sources do not compare other service changes or funding choices.",
              ["context"],
            ),
          ],
          unknowns: [
            point(
              "Still needed",
              "Named routes, operating hours, the current timetable, a budget and a staffing plan.",
              ["context"],
            ),
          ],
        },
      ],
      financeGap: null,
      finance: {
        committeeId: "DEMO-014",
        committeeName: "Morgan Lee for Mayor",
        currency: "USD",
        periodStart: "2026-01-01",
        periodEnd: "2026-06-30",
        updatedAt: "2026-10-04T12:00:00Z",
        coverage: "partial",
        coverageNote:
          "Selected reports only. Interest classification is incomplete.",
        filingEvidenceIds: ["filing"],
        receipts: {
          totalCents: 12000000,
          breakdown: {
            individuals: 7000000,
            committees: 2000000,
            self_contributions: 500000,
            candidate_loans: 1500000,
            transfers: 1000000,
            other: 0,
          },
          refundsCents: 200000,
        },
        donorCoverage: "selected",
        donors: [
          {
            id: "bell",
            name: "Jordan Bell",
            type: "individual",
            amountCents: 200000,
            evidenceIds: ["filing"],
            lobbying: point(
              "Registered lobbyist",
              "Jordan Bell is registered for this reporting period. Clients and issue areas are not established in these sources.",
              ["lobby"],
            ),
            interests: [],
            positions: [],
          },
          {
            id: "workers",
            name: "Neighborhood Workers Committee",
            type: "committee",
            amountCents: 800000,
            evidenceIds: ["filing"],
            lobbying: null,
            interests: [{ area: "labor", evidenceIds: ["labor"] }],
            positions: [],
          },
          {
            id: "partnership",
            name: "Example U.S.–Israel Partnership PAC",
            type: "committee",
            amountCents: 1200000,
            evidenceIds: ["filing"],
            lobbying: null,
            interests: [{ area: "foreign_policy", evidenceIds: ["foreign"] }],
            positions: [
              point("Stated position", "Supports U.S.–Israel relations.", [
                "foreign",
              ]),
            ],
          },
        ],
        outsideSpending: [
          {
            id: "support",
            spender: "Example Better City Committee",
            direction: "support",
            amountCents: 3200000,
            evidenceIds: ["outside"],
          },
          {
            id: "oppose",
            spender: "Example Accountability Committee",
            direction: "oppose",
            amountCents: 800000,
            evidenceIds: ["outside"],
          },
        ],
      },
    },
  };
  const sparse = (
    candidateId: string,
    name: string,
    revisionId: string,
  ): CandidateBrief => ({
    ...morgan,
    identity: { ...identity, candidateId },
    revisionId,
    authorship: { kind: "human" },
    evidence: [],
    research: undefined,
    sections: (
      [
        "priorities",
        "record",
        "mechanisms",
        "effects",
        "tradeoffs",
        "unknowns",
      ] as const
    ).map((topic) => ({
      topic,
      claims: [],
      missingEvidence: `No reviewed ${topic === "priorities" ? "campaign priorities" : topic} available for ${name}. Missing evidence is not a judgment of the candidate.`,
    })),
  });
  const briefs = [
    mode === "sparse"
      ? sparse("morgan", "Morgan Lee", morgan.revisionId)
      : morgan,
    sparse("alex", "Alex Rivera", "00000000-0000-4000-8000-000000000444"),
    sparse("sam", "Sam Taylor", "00000000-0000-4000-8000-000000000445"),
  ].map((brief) => candidateBriefSchema.parse(brief));
  return {
    manifest: {
      id: "00000000-0000-4000-8000-000000000446",
      ...identity,
      jurisdictionLabel: "Example City",
      office: "Mayor",
      rosterSourceUrl: "https://sources.example/roster",
      rosterHash: "b".repeat(64),
      rosterVerifiedAt: "2026-10-04T12:00:00Z",
      rosterVerifiedBy: "example-editor",
      members: briefs.map((brief, index) => ({
        candidateId: brief.identity.candidateId,
        revisionId: brief.revisionId,
        name:
          ["Morgan Lee", "Alex Rivera", "Sam Taylor"][index] ??
          "Example candidate",
        description: index === 0 ? "Councilmember" : "Candidate",
        ballotStatus:
          mode === "withdrawn" && index === 1
            ? "withdrawn_on_ballot"
            : "on_ballot",
      })),
      policyVersion: "fictional",
      sourceCheckedAt: "2026-10-04T12:00:00Z",
      expiresAt: "2026-10-05T12:00:00Z",
      currentHashes: {},
    },
    briefs,
    reviewedAt: "2026-10-04T12:00:00Z",
  };
}
