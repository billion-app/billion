# Issue #427 rendering evidence

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
- [Narrow archive](archive-narrow.png): 320 × 844 viewport wrapping; not a native Dynamic Type test.
- [Storage error](storage-error.png): a deliberately incompatible earlier fixture record fails validation and remains available for explicit delete-all recovery.

Other captures used a 390 × 844 viewport. Runtime checks also exercised saving,
item-switch confirmation with note retention, candidate withdrawal, deletion
confirmation, malformed-storage recovery and reload restoration. The temporary
fixture entry was removed and the original `index.ts` app entry restored before
production bundle validation. Native production, VoiceOver/Dynamic Type and
real-reader testing remain required before a ready-to-merge decision.
