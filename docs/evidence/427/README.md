# Issue #427 rendering evidence

## Bills consistency revision

The latest `brand-*.png` captures supersede the earlier revisions below. [Bills reference](brand-bills.png) is the actual, unmodified `BillBrief` renderer with synthetic bill data and the shared paper `NavHeader`, not a live article-detail route. [Integrated notes](brand-integrated.png), [saved preview](brand-saved.png), [editor](brand-editor.png), [expanded possible choice](brand-choice.png), [empty archive](brand-empty.png), and [narrow integrated notes](brand-narrow.png) render the actual election components with controlled synthetic 2099 data. All use the same Expo web development build, shared registered fonts, dark theme, and 390 × 844 viewport; narrow is 320 × 844. Metro ran on dedicated port 8431 with its process working directory confirmed as this checkout’s `apps/expo`.

The local notes panel now follows BillBrief’s 14px cards, fine shared hairlines, 17px editorial headings, 16px row titles, and 13px body text. Quiet icons and a thin neutral reading rail retain reading cues without creating a second palette. Save and Retry use compact surface-plane actions with 44px hit areas; reading selection adds a visible check and radio semantics. The saved-notes route is underlined and paired with a decorative chevron. Possible choice and privacy details remain progressive disclosures. No shared generic component was changed.

The surrounding ballot header and candidate/measure tab controls belong to #418; the dark ballot header differs from Bills’ paper header and remains an explicit integration follow-up. These captures do not establish native production, Dynamic Type/VoiceOver, live-provider, or real-reader behavior.

## Historical meaningful visual cues revision

The earlier `visual-*.png` captures superseded the design screenshots below. They show actual Expo web components, synthetic 2099 ballots, registered Billion fonts and Icon primitives. [Integrated empty](visual-integrated.png), [integrated saved](visual-integrated-saved.png), [editor](visual-editor.png), [saved overview](visual-saved.png), [empty](visual-empty.png), [note-only preview](visual-note-preview.png), [narrow empty](visual-narrow.png), and [injected read error](visual-error.png) cover the revision. Normal captures are 390 × 844; narrow is 320 × 844 and does not establish Dynamic Type behavior. The early `visual-saved.png` capture shows the first graphics iteration; the integrated saved and note-preview captures show final compact hierarchy.

People/document icons distinguish races and measures; book/clock/minus badges pair with reading labels. The blue rail shows only the fraction of current, uniquely matched contests marked Read. It excludes stale and ambiguous snapshots, does not count possible choices, and does not imply a complete official ballot or a vote. Empty records omit an unhelpful zero rail; the integrated overview avoids repeating surrounding election context. Notes without a choice expose a short local preview, including its screen-reader equivalent. Primary buttons use the existing dark-on-blue selection colors for contrast. Decorative glyphs are hidden from accessibility.

A fresh independent GPT-6-Astra screenshot-first review requested contrast, density and accessible-summary fixes. After iteration and 320px review, it found no meaningful visual blockers and confirmed a polished, useful Billion experience. It did not claim visual spectacle or real-reader validation. Native, Dynamic Type/VoiceOver, production integration and real-reader gates remain open.

## Design revision, October 2, 2026

The `design-*.png` captures supersede the initial screenshots below. They show the actual running Expo web components with synthetic 2099 ballots, using Billion’s registered fonts. Normal captures are 390 × 844; none establishes native Dynamic Type behavior.

- [Integrated ballot](design-integrated.png) and [integrated editor](design-integrated-editor.png): the existing ballot lookup with the notes addition, then its focused editor.
- [Empty ballot notes](design-empty.png) and [saved overview](design-saved.png): actionable rows first; explicit possible choice and reading badge.
- [Editor entry](design-editor-top.png), [choice controls](design-choice.png), and [measure notes](design-measure.png): actual entry at the top of a fresh modal ScrollView, bounded controls, selected radio semantics, and direct measure notes.
- [Archive](design-archive.png) and [empty archive](design-archive-empty.png): saved content first, or an Open my ballot action.
- [Storage error](design-error.png) and [recovery disclosure](design-error-recovery.png): failed reads leave data untouched; Retry and explicit two-step clearing of synthetic test data were exercised.
- [Privacy disclosure](design-privacy.png): local storage, analytics/sharing exclusion, encryption/backups, no registration/vote, and unavailable reminder meaning remain available on demand.
- [No contests](design-no-contests.png): an identified ballot with no rows, alongside the existing lookup retry and election-office path.

Runtime fault injection also verified failed Save → Cancel → reopening retains the earlier saved note and offers no abandoned Retry; failed Delete → Cancel → a different editor cannot retry the previous deletion; Retry after further editing saves the latest draft. [Cancelled save](design-failed-save-cancel.png) and [cancelled delete](design-failed-delete-cancel.png) captures include explicitly labeled test controls. System Back uses the same close handler; native Back remains unrun.

A fresh independent GPT-6-Astra reviewer inspected screenshots first over multiple iterations. The original warning-heavy design was rejected; fixes addressed hierarchy, saved-choice labeling, focused entry, measure and sparse states, recovery, and restrained disclosures. Final assessment: independently impressed by clarity, focused editing, restrained disclosure, and consistency with Billion’s editorial design. Native behavior, enlarged text, and real-reader gates remain open.

## Historical initial captures

These document the earlier implementation, not the final design.

Captured October 2, 2026 from the actual `PrivatePreparation` React Native
component running through Expo web/Metro in this worktree, with synthetic 2099
election/candidate/measure data. These are screenshots, not generated mockups.
They do not establish native production behavior or live provider correctness.

- [Empty preparation](empty.png): no saved preparation, no destructive delete-all action.
- [Editor context](editor-context.png): explicitly named election, privacy and progress explanation.
- [Editor and Save](editor.png): selected candidate, withdrawn option disabled, private notes, filled primary action.
- [Restored item](restored.png): saved reviewed state, tentative choice and notes after browser reload.
- [Changed roster](changed-roster.png): withdrawn candidate changes the snapshot; the old choice is not applied to the new roster.
- [Archive](archive.png): reads the previous election's preparation with no supplied ballot.
- [Archive deletion and return](archive-deletion-return.png): two actual component instances stay mounted while the fixture switches visibility; deleting from the archive clears the ballot list and the matching open draft. This models stack preservation without claiming a native navigation run.
- [Narrow archive](archive-narrow.png): 320 × 844 viewport wrapping; not a native Dynamic Type test.
- [Storage error](storage-error.png): a deliberately incompatible earlier fixture record fails validation and remains available for explicit delete-all recovery.

Other captures used a 390 × 844 viewport. Runtime checks also exercised saving,
candidate withdrawal, deletion
confirmation, malformed-storage recovery and reload restoration. The temporary
fixture entry was removed and the original `index.ts` app entry restored before
production bundle validation. Native production, VoiceOver/Dynamic Type and
real-reader testing remain required before a ready-to-merge decision.
