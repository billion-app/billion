# Reader labels and translation status

Captured from the running Expo web article route at 320 × 740 and 390-pixel phone widths. These are implementation screenshots, not mockups. The fixture transport replays the public S. 4668 record (`a25b6c6b-0299-4fb9-af2e-b90c391a5446`) and its actual cached Chinese/Spanish translations. Pending and error responses are controlled locally; this does not measure production queue latency.

- [Chinese waiting](pending-zh-320.png): English remains readable and the notice explains automatic replacement.
- [Chinese request failure](error-zh-320.png): Retry and switch-to-English actions remain available.
- [Spanish waiting](pending-es-320.png): translated status copy fits a narrow phone.
- [Chinese brief](brief-zh-390.png) and [Spanish brief](brief-es-320.png): section headings and status chips follow the selected language.
- [Spanish original document](source-es-320.png): the source remains explicitly identified as English.

Verified pending → translated without reloading, error → Retry → translated, original-text mode, and switching back to English. Also rendered the public Herrera-Salazar court brief with Chinese labels, including reasoning, effects, source controls and term definitions. Source citations and original prose are preserved.

Regression tests cover settled queue states, cached overlays during background refresh, and dictionary completeness/placeholders. The worker timeout compatibility change is covered at the installed AI SDK boundary for both its 90-second deadline and shutdown cancellation. No translation prompt/cache revision, data migration, or native dependency changed.

Physical-device VoiceOver and audio output were not retested in this follow-up. Expo web does not expose the native speech button. Claude design consultation was attempted but unavailable due to its weekly usage limit; independent Astra screenshot and code review are recorded in the PR.
