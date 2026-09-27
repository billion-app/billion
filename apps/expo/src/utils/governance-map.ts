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
      "Voters choose the state’s chief executive. Lawmakers check key powers.",
    caveat:
      "A candidate’s promises describe goals, not powers or guaranteed results. Election results depend on all votes cast and certified.",
    nodes: [
      {
        id: "vote",
        label: "Voters elect a Governor",
        detail:
          "The statewide election selects an officeholder for a four-year term, subject to the constitutional two-term limit.",
        kind: "choice",
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
    ],
    sources: [
      {
        id: "constitution",
        label: "California Constitution, Articles IV and V",
        url: "https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=CONS",
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
    ],
  },
  "prop-4-2026": {
    title: "Proposition 4",
    eyebrow: "NOVEMBER 2026 · STATEWIDE MEASURE",
    takeaway:
      "A Yes result would lift a ban. Later officials would decide whether to create a public campaign financing program.",
    caveat:
      "Neither choice creates or funds a program on election night. Any program would require later decisions and must follow the measure’s limits.",
    nodes: [
      {
        id: "current",
        label: "Current rule",
        detail:
          "State law bans public funds for most state and local candidate campaigns. Some charter cities are exceptions.",
        kind: "choice",
        source: "lao",
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
    ],
    sources: [
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
