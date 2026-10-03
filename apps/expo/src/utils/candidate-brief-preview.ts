import type { CandidateBrief } from "@acme/validators";

/** Bounded fictional UI examples. Never a production publication or editorial approval. */
export function candidateBriefPreview(
  mode: string | undefined,
): CandidateBrief | undefined {
  if (!__DEV__ || (mode !== "reviewed" && mode !== "mixed")) return undefined;
  const evidence = [
    {
      id: "promise",
      origin: "candidate" as const,
      excerpt: "I would prioritize roof repairs and publish project costs.",
    },
    {
      id: "record",
      origin: "primary_record" as const,
      excerpt:
        "The board member voted to publish quarterly construction reports.",
    },
    {
      id: "powers",
      origin: "primary_record" as const,
      excerpt:
        "The board approves the district budget; projects depend on available funding.",
    },
  ].map((e) => ({
    ...e,
    url: "https://example.org/fictional-candidate-preview",
    publisher: "Fictional preview source",
    locator: `Illustrative ${e.id} excerpt`,
    retrievedAt: "2026-10-02T00:00:00Z",
    documentDate: "2026-10-01",
    contentHash: "a".repeat(64),
  }));
  return {
    schemaVersion: 1,
    identity: {
      candidateId: "fictional-morgan",
      contestId: "fictional-board",
      jurisdiction: "fictional:ca",
      electionDate: "2026-11-03",
    },
    revisionId: "00000000-0000-4000-8000-000000000421",
    supersedes: null,
    correction: null,
    createdAt: "2026-10-02T00:00:00Z",
    authorId: "fictional-editor",
    authorship: { kind: "human" },
    evidence,
    sections: [
      {
        topic: "priorities",
        missingEvidence: null,
        claims: [
          {
            id: "priority",
            kind: "promise",
            text: "Morgan Lee says they would repair school roofs and make project costs easier to follow.",
            evidenceIds: ["promise"],
          },
        ],
      },
      {
        topic: "record",
        missingEvidence:
          mode === "mixed"
            ? "No verified record is available in this example. That does not establish a lack of experience."
            : null,
        claims:
          mode === "mixed"
            ? []
            : [
                {
                  id: "record",
                  kind: "fact",
                  text: "In this fictional record, Lee voted for quarterly construction reports.",
                  evidenceIds: ["record"],
                },
              ],
      },
      {
        topic: "mechanisms",
        missingEvidence: null,
        claims: [
          {
            id: "mechanism",
            kind: "analysis",
            text: "A board member could propose spending priorities and vote on the district budget. They would need support from other board members.",
            evidenceIds: ["powers"],
          },
        ],
      },
      {
        topic: "effects",
        missingEvidence: null,
        claims: [
          {
            id: "effect",
            kind: "analysis",
            text: "Funding repairs could improve buildings, but the statement does not specify which schools would receive work first.",
            evidenceIds: ["promise", "powers"],
          },
        ],
      },
      {
        topic: "tradeoffs",
        missingEvidence: null,
        claims: [
          {
            id: "tradeoff",
            kind: "analysis",
            text: "Repair spending would compete with other district needs. No cost estimate is provided in this fictional statement.",
            evidenceIds: ["promise", "powers"],
          },
        ],
      },
      {
        topic: "unknowns",
        missingEvidence:
          "The statement does not give a budget, funding source or timeline. The available sources do not establish those details.",
        claims: [],
      },
    ],
  };
}
