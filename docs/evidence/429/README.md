# Accountability prototype runtime evidence

Captured October 2, 2026 from the running Expo development web route `/accountability-preview` at 390 × 844 after the human-requested visual redesign in PR #437. The historical state uses the election totals, certification, inauguration and October 11, 2023 SB 423 signing records documented in [the prototype guide](../../election-accountability-prototype.md). Other states are wholly fictional. There is no live feed or real campaign-promise comparison.

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

The human review rejected the preceding text-heavy layout despite its favorable review. This revision replaces repeated prose with a compact identity masthead and a paper action brief. Icons distinguish election, term entry, documented action, change and uncertainty; visible labels carry the meaning. The action headline, changed process and unknown outcome are separate scan targets. Publication dates remain in source details rather than being presented as certification dates.

A fresh independent Astra review inspected actual screenshots before code. It found the historical identity/action/change/unknown visible in the initial viewport and sparse states appropriately uncertain. Its concrete corrections addressed ambiguous fictional outcome wording, publication-date semantics and a proposal icon. The refreshed screenshots include those corrections. This review does not substitute for real-reader comprehension or native accessibility verification.

Native running UI, production-flow checks, editorial approval and real-reader comprehension remain publication gates. One sourced action does not establish a comprehensive accountability record.
