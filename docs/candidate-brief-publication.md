# Candidate brief publication and editorial policy

Public briefs require a versioned publication policy and independent approval of
an entire current certified race. Publication defaults to closed. The
[collection and editorial guide](candidate-research-collection.md) describes the
implemented CA-17 source ingestion, authenticated review workbench and refresh
lifecycle. Real collected drafts do not imply editorial approval.

## Implemented contract

[The shared schema](../packages/validators/src/candidate-brief.ts) separates
promises, documented facts, disputed claims and Billion analysis. Each claim
references versioned evidence containing an excerpt, hash, publisher, URL and
locator. Six required topics include explicit missing-evidence states. Identity
uses provider candidate and contest IDs, jurisdiction and election date; names
are never identifiers. The comparison work in #423 should consume this contract
rather than summaries extracted from statements.

Dedicated revision and review-event tables retain append-only documents separately
from normalized ballot persistence. Authenticated editors can create successor
revisions and approve another author's exact revision; publisher roles control
policy and complete-race release. Original source snapshots remain separate.

[The deterministic gate](../packages/api/src/lib/candidate-brief-publication.ts)
requires an approved policy, a verified complete race roster, one revision per
candidate, an independent editor's approval bound to the exact revision digest
and policy version, and current evidence hashes. Source changes, withdrawals,
invalid citations and incomplete rosters suppress the entire race. It does not
establish whether evidence supports a claim; that is an editorial responsibility.
The gate now backs the [native research reader and transactional race release](candidate-research-reader.md). Production publication remains disabled pending the human policy and source-review gates.

## Proposed resolution of #401 / #344 scheduling

For 2026, approve a minimum **single-candidate independent brief** policy under
#344 as a separately scoped decision. Keep Dual-Lens, comparative rankings,
endorsements and persuasion deferred. A code review does not approve this policy.
An accountable human editorial owner must accept it and record a version and
approval date before any feature switch can open.

The minimum proposal requires primary evidence for documented facts; clear
candidate attribution for promises; allegation provenance, response and dispute
status; office powers grounding for potential mechanisms; explicit uncertainty
and unequal evidence disclosure. Lack of evidence cannot count against someone.
Publish only complete certified races, including non-statement candidates, with
review dates and covered/total counts from the verified roster. The implemented first collection is the bounded CA-17 House race; #100's local statement expansion and #333's
national matching tests do not establish roster completeness or review readiness.

## Release decisions

The bounded CA-17 roster, source collection, authenticated editorial application,
refresh invalidation and transactional reader are implemented. The operations
guide explains how to collect, provision accounts, review and publish. The pilot
has real source data but has not received human editorial approval. An accountable
publisher must approve policy and editors must review every exact revision before
release. Production migrations, deployment, physical-device accessibility and
real-reader comprehension acceptance remain separately recorded release steps.

For corrections, create a successor with its reason and previous revision ID.
The whole race is withdrawn until fresh independent review. Failed source refresh
also withdraws the race; successful recovery does not reuse old approvals.

## Earlier reader-facing prototype

The candidate screen keeps one visible missing-coverage message and an immediate
link to the election office. It shows available statements and office duties;
it does not create separate empty sections for absent fields. The qualification
limit stays visible. Coverage policy and source/review metadata use disclosures.
A populated brief presents candidate priorities and documented record before
governing mechanisms and potential effects. Quote, document, layers and question
icons accompany explicit promise, fact, analysis and missing-information labels;
muted category accents distinguish attribution, never candidate merit. All claim text and
specific evidence gaps remain visible. Only supporting source excerpts and
revision metadata sit behind controls. This changes presentation, not evidence
or publication eligibility. Compact slate cards, 14-pixel corners, hairlines,
editorial headings and smaller body/source typography follow the current
`BillBrief` renderer. Candidate statements and excerpts retain their distinct
source-text styling; election information does not borrow legislative status
or outcome colors.

Development builds can show bounded fictional populated and mixed examples on
the same candidate-detail route: `briefPreview=reviewed` or `briefPreview=mixed`
requires the serialized candidate name `Morgan Lee (fictional)`. The page labels
these examples “Fictional preview · not published.” Production ignores the
preview modes. These fixtures exercise the renderer; they do not exercise a
published race, editorial approval, or a source-to-production data flow.
