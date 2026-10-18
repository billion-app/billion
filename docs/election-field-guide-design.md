# Election interiors: candidate field guide

This revision starts from GitHub `main` at `00cb9260` (October 3, 2026 elections integration). It changes how readers explore candidates and evidence; it does not publish an independent brief, enable comparisons in production, ingest campaign finance, or change election access gates.

## Reader structure

The race detail exposes a direct **Research this candidate** action for every supplied candidate. Candidate identity, ballot status, source provenance, roster limitations, filters, statements and contact information remain available.

The candidate page has four expandable research cards using the How to Vote design language:

- **Promises & priorities:** the candidate's supplied statement is attributed and linked at the official source — not reprinted as a text block in the app. Discrete research questions help readers inspect the original. A reviewed independent brief, when supplied by the existing development fixture, separates promises, mechanisms, possible effects, tradeoffs and unknowns.
- **Background & record:** reviewed claims remain distinct from source-provided biography. Route parsing preserves an existing biography and its citation; it does not generate background prose. A missing publication keeps the existing coverage explanation.
- **Campaign funding:** an explicit research gap and official filing resources. California state/local offices route to FPPC's filing-directory resources, federal offices to FEC, and other offices to the election-office resource. This is resource routing, not a match to a candidate or committee. There are no invented donors, amounts, percentages, rankings or influence claims.
- **Office powers & limits:** the existing office responsibilities and their sources.

[CandidateResearchCards](../apps/expo/src/components/candidate-research/CandidateResearchCards.tsx) follows the How to Vote disclosure cards: icon tiles, availability labels, chevrons, inset details, and prominent blue source actions. Each card opens independently. [CandidateBrief](../apps/expo/src/components/ballot-evidence/CandidateBrief.tsx) retains its existing evidence cards, claim kinds, exact excerpts, locators, retrieval dates and original source links; the page groups its topics under the relevant research question. [Candidate detail](../apps/expo/src/app/candidate-detail.tsx) composes these around the current guide/provider data.

The October 5 reference refines the product direction: Billion gives readers starting points for their own research rather than implying it provides a complete picture. The How to Vote interior is the visual reference: navy background, compact slate disclosure cards, existing serif headings, icon tiles, availability labels, and clear blue source buttons. Prompts encourage readers to inspect original statements, recorded votes, meeting minutes, reporting periods, campaign receipts, outside spending, and office powers — as short questions, not paragraphs to skim. The app does not republish candidate statement prose inline; the original stays at its source. No new source is claimed to exist for a candidate. The comparison preview and all publication gates remain unchanged. See [comparison integration requirements](candidate-comparison-prototype.md).

## Research and visual decisions

Reviewed October 4, 2026:

| Primary reference                                                                                                                                                                              | Application                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [NN/G: comparison tables](https://www.nngroup.com/articles/comparison-tables/)                                                                                                                 | Put answers to one question together; support small mobile comparisons and retain explicit missing information. Reflow instead of compressing text at larger sizes. |
| [Pentagram: Scientific American](https://www.pentagram.com/work/scientific-american)                                                                                                           | Use a clear type hierarchy and flexible editorial structure for complex subjects. Use Billion's existing serif/sans families and production bill palette.           |
| [EAC: effective election design](https://www.eac.gov/election-officials/design)                                                                                                                | Organize voter information with clear, accessible communication and explicit actions. This page is research, not an official ballot or voting interface.            |
| [FEC: researching candidates](https://www.fec.gov/introduction-campaign-finance/how-to-research-public-records/candidates/) and [FPPC: filing search](https://www.fppc.ca.gov/search-filings/) | Link to the appropriate primary filing resources; distinguish campaign records from outside-group records. No financial data is supplied by this UI change.         |

These are design interpretations, not results of Billion user testing. Availability labels describe supplied information rather than score candidates. Portraits retain their existing sources and the existing icon fallback.

## Funding work still required

A candidate-level money visualization needs an authoritative candidate/committee match, reporting period, filing/amendment dates, receipt categories, separate outside-spending records and inspectable citations. State and local data need their own adapters. A contributor's employer must not be represented as the employer donating. Contribution data alone cannot establish a candidate's future votes. None of this ingestion is implemented here.

## Verification

Native captures and the design punch list live in [election-research-card artifacts](../artifacts/election-research-cards/). Review covers independent card expansion, missing and supplied records, finance research prompts, and statement source actions without inline reprint. Focused tests verify biography limits and federal versus state/local finance resource routing. Production iOS export verifies bundling; it does not remove editorial publication gates.
