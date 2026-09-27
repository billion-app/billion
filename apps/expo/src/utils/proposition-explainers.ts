/** Editorial drafts grounded in the 2026 California official voter guide.
 * Only show a draft when the live guide still identifies the same measure.
 * Publication remains subject to the measure review in #334.
 */
export interface PropositionExplainer {
  officialTitle: string;
  headline: string;
  statusQuo: string;
  yes: string;
  no: string;
  mechanism: {
    beforeTitle: string;
    before: readonly string[];
    afterTitle: string;
    after: readonly string[];
  };
  implementation: string;
  affected: string;
  fiscal: string;
  analysisUrl: string;
}

export const PROPOSITION_AI_LABEL =
  "BILLION AI EXPLANATION · EDITORIAL REVIEW PENDING";

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
    headline: "Would authorize $11.25 billion in housing bonds",
    statusQuo:
      "California already helps fund some housing construction and home loans. The last statewide housing bond approved by voters was in 2024.",
    yes: "The state could sell $11.25 billion in bonds for affordable housing programs and veterans' home loans.",
    no: "This $11.25 billion bond authorization would not take effect. Existing housing programs would remain.",
    mechanism: {
      beforeTitle: "Today · existing programs",
      before: ["Housing grants and loans", "Veterans' home loans"],
      afterTitle: "New bond authority",
      after: ["$10B → housing programs", "$1.25B → veterans' home loans"],
    },
    implementation:
      "The state could sell $10 billion in bonds for housing programs and $1.25 billion for veterans' home loans. The General Fund would repay the housing-program bonds over time; participating veterans' loan payments would repay the veterans' bonds.",
    affected:
      "State housing programs, local governments, developers, tribes, eligible households, and veterans could use or administer the bond-funded programs. Funding would be allocated over multiple years.",
    fiscal:
      "The Legislative Analyst estimates $500 million to $600 million in annual General Fund repayment costs for about 25 years for the $10 billion housing-program bond. Veterans' loan payments are expected to repay the separate $1.25 billion veterans' bond. These are estimates, not guaranteed housing outcomes.",
    analysisUrl: "https://voterguide.sos.ca.gov/propositions/1/analysis.htm",
  },
  "5": {
    officialTitle:
      "CHANGES RECALL ELECTION PROCESS FOR STATEWIDE OFFICERS. LEGISLATIVE CONSTITUTIONAL AMENDMENT.",
    headline: "Would make state recall ballots about removal only",
    statusQuo:
      "A state recall ballot now asks voters whether to remove an official and whom to elect as a replacement if the recall succeeds.",
    yes: "A recall ballot would ask only whether to remove the official. A vacancy would then be filled by a special election, appointment, or Lieutenant Governor succession, depending on the office and timing.",
    no: "The current two-question recall ballot would continue, including the replacement-candidate question.",
    mechanism: {
      beforeTitle: "Today · one recall ballot",
      before: ["Remove the official?", "Choose a replacement?"],
      afterTitle: "Two-stage process",
      after: [
        "Recall ballot → removal only",
        "If removed → vacancy",
        "Vacancy → election, appointment, or Lt. Governor succession",
      ],
    },
    implementation:
      "Legislative vacancies typically would go to a special election. Other offices generally would be filled by appointment. If the Governor is recalled before the next statewide election's nomination deadline during the first two years of the term, the Lieutenant Governor serves until voters elect a new Governor at a future statewide election. If recalled later, the Lieutenant Governor serves for the rest of the term.",
    affected:
      "Voters in future state recalls, candidates for replacement, the Governor, and state and county election officials would use the changed process. It matters only if a state recall occurs.",
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
