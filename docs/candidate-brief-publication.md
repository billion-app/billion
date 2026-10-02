# Reviewed candidate briefs: gated implementation and policy proposal

Independent briefs remain unpublished. The public `candidateBriefs.get` procedure
returns `policy_pending`, zero reviewed candidates and an unknown roster count.
It performs no database access, generation or provider fetch. The candidate page
shows the complete-race publication gap without implying poor qualifications.

## Implemented contract

[The shared schema](../packages/validators/src/candidate-brief.ts) separates
promises, documented facts, disputed claims and Billion analysis. Each claim
references versioned evidence containing an excerpt, hash, publisher, URL and
locator. Six required topics include explicit missing-evidence states. Identity
uses provider candidate and contest IDs, jurisdiction and election date; names
are never identifiers. The comparison work in #423 should consume this contract
rather than summaries extracted from statements.

The dedicated revision and review-event tables retain documents independently
of normalized ballot persistence. Revisions are intended to be append-only;
there is deliberately no public writer or editor role assigned yet. They are
storage scaffolding. Trusted server-only draft/review functions validate identity
and refuse self-approval; they are not an authenticated editorial tool.

[The deterministic gate](../packages/api/src/lib/candidate-brief-publication.ts)
requires an approved policy, a verified complete race roster, one revision per
candidate, an independent editor's approval bound to the exact revision digest
and policy version, and current evidence hashes. Source changes, withdrawals,
invalid citations and incomplete rosters suppress the entire race. It does not
establish whether evidence supports a claim; that is an editorial responsibility.
The gate is a tested prototype and is not connected to production publication.

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
review dates and covered/total counts from the verified roster. Start with one
bounded California statewide race; #100's local statement expansion and #333's
national matching tests do not establish roster completeness or review readiness.

## Remaining release gates and operations proposal

1. Editorial owner approves the minimum policy and its 2026 scope under #344.
2. Select a certified race roster with stable provider IDs. Retain its snapshot,
   hash and verification date. Do not use the submitted-statement guide as roster.
3. Build authenticated editorial tooling with restricted append-only writes and
   audit events; apply the forward migration to a verified local/staging target.
4. Review primary-source incumbent and non-incumbent examples, identity collisions,
   sparse evidence and correction cases. Synthetic tests are not reviewed content.
5. On every source refresh, compare content hashes and invalidate affected race
   releases before reads. Source fetch failures must also close publication.
6. For corrections, withdraw the current revision first; create a successor with
   the reason and previous revision ID, retain both versions, and re-review the
   whole race. Rollback selects an older revision only after fresh source checks
   and new approval; a previous approval alone is insufficient.
7. Wire a transactionally published race release and its current-source manifest
   through tRPC to mobile. Test real-reader comprehension, large text and the
   production mobile flow before enabling. No release is authorized here.

These are exact blockers to live analysis, not a claim that the editorial review
or deployment has happened. The existing statement citations remain independent.

## Reader-facing prototype

The candidate screen keeps one visible missing-coverage message and an immediate
link to the election office. It shows available statements and office duties;
it does not create separate empty sections for absent fields. The qualification
limit stays visible. Coverage policy and source/review metadata use disclosures.
A populated brief leads with the existing potential-effects claim, keeps all
claim text and specific evidence gaps visible, and puts only supporting source
excerpts and revision metadata behind controls. This changes reading order, not
evidence or publication eligibility.

Development builds can show bounded fictional populated and mixed examples on
the same candidate-detail route: `briefPreview=reviewed` or `briefPreview=mixed`
requires the serialized candidate name `Morgan Lee (fictional)`. The page labels
these examples “Fictional preview · not published.” Production ignores the
preview modes. These fixtures exercise the renderer; they do not exercise a
published race, editorial approval, or a source-to-production data flow.
