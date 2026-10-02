# Accountability prototype runtime evidence

Captured October 2, 2026 from the running Expo development web route `/accountability-preview` at 390 × 844 after the rigorous design-review revisions. These screenshots show the finished standalone additions in PR #437. The historical state uses the election totals, certification, inauguration and October 11, 2023 SB 423 signing records documented in [the prototype guide](../../election-accountability-prototype.md). Other states are wholly fictional. There is no live feed or real campaign-promise comparison.

- [Historical answer and housing action](historical.png)
- [Historical action and election sources](historical-action.png)
- [Fictional priority → action → limits](fictional.png)
- [Fictional action detail](fictional-action.png)
- [Missing result](missing.png)
- [Disputed result](disputed.png)
- [Confirmed holder with no action records](sparse.png)
- [Campaign priority without action records](priorities-only.png)
- [Expanded source metadata](source-details.png)
- [Source-opening failure and retry](source-error.png)
- [150% browser text stress](large-text.png)

These are actual implementation screenshots, not generated mockups. The large-text capture applies browser-only 150% font/line-height overrides; it is not native Dynamic Type evidence. The source-error capture induces a browser `window.open` failure through automation; successful retry opens the actual official record and clears the alert. Other runtime checks exercise source expansion, scenario auto-collapse, and priorities-only coverage. The temporary Follow demonstration was removed because it provided no useful persistent benefit.

The independent Astra review began with screenshots and rejected the old design for warning-heavy copy, an abstract hero, buried answers and duplicate provenance. Revisions lead with the officeholder, add one substantive real action, organize campaign comparison by priority/action/meaning, consolidate caveats, compact source controls and retain contextual limits. The root four-PR audit's #429 findings were applied in the same iteration. Native running UI, production-flow checks, editorial approval and real-reader comprehension remain publication gates. One sourced action does not establish a comprehensive accountability record.

After consistent re-review, Astra approved this as a polished prototype it would willingly read: the immediate answer, substantive housing card, clear priority/action/meaning sequence, compact verification controls and proportionate unknown states create useful stopping points. It described the result as a “strong, restrained civic brief.” No material visual revision remained. The reviewer did not claim a comprehensive accountability product from one action; verified coverage and real readers, rather than decoration, remain the substantive next steps. The priority-only image is a scrolled detail capture.
