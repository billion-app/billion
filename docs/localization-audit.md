# Chinese mobile-page audit — October 18, 2026

This follow-up audits every Expo page after [#495](https://github.com/billion-app/billion/pull/495) (interface) and [#496](https://github.com/billion-app/billion/pull/496) (news cards). “Chinese” applies to application copy and generated explanations, including the full article. It does not rewrite official documents, quoted evidence, cited source titles, names, addresses or private notes. Those retain source identity and are labeled as original material. Translation misses are explicitly marked as preparing, with retry/English controls; the entire archive is not pretranslated by this release.

The audit combined route/component source inspection, catalog checks, server translation allowlist/provenance tests and live-data reader checks. Static inspection is not a claim that every possible record or authenticated state was manually opened. Development fixtures and unpublished editorial releases are not production publication evidence.

## Page inventory

| Expo page                          | Audit coverage                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `(onboarding)/welcome.tsx`         | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `(tabs)/elections.tsx`             | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `(tabs)/feed.tsx`                  | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `(tabs)/feedback.tsx`              | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `(tabs)/index.tsx`                 | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `(tabs)/settings.tsx`              | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `+not-found.tsx`                   | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `accountability-preview.tsx`       | Chinese interface catalog; development/editorial fixture prose remains explicitly illustrative source data.                   |
| `article-detail.tsx`               | Live bill, court and executive readers; full explanation, arguments, deep dive and timeline; protected original-source tabs.  |
| `ballot-preparation.tsx`           | Static catalog and dynamic ballot/preparation translation paths; signed source binding tests; original statements preserved.  |
| `ballot.tsx`                       | Static catalog and dynamic ballot/preparation translation paths; signed source binding tests; original statements preserved.  |
| `bill-sponsor-profile.tsx`         | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `candidate-comparison-preview.tsx` | Chinese interface catalog; development/editorial fixture prose remains explicitly illustrative source data.                   |
| `candidate-detail.tsx`             | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `candidate-promise.tsx`            | Published research translation allowlist and release gates; source evidence preserved; empty state checked.                   |
| `candidate-research.tsx`           | Published research translation allowlist and release gates; source evidence preserved; empty state checked.                   |
| `contest-detail.tsx`               | Static catalog and dynamic ballot/preparation translation paths; signed source binding tests; original statements preserved.  |
| `election-access.tsx`              | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `election-process.tsx`             | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `guide-preparation.tsx`            | Static catalog and dynamic ballot/preparation translation paths; signed source binding tests; original statements preserved.  |
| `local-decision-detail.tsx`        | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `local-decisions.tsx`              | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `local-elections.tsx`              | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `measure-detail.tsx`               | Static catalog and dynamic ballot/preparation translation paths; signed source binding tests; original statements preserved.  |
| `modal.tsx`                        | Page and shared-component source audit; Chinese static catalog, shared language control, localized metadata where applicable. |
| `proposition-context-preview.tsx`  | Chinese interface catalog; development/editorial fixture prose remains explicitly illustrative source data.                   |
| `proposition-detail.tsx`           | Live measure translation; graph/relationships/money allowlist and provenance tests.                                           |
| `settings/about.tsx`               | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/alerts.tsx`              | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/blocked-content.tsx`     | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/content-interests.tsx`   | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/edit-profile.tsx`        | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/feedback.tsx`            | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/help.tsx`                | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/language.tsx`            | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/notifications.tsx`       | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/privacy.tsx`             | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/saved-articles.tsx`      | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `settings/terms.tsx`               | Static Chinese catalog, shared header control; alert history uses server translation; private/user fields preserved.          |
| `trillion-preview.tsx`             | Chinese interface catalog; development/editorial fixture prose remains explicitly illustrative source data.                   |

## Reader and data coverage

- Full legislative reader: title, summary, changes, glossary, outcomes, unknowns, both sides and examples, long explanation/deep dive, session labels and timeline display. Original timeline text remains available through the official-record link.
- Court reader: decision, question, reasoning, effects, unresolved issues and source controls. Court names and original opinion text retain their identity.
- Executive content: full generated Markdown body, not just its card description.
- Measures: explanations, published debate nodes, relationships, scenarios, historical context and budget display labels. Canonical money/evidence remains unchanged.
- Ballot contests: canonical titles and generated summaries, roles, fiscal explanations, generated arguments and candidate summary fields; source statements remain original. Signed references reject tampering, expiry, different candidates and revised prose.
- Published candidate research: catalog office/jurisdiction, claims, promises, finance prose and evidence context. Release gates and digests run before translation.
- Alert history, preparation titles and app-shared article pages/images follow the current language. Source material and user notes are never sent as arbitrary translation requests.

## Verification boundaries

Live API/runtime checks use the local branch against explicitly selected production records, with bounded translation requests. Bill `fa107d14-8165-482c-acc4-d1938af4c215`, federal bill `b399437c-307e-4574-bb80-8baa2420bbf9`, court `16389439-8c2a-4302-a656-186ce28b27a6`, executive content `a9993fff-fe89-4b09-9a6a-c71ed81dfd4d`, and California measure 1 are the recorded samples. Other published research/relationship shapes are covered by schema and allowlist tests, without bypassing editorial gates.

A 32 KB malformed signed reference sent over the actual POST API reaches signature validation and returns expired, without creating a translation job. A separate migrated local test database verifies queue cache hits, concurrent leases, backoff, revisions and recovery. Screenshots and exact check/release results are linked from the PR; they identify local runtime versus production publication. The pre-existing standalone website marketing/editorial pages are not selected through the mobile language control.
