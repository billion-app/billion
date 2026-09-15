# PR #370 native design evidence

Refinement branch: `codex/370-ui-refinement`, commit `10368464f3a29d0ea9b70753aae3baf0d62d0dc5`.

The screenshots show `VotingLogisticsSection` in a locally bundled native Billion simulator container. All locations, instructions, and links are synthetic. This is an isolated component preview, not a live lookup, a distributed production build, or the final ballot-route placement.

Device: iPhone 17 Pro, iOS 26.5, UDID `B37E49AC-0E1B-4F2E-9CE2-1B197DCE307A`. The app loads bundled fonts and fixture data offline; provider and API calls are absent. Captures use `simctl io screenshot` without image edits.

## Captures

- `populated-default.png`: compact Election Day, early-voting, and drop-off rows, with supplied name/address/hours/dates and official actions.
- `notes-expanded-default.png`: the native disclosure opens a titled reading panel containing the original multi-paragraph notes and source attribution.
- `mail-only-default.png`: supplied mail-only indicator with unknown location data.
- `partial-default.png`: one partial location; missing groups are named once.
- `missing-default.png`: empty lookup data remains unknown.
- `loading-default.png` and `error-default.png`: stale fixture locations are hidden.
- Matching `*-large.png` captures use the iOS `accessibility-medium` content-size category. Default captures use `large`, the standard iOS category.

All six data/status cases were inspected at both text sizes. Original notes were opened and collapsed with native taps. The reading panel stayed open through a warm size change and was inspected at the larger text size. `notes-source-large.png` shows its scrolled continuation and source. OCR of native screen captures confirms that titles render and loading/error states contain no supplied location names or dates. Native accessibility-tree inspection was unavailable in this simulator; control roles and expanded-state props were checked in source.

The baseline native screenshots for the user's requested comparison are in [PR #370 baseline captures](../pr370/README.md). They show the same component contract with synthetic data; the populated refinement fixture includes longer original notes and complete early-voting hours.

## Validation

Expo tests: 95 passed. Focused ESLint, formatting, and relative-link checks passed. Expo typechecking passed with the shared URL helper and `BallotText` primitive from #369 and the #368 timeout fix `de931c6` applied locally; those lower-layer changes are not duplicated in the refinement commit. A native iOS offline bundle and Android export include the component. Screenshots and native interaction checks use synthetic data only.

Warm Dynamic Type transitions were repeated in both directions without restarting. `BallotText` refreshes native text measurements when fontScale changes, while preserving disclosure state. All component headings and disclosure labels render completely in the final captures.
