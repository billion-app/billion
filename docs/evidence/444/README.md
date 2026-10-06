# Contextual explanation pilot — issue 444

This is a **pending editorial pilot**, not published explanation. The production
registries remain empty. The API returns `contextualExplanation: null` and the
reader preserves the official record. No content-generation model, ingestion, shared database write,
or release was run for this work.

## Source-backed records

The three records use the same validated contract and renderer:

- Proposition 3: removing the higher income-tax rates’ sunset, the constitutional
  amendment path, variable revenue and a labelled budget-scale calculation.
- Proposition 39: registration and voting baseline, separate in-person/mail ID
  changes, free-ID limits, auditor findings versus action by officials/lawmakers/
  courts, practical error/cure unknowns, privacy limits and historical follow-through.
- Proposition 2: reserve formula/cap/debt-payment changes, actor and money flow,
  competing infrastructure use, a worked cap example and emergency counterexample.

The supplied SOS pages identify **November 3, 2026**. `guide.json` is a bounded
three-entry capture using the repository’s official-guide parser, **not a complete
live guide**. The HTML-derived text files and PDF-derived law text preserve the
captured evidence. The PDF extraction also contains adjacent propositions and
cannot retain strikeout/italics; **review the original PDFs** when comparing
current/proposed provisions. Proposition 3’s expiration deletion was checked in
the rendered PDF on page 114. References use provision/page locators, not invented
quotations. Additional captures preserve the constitutional amendment procedure,
current SOS signature-correction instructions and State Auditor evidence.

The auditor examples are selected research starting points, not a representative
sample or an election-audit effectiveness estimate. The January 2024 follow-up
report distinguishes auditor-reported additional tax revenue from net audit savings
and scopes the overdue-recommendation cohort with its denominator and timeframe.
The pilot has no verified estimate of present impersonation prevalence, effect on
eligible voters, isolated election-audit cost, or realized benefit of the proposal.

## Data and publication path

`@acme/validators` owns the versioned context contract. Each claim identifies its
source-summary, inference, illustration or evidence-limit layer and references a
source plus locator. Sources retain their own legal/analysis/advocacy/research
layer, URL, retrieval time and server-only snapshot. Arrays are bounded; there is
no required equal-sided argument structure or vote/desirability score.

`proposition-context.ts` validates drafts, binds review to a digest of all parsed
content (including every captured source), checks exact election/number/title/URL
and the guide hash, and requires each source key (URL/layer) to have exactly one latest adopted capture and match its snapshot
in `currentContextSources`. Editing claims or snapshots, changing the guide or
adopting newer evidence invalidates approval. Missing evidence withholds the whole
revision. Snapshot bodies stay off the public API. Reads do not fetch or generate.

A source changing remotely is detected only when an operator adopts a new capture;
this PR does not add a polling job or pretend a mutable URL is a freshness guarantee.
Editors must verify source coverage, legal interpretation and claim support: a
schema/reference check cannot establish that a citation proves an inference.

For review, use the read-only tool with a captured guide and a revision. Its
`publishable` result compares the revision with its supplied captures; it **does
not approve content or certify production registration**. See the commands in
[measure enrichment](../../measure-enrichment.md#contextual-explanation-review).

`development/context-pilots.json` contains only public projections of these
pending records, without evidence snapshots. The development preview validates the public schema and parses them
and feeds the production renderer; production has no preview fallback. This is
not a special case by proposition number: process questions, claims, sources,
unknowns and optional scenarios/history/magnitude are all record data.

## Verification and remaining gates

Screenshots come from the running Expo **web** development app at 390 × 844,
including collapsed answers, expanded actor chain and source disclosure.
`live-guide-prop39-*` shows the actual proposition-detail route reading the configured
existing live API’s official guide: the new explanation is withheld and the original
record remains usable. This confirms the missing-field compatibility path; the new
API publication helper is exercised offline, not deployed to that service. The
fallback source link was clicked in the running web app and opened the correct
SOS proposition page in a browser tab. Missing,
stale and error views are labelled development scenarios. The stale state’s
withholding behavior is separately exercised at the API gate; the preview is not
a live source-refresh demonstration. Enlarged text is a browser simulation,
not native Dynamic Type verification. Tablet capture uses a wider web viewport.

Independent Astra reviewed the original screenshots before code. It correctly
explained sunset versus funding guarantees and auditor recommendations versus
implementation/court action, and formed further questions. Its refinements
separated legal requirements from inference, strengthened evidence controls and
made the process question specific through record data. Its code audit found an ambiguous adopted-capture bug and missing AI attribution; the gate now rejects multiple captures for the same source key and the authorship field explicitly labels AI-assisted prose. Regression tests cover both capture orders and exact preview/draft projection parity. This is adversarial model
comprehension evidence, **not novice human-reader validation**.

Required before publication:

1. An editor under #334/#409 verifies every claim/provision, source version,
   historical selection and current-law/cure coverage; approves immutable revisions
   and adopts their source captures in the production registries.
2. Real novice readers explain permanence, auditor powers/next actors, historical
   evidence strength, ID burdens/unknowns and reserve conditions, while forming
   their own research questions.
3. Native phone/large-text accessibility and external-link behavior are checked;
   production bundle exports are compilation evidence only.
4. Broader voter-ID empirical evidence, current-law exception/cure detail and
   representative historical follow-up require research. Missing values remain
   explicit. Proposition 42 contextual explanation is not included in this bounded
   pilot; cross-measure interactions remain separately owned by #447.

Keep the PR draft and issue open while these gates remain. No merge/deployment/
OTA/TestFlight action is included in this work.

## Monetary context follow-up

Every explicit currency amount in these pilots now renders its nominal USD value
and budget context together, including historical outcomes and worked examples.
The shared validated contract in [budget-context.ts](../../../packages/validators/src/budget-context.ts)
calculates a share only from a cited denominator with matching scope. The reserve
example uses explicitly assumed annual General Fund tax revenues; its reserve
balance is a stock and is labelled budget-share inapplicable. The future revenue
projection lacks matching future budgets, the combined state/local cost estimate
lacks a combined denominator, and the tobacco-tax follow-up lacks a matched program
budget. These show comparison-unavailable reasons rather than invented ratios.

Screenshots `prop*-money-*.png` show these running development records on phone
web. The new source-backed content remains pending editorial review. Shared tests
cover ratio calculations, ranges, currency, mismatched scope, unavailable labels,
population-count detection, uncovered claims and denominator review invalidation.

Monetary qualifiers such as “less than” and “about” remain part of the nominal
amount. These cannot become exact numeric shares; absent a supported matched
comparison they use the explicit unavailable path. Available shares require a
known gross/net basis. The shared presentation helper returns separate amount,
comparison, scope and reason lines so both readers use the same calculation.
