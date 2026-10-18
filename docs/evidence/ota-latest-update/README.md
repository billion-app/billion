# Latest OTA restart verification

Captured on October 18, 2026 against application commit `fd1057cd` for PR #491.

The screenshots show the actual `UpdatePrompt` component running in Expo web. A temporary harness supplied a cached update, a deferred fetch, and a reload counter through a mocked `expo-updates` adapter. The harness used the app fonts, styles, and safe-area provider. Its labelled bottom panel is test instrumentation, not shipped UI. The background is a fixture. The harness was removed before committing this evidence; no product source changed during capture.

| Capture                               | Viewport  | Observation                                                                                                                                                           |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ready](ready-390.png)                | 390 × 844 | Restart and postpone choices are readable.                                                                                                                            |
| [Updating](updating-320.png)          | 320 × 693 | The latest-update message wraps; restart and postpone controls are disabled. One fetch, zero reloads while pending.                                                   |
| [Retry updating](updating-390.png)    | 390 × 844 | A retry enters the busy state. The fixture panel retains the previous captured alert.                                                                                 |
| [Failed download](failed-390.png)     | 390 × 844 | Two failed fetches produce zero reloads, restore Restart, and call the error alert. The fixture captures the native Alert text; it does not render the native dialog. |
| [Successful retry](completed-390.png) | 390 × 844 | The third fetch completes, reload runs exactly once, and the prompt disappears.                                                                                       |

The browser accessibility tree exposed Restart as disabled during fetching and enabled after failure. The completed state contained no Restart button. No native OTA network request or real application reload was performed by this harness.

Validation of the shipped commit: production workflow [39102729982](https://github.com/billion-app/billion/actions/runs/39102729982) passed repository checks, production iOS export, and native compatibility. Clean checkout mobile checks passed (282 tests, one skip), and Expo Doctor passed 21/21. The new regression test failed before the implementation and passed afterward. PR CI [39147607577](https://github.com/billion-app/billion/actions/runs/39147607577) also passed, including iOS and Android bundles.

Physical-device OTA installation, native Alert presentation, VoiceOver announcements, and large Dynamic Type remain unverified. Claude design consultation was attempted but could not run because its weekly quota was exhausted. Independent Astra code review found no actionable findings; visual review is recorded in the PR.
