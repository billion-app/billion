/** Editorial drafts grounded in the 2026 California official voter guide.
 * Only show a draft when the live guide still identifies the same measure.
 * Publication remains subject to the measure review in #334.
 */
export interface PropositionExplainer {
  officialTitle: string;
  headline: string;
  takeaway: string;
  voteTitleYes: string;
  voteTitleNo: string;
  voteBriefYes: string;
  voteBriefNo: string;
  caveat?: string;
  detailTitle: string;
  detailRows: readonly { label: string; text: string }[];
  fiscal: string;
  analysisUrl: string;
}

export const PROPOSITION_AI_LABEL =
  "Billion AI draft · Editorial review pending";

export function propositionDetailRoute(number: string) {
  return {
    pathname: "/proposition-detail" as const,
    params: { number },
  };
}

/** The guide sometimes returns a "no argument submitted" notice in the argument slot. */
export function submittedGuideArguments(
  argumentsFromGuide: readonly { text: string }[] | undefined,
): { text: string }[] {
  return (argumentsFromGuide ?? []).filter(
    (argument) => !/^NO ARGUMENT (?:FOR|AGAINST)\b/i.test(argument.text.trim()),
  );
}

const explainers: Record<string, PropositionExplainer> = {
  "1": {
    officialTitle:
      "AUTHORIZES BONDS FOR HOUSING AFFORDABILITY PROGRAMS. LEGISLATIVE STATUTE.",
    headline: "Housing bonds",
    takeaway: "Would authorize new bonds for housing and veterans' home loans.",
    voteTitleYes: "Authorize new bonds",
    voteTitleNo: "No new bond authorization",
    voteBriefYes:
      "Authorize $11.25 billion in bonds for housing programs and veterans' home loans.",
    voteBriefNo: "Keep current programs without this new bond authorization.",
    detailTitle: "Where would the money go?",
    detailRows: [
      {
        label: "Housing programs",
        text: "$10 billion for affordable housing programs. The state General Fund would repay these bonds over time.",
      },
      {
        label: "Veterans' home loans",
        text: "$1.25 billion for loans, repaid through participating veterans' loan payments.",
      },
    ],
    fiscal:
      "The Legislative Analyst estimates $500 million to $600 million in annual General Fund repayment costs for about 25 years for the $10 billion housing-program bond. Veterans' loan payments are expected to repay the separate $1.25 billion veterans' bond. These are estimates, not guaranteed housing outcomes.",
    analysisUrl: "https://voterguide.sos.ca.gov/propositions/1/analysis.htm",
  },
  "5": {
    officialTitle:
      "CHANGES RECALL ELECTION PROCESS FOR STATEWIDE OFFICERS. LEGISLATIVE CONSTITUTIONAL AMENDMENT.",
    headline: "State recall elections",
    takeaway: "Changes how an official is replaced after a future recall.",
    voteTitleYes: "Change the process",
    voteTitleNo: "Keep the current process",
    voteBriefYes:
      "Future recall ballots would ask only whether to remove the official. If removal passes, a separate process fills the vacancy.",
    voteBriefNo:
      "Future recall ballots would still ask both whether to remove the official and who should replace them.",
    caveat: "This proposition does not recall anyone.",
    detailTitle: "Who would fill the vacancy?",
    detailRows: [
      {
        label: "Legislature",
        text: "A special election would typically fill a recalled legislator's seat.",
      },
      {
        label: "Other state offices",
        text: "An appointment would generally fill the vacancy.",
      },
      {
        label: "Governor",
        text: "The Lieutenant Governor would take over. If the recall occurs in the first two years before the next statewide election's nomination deadline, voters would elect a new Governor at a future statewide election. Otherwise, the Lieutenant Governor would serve the rest of the term.",
      },
    ],
    fiscal:
      "The Legislative Analyst says the net fiscal effect is unknown. A separate special election could cost millions; a shorter recall ballot could save millions. The outcome depends on which offices are recalled and when.",
    analysisUrl: "https://voterguide.sos.ca.gov/propositions/5/analysis.htm",
  },
};

export function propositionExplainer(
  number: string,
  officialTitle: string,
  sourceUrl: string,
): PropositionExplainer | null {
  const item = explainers[number];
  if (!item) return null;
  if (officialTitle.trim().toUpperCase() !== item.officialTitle) return null;
  if (sourceUrl !== `https://voterguide.sos.ca.gov/propositions/${number}/`)
    return null;
  return item;
}
