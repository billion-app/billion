# App-wide language controls and interface translations

Captured on 2026-10-18 from the running Expo app on branch `codex/app-localization`, using the public production API at `https://www.billion-news.app`. The browser captures use a 320 × 740 viewport. The iOS capture is the same source running in the iPhone 17 Pro simulator with Hermes. These are implementation screenshots, not mockups. No fixture content is used in the captures.

| Screen                                   | Evidence                                                             |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Chinese home                             | [320px](home-zh-320.png), [native iOS](ios-home-zh.png)              |
| Chinese Browse                           | [320px](browse-zh-320.png)                                           |
| Chinese elections                        | [320px](elections-zh-320.png)                                        |
| Chinese statewide guide                  | [320px](guide-zh-320.png)                                            |
| Candidate research entry                 | [Chinese](candidate-zh-320.png), [Spanish](candidate-es-320.png)     |
| Sponsor profile with no supplied bill ID | [Spanish empty state](empty-es-320.png)                              |
| Language settings and picker             | [Chinese settings](language-zh-320.png), [picker](picker-zh-320.png) |
| Help                                     | [Spanish](help-es-320.png)                                           |

The globe and current language remain available in each page header. Switching between Chinese and Spanish retained the current candidate route. The native home picker opened above the animated greeting header and changed its interface to Spanish. Home cards now fit a narrow viewport with matching scroll snap offsets. Long Spanish candidate questions wrap within their cards; the sponsor's long header moves below the control row at this width.

Interface text is translated. Names, official records, candidate statements, and API content outside the existing article/measure translation contracts retain their supplied text. The picker explains this distinction. Feed summaries in these captures are therefore still English. This change does not bulk-generate or publish new translations of source records.

Validation includes the workspace lint/typecheck/test/format commands, workspace dependency lint, onboarding and tab-visibility tests, the DOM reader bridge test, and a production iOS export. Expo tests pass 289 with one existing skip; the full workspace suite passes with its existing environment-dependent skips. The reader bridge exercises language switching with an open evidence sheet, retained expansion/scroll, and a glossary term whose translated text changes. Catalog tests check complete languages, interpolation parity, count forms, and calendar-date/monetary formatting. Local government tests retain vote meaning and source values across languages.

Independent Astra review caught and prompted fixes for translated comparison values, stable saved-note identity, English plural fragments, and reader sheet/term restoration. Native-speaker editorial review and installation of the published OTA on a physical device are not claimed by these checks.
