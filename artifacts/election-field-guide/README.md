> Historical October 4 preview. The current October 5 reference uses [expandable research cards](../election-research-cards/README.md).

# Election interior review

Based on GitHub main `00cb9260`. These are actual iPhone 17 Pro simulator captures of the implemented UI, using clearly fictional candidate data. They are not populated production candidate research.

- `race-entry.png`: research action visible when the candidate disclosure is collapsed.
- `candidate-interior.png`: the ordinary candidate page with the existing publication gate intact.
- `record.png`: source-provided biography preserved through the race-to-candidate route.
- `funding.png`: explicit missing finance data and official filing resources.
- `priorities-preview.png`: the existing development-only reviewed brief fixture, filtered by topic. This research is not published in production.

## Verified

Native navigation through the visible research link; all four tabs; full-statement expansion; biography rendering; source/update disclosure; exact excerpt, attribution and retrieval date in the reviewed fixture. Source links remain visible and publication restrictions remain intact.

Workspace lint, typecheck, tests and formatting pass. Lint retains one existing Next.js image warning. Expo has 234 passing tests and one skipped test. Focused checks passed again after the last copy edit. Production iOS export succeeded.

## Remaining scope

No campaign finance ingestion or candidate committee matching exists in this change, so the funding page cannot display verified donor charts. Independent research and comparison publication remain gated. Enlarged native text and a complete live ballot were not manually reviewed in this pass; navigation uses the existing font-scale-aware segmented control. No release or deployment was performed.
