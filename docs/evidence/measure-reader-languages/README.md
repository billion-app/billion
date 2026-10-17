# Measure translation and listening verification

These screenshots capture the running Expo web implementation at 430px and 320px widths. The local verification server runs the new `civic.getMeasureTranslation` procedure against the production California guide for November 3, 2026. Prop 1's explanations were translated by the existing private worker; the displayed content is not a fixture. The error screenshot intentionally blocks the translation request to exercise the fallback and Retry flow. Native speech is unavailable in this web build, so web screenshots do not prove iPhone audio.

- [Chinese reader](measure-zh.png)
- [Spanish reader](measure-es.png)
- [Language menu at 320px](language-menu-320.png)
- [Translation failure at 320px](measure-error-320.png)
- [Native English playback and Silent Mode reminder](native-listening.png)
- [Native Chinese playback](native-chinese-listening.png)
- [Native Chinese glossary](native-chinese-glossary.png)
- [Native language menu](native-language-menu.png)

Verified the path from the stored official guide and publication-gated graph, through the translation queue and worker, to translated titles, explanations and argument nodes in the running reader. Source URLs, summary quotations, and every node's original quotations were compared with the English graph and remained identical. Chinese and Spanish switch back to English. The error state keeps English readable and Retry recovers. Main reader controls are localized; full-app localization and quoted official documents are outside this change.

Checks include mobile/API typechecks and tests, a production iOS export, and the translation queue integration test on a new disposable local `billion_reader_translations_test` database using committed migrations. The queue test covers concurrency, retries, superseded revisions, expired leases and measure segments processed without an article row. Speech tests cover stop-before-start ordering, system-managed iOS audio options, cancellation and visible startup errors. iPhone Silent Mode, speaker/Bluetooth routing and audible playback need physical-device confirmation.

The iOS 26.5 simulator build includes the real Expo Speech native module. Listen in English and Chinese reached the native `onStart` callback, displayed progress and the localized Silent Mode/volume reminder, and Pause/Stop changed state. Changing language stopped the prior session. Tapping English “bonds” and Chinese “债券” opened the matching definitions. This verifies native integration and controls, not physical-device audibility.

The bounded Chinese backfill completed all 28 title/reader entries for the guide's 14 measures. [The report](chinese-backfill.json) records each source hash, translated title and graph revision. Every original quotation and source URL was checked against the corresponding live English record.

Independent Astra review found a shadowed glossary function, Chinese word-boundary mismatch and locale-ranking regression; all were fixed and re-reviewed. The 320px menu screenshot was recaptured after its fade completed. Spanish currently retains the original English currency unit in “$11.25 billion”; the quantity is unchanged, but translating these units consistently remains a translation-quality follow-up. Source quotations must remain verbatim when improving that behavior.
