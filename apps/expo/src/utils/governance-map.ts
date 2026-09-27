/** Reviewed, fixed teaching examples. Never infer these relationships from ballot prose. */
export type GovernanceExample = "governor" | "prop-4-2026";
export interface GovernanceNode {
  id: string;
  label: string;
  detail: string;
  kind: "choice" | "power" | "check" | "condition";
  source: string;
}
export interface GovernanceMap {
  title: string;
  eyebrow: string;
  takeaway: string;
  caveat: string;
  nodes: readonly GovernanceNode[];
  sources: readonly { id: string; label: string; url: string }[];
}

export const governanceMaps: Record<GovernanceExample, GovernanceMap> = {
  governor: {
    title: "California Governor",
    eyebrow: "2026 STATEWIDE OFFICE · FOUR-YEAR TERM",
    takeaway:
      "Voters choose the next state chief executive. The new term begins January 4, 2027; lawmakers check key powers.",
    caveat:
      "A candidate’s promises describe goals, not powers or guaranteed results. Election results depend on all votes cast and certified.",
    nodes: [
      {
        id: "vote",
        label: "Voters elect a Governor",
        detail:
          "Eligible ballots contribute to a statewide count. One ballot does not decide the result.",
        kind: "choice",
        source: "results",
      },
      {
        id: "result",
        label: "Certified statewide result",
        detail:
          "County canvasses feed the official statewide result, which the Secretary of State certifies after counting is complete.",
        kind: "condition",
        source: "results",
      },
      {
        id: "office",
        label: "Winning candidate takes office January 4, 2027",
        detail:
          "The winning candidate's term begins the Monday after January 1 following the election: January 4, 2027. The Governor is the state's chief executive for a four-year term, subject to the constitutional two-term limit.",
        kind: "power",
        source: "constitution",
      },
      {
        id: "budget",
        label: "Propose a state budget",
        detail:
          "The Governor submits a budget proposal to the Legislature. A proposal does not itself authorize spending.",
        kind: "power",
        source: "budget",
      },
      {
        id: "law",
        label: "Sign or veto bills",
        detail:
          "The Governor can sign or veto bills passed by the Legislature.",
        kind: "power",
        source: "constitution",
      },
      {
        id: "appointments",
        label: "Make authorized appointments",
        detail:
          "The Governor appoints administration officials and members of boards and commissions, as authorized by law.",
        kind: "power",
        source: "appointments",
      },
      {
        id: "legislature",
        label: "Legislature checks the office",
        detail:
          "Lawmakers pass the budget and bills. A two-thirds vote in each house can override a veto.",
        kind: "check",
        source: "constitution",
      },
      {
        id: "confirmation",
        label: "Senate reviews some appointments",
        detail:
          "Some Governor-appointed positions are subject to Senate confirmation.",
        kind: "check",
        source: "confirmation",
      },
      {
        id: "courts",
        label: "Courts resolve legal disputes",
        detail:
          "California courts are a separate branch that interprets and applies law in cases brought before them. Court review is not automatic after each Governor decision.",
        kind: "check",
        source: "courts",
      },
    ],
    sources: [
      {
        id: "results",
        label: "California Secretary of State: election results and canvass",
        url: "https://voterguide.sos.ca.gov/voter-info/election-results.htm",
      },
      {
        id: "constitution",
        label:
          "California Constitution, Articles IV and V (Governor term: Article V, Section 2)",
        url: "https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/2023-24_Constitution_Final_wCover.pdf",
      },
      {
        id: "budget",
        label: "California Department of Finance: budget process",
        url: "https://dof.ca.gov/budget/budget-process-overview/",
      },
      {
        id: "appointments",
        label: "Governor’s Office: appointments",
        url: "https://www.gov.ca.gov/join-the-administration/government-appointments/",
      },
      {
        id: "confirmation",
        label: "California Government Code §1774",
        url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1774.&lawCode=GOV",
      },
      {
        id: "courts",
        label: "Judicial Branch of California: independence and accountability",
        url: "https://courts.ca.gov/goal-ii-independence-and-accountability",
      },
    ],
  },
  "prop-4-2026": {
    title: "Proposition 4",
    eyebrow: "NOVEMBER 2026 · STATEWIDE MEASURE",
    takeaway:
      "Proposition 4 concerns public funding of candidate campaigns. Yes would lift a ban; officials would still decide later whether to create a program.",
    caveat:
      "Neither choice creates or funds a program on election night. Any program would require later decisions and must follow the measure’s limits.",
    nodes: [
      {
        id: "vote",
        label: "Ballots join the statewide count",
        detail:
          "Eligible ballots contribute to the statewide count. The result depends on all votes cast and the official canvass, not one reader's choice.",
        kind: "choice",
        source: "results",
      },
      {
        id: "current",
        label: "Current rule",
        detail:
          "State law bans public funds for most state and local candidate campaigns. Some charter cities are exceptions.",
        kind: "choice",
        source: "lao",
      },
      {
        id: "result",
        label: "Certified statewide result",
        detail:
          "After counties canvass ballots, the Secretary of State certifies the statewide result. The map shows conditional paths, not a prediction.",
        kind: "condition",
        source: "results",
      },
      {
        id: "yes",
        label: "If Yes passes",
        detail:
          "The ban is lifted. State and local governments could choose to create programs, within limits on funding, eligibility, and spending.",
        kind: "power",
        source: "lao",
      },
      {
        id: "next",
        label: "If Yes passes: further decisions",
        detail:
          "Officials would have to design and adopt any program. Money earmarked for education, transportation, or public safety could not be used.",
        kind: "condition",
        source: "lao",
      },
      {
        id: "no",
        label: "If the measure fails",
        detail:
          "State and most local governments remain unable to create these programs under the existing rule.",
        kind: "check",
        source: "lao",
      },
      {
        id: "adopt",
        label: "Officials could adopt a program later",
        detail:
          "If the measure passes, a state or local government could later design and approve a qualifying public campaign financing program within the measure's limits.",
        kind: "condition",
        source: "lao",
      },
      {
        id: "decline",
        label: "Officials could decide not to adopt one",
        detail:
          "Lifting the ban would permit future programs but would not require a government to create or fund one.",
        kind: "condition",
        source: "lao",
      },
    ],
    sources: [
      {
        id: "results",
        label: "California Secretary of State: election results and canvass",
        url: "https://voterguide.sos.ca.gov/voter-info/election-results.htm",
      },
      {
        id: "lao",
        label: "Legislative Analyst’s Office: Proposition 4 analysis",
        url: "https://lao.ca.gov/BallotAnalysis/Proposition?number=4&year=2026",
      },
      {
        id: "sos",
        label: "Secretary of State: 2026 voter guide",
        url: "https://voterguide.sos.ca.gov/propositions/4/index.htm",
      },
    ],
  },
};

export function exampleForOffice(
  office: string,
  levels = "",
  district = "",
): GovernanceExample | null {
  if (
    !/^(?:governor|governor of california|california governor)$/i.test(
      office.trim(),
    )
  )
    return null;
  const context = `${levels} ${district}`.toLowerCase();
  return /california|\bca\b/.test(context) ? "governor" : null;
}

export function exampleForMeasure(
  number: string,
  electionDate: string,
  state: string,
): GovernanceExample | null {
  return number.trim() === "4" &&
    electionDate === "2026-11-03" &&
    /^(?:CA|California)$/i.test(state.trim())
    ? "prop-4-2026"
    : null;
}
