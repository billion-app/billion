# PR #370 native screenshot evidence

These screenshots show the real `VotingLogisticsSection` from PR head `46814f65882bfb22270306fb3b81d6f1fa0afba3`, mounted in an isolated local preview using the synthetic fixtures in `VotingLogisticsPreview.tsx`. They do not show a production build, live address lookup, verified jurisdiction coverage, or the final ballot-route placement.

- Device: dedicated iPhone 17 Pro simulator, iOS 26.5.
- UDID: `B37E49AC-0E1B-4F2E-9CE2-1B197DCE307A`.
- Native container: existing local Billion Release simulator container, repackaged locally with a freshly bundled offline fixture entry point. Expo updates are disabled. This is a test harness, not a distributed production build.
- Isolation: separate evidence worktree; the implementation branch, other simulators, API, and providers were untouched.
- The preview loads the app's Albert Sans, IBM Plex Serif, and Inria Serif fonts and wraps the actual component in a safe-area scroll view. The evidence banner and automatic scroll/fixture cycling are preview-specific.
- Fixture URLs use `example.org` and fixture addresses are fictional. The screenshots are rendering evidence, not voting guidance.

Screenshots were captured directly with `xcrun simctl io <UDID> screenshot`; no image edits were applied.

## Captures

1. `01-locations-ios.png`: polling and early-voting details, supplied dates/hours, complete long notes, and attribution with official status distinguished.
2. `02-official-links-ios.png`: scrolled continuation with drop-off details, missing source attribution, and supplied registration/mail-voting/ballot information links.
3. `03-mail-only-ios.png`: mail-only indicator with empty location groups described as unknown, without inferring voting-method availability.

The first boot required approximately four minutes for simulator data migration. A later simulator shutdown required a restart. The final captures all succeeded in the offline native app. No browser or document screenshots are included.
