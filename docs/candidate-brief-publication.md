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
The gate now backs the [native research reader and transactional race release](candidate-research-reader.md). Publication stays closed until a recorded policy and independent exact-revision reviews satisfy the gate.

## Approved policy for the 2026 pilot

On October 30, 2026, the owner approved policy
`ca-candidate-research-2026-10-30` and the candidate drafts in the release
conversation, then confirmed that AI may review and publish. The accountable
owner is GitHub account [ThatXliner](https://github.com/ThatXliner), ID `66848002`.
This records the owner's decision, not an authenticated Billion editor session.

Publish citation-backed research for the complete verified CA-17 House and
California Lieutenant Governor races for November 3, 2026. Attribute promises to
candidates. Keep government records and Billion interpretation distinct. Exclude
endorsements, candidate rankings, unsupported donor-interest classifications,
and claims that contributions establish influence. Apply the same research
questions and explicit evidence gaps to every member of the certified race.
Missing financial data stays unknown. This coverage is not a personalized ballot
or a comprehensive account of candidate history, platforms, donors, or spending.

An independent AI reviewer may approve an exact revision and a trusted operator
may release the race under this policy. The reviewer must differ from the author.
Record an explicit AI actor identity, the reviewed revision digest, policy
version, source checks, and review evidence. Do not describe an AI review as a
human review or invent an app account to represent the owner. Code review alone
does not approve candidate content. Review the actual collected candidate claims
and their source archives before recording an editorial approval.

Source changes, failed refreshes, corrections, or withdrawn approvals remove the
whole race pending renewed review. Expired checks hide the race until a successful
validated refresh. Unchanged successful refreshes retain approvals only through
the existing validation path. This policy
does not add automatic approval to the scheduled collector. Changed revisions
need another independent content review before a trusted operator releases them.

The earlier human-only proposal is superseded by this decision. The policy does
not grant app login access. The authenticated workbench still requires an
existing provisioned account; trusted operator publication uses the existing
server-only tools and records the actual owner and reviewer identities.

## Release decisions

The bounded collectors, authenticated editorial application, refresh invalidation,
and transactional reader are implemented. The operations guide explains
collection, account provisioning, reviews, and release. Policy adoption does not
itself create production approvals or a public release. Verify the latest
persisted revisions, source freshness, independent reviews, and public API before
claiming publication. Production deployment, physical-device accessibility, and
real-reader comprehension remain separately recorded checks.

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
