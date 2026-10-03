import type { RaceComparison } from "./model";

/** Fictional records, inspectable in the prototype; never claims about real candidates. */
export function comparisonFixture(scenario: string): RaceComparison {
  const count = scenario === "long" ? 8 : scenario === "two" ? 2 : 3;
  const sparse = scenario === "sparse";
  const names = [
    "Alex Rivera",
    "Jordan Chen",
    "Sam Patel",
    "Morgan Ellis",
    "Taylor Brooks",
    "Casey Nguyen",
    "Drew Wilson",
    "Riley Jones",
  ];
  return {
    raceId: "fictional-council-2028",
    office: "Example City Council",
    election: "Fictional election · November 2028",
    fixture: true,
    questions: {
      priorities: "Where would they put city funds?",
      record: "What does the documented record show?",
      effects: "How could their plans work?",
      questionnaire: "What did they say in the questionnaire?",
    },
    sources: [
      {
        id: "rivera",
        name: "Fictional Rivera statement",
        locator: "Priority paragraph",
        fixtureText:
          "I propose using city funds to increase bus frequency. I would seek council approval of the budget.",
      },
      {
        id: "chen",
        name: "Fictional Chen statement",
        locator: "Priority paragraph",
        fixtureText:
          "I propose redirecting city funds toward street repairs. I would seek council approval of the budget.",
      },
      {
        id: "minutes",
        name: "Fictional council minutes",
        locator: "Item 4, recorded vote",
        fixtureText:
          "Councilmember Rivera voted for a bus-service budget increase. The motion passed 4–3.",
      },
    ],
    candidates: names.slice(0, count).map((name, index) => ({
      id: `fictional-${index}`,
      name,
      identity:
        index === 0
          ? "Incumbent · Example district"
          : "Challenger · Example district",
      ballotStatus: index === 2 ? "withdrawn-still-on-ballot" : "on-ballot",
      cells: {
        priorities:
          !sparse && index < 2
            ? {
                status: "available",
                claims: [
                  {
                    headline:
                      index === 0 ? "More frequent buses" : "Street repairs",
                    pictogram: index === 0 ? "bus" : "roadworks",
                    text: "City funds · Would seek council approval",
                    attribution: "Candidate statement",
                    sourceIds: [index === 0 ? "rivera" : "chen"],
                  },
                ],
              }
            : { status: "missing-evidence" },
        record:
          !sparse && index === 0
            ? {
                status: "available",
                claims: [
                  {
                    headline: "Voted to increase the bus-service budget",
                    text: "Supported a city bus-service budget increase.",
                    attribution: "Documented record",
                    sourceIds: ["minutes"],
                  },
                ],
              }
            : { status: "missing-evidence" },
        effects: { status: "unavailable-analysis" },
        questionnaire: { status: "unanswered-questionnaire" },
      },
    })),
  };
}
