# Accountability prototype runtime evidence

Captured October 2, 2026 from the running Expo development web route `/accountability-preview` at 390 × 844 on reserved port 8211 after the Bills design-language alignment in PR #437. The historical state uses the election totals, certification, inauguration and October 11, 2023 SB 423 signing records documented in [the prototype guide](../../election-accountability-prototype.md). Other states are wholly fictional. There is no live feed or real campaign-promise comparison.

- [Bills detail reference](bills-reference.png)
- [Bills brief reference](bills-brief-reference.png)
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

These are actual implementation screenshots, not generated mockups. Before the final capture, the listener on port 8211 was verified as PID 82471, with process cwd `/Users/me/.codex/worktrees/75ad/billion/apps/expo`; the startup log confirmed this same checkout. Bills and election captures used that same server, dark theme and viewport. The large-text capture applies browser-only 150% font/line-height overrides; it is not native Dynamic Type evidence. The source-error capture induces a browser `window.open` failure through automation; successful retry opens the actual official record and clears the alert. Other runtime checks exercise source expansion, scenario auto-collapse, and priorities-only coverage. The temporary Follow demonstration was removed because it provided no useful persistent benefit.

The human review requested alignment with the current Bills design language. The reference captures show the actual `article-detail` screen and `BillBrief` for H.R. 6213, loaded read-only through the production tRPC API in the same running development app, dark theme and viewport. Its existing header-art placeholder is shown as rendered. The election preview uses local source-checked historical records and fictional examples; no election provider request is made.

The preview now follows BillBrief's slate cards, subtle hairline borders, 14-pixel card corners, 10-pixel nested surfaces, compact bold editorial headings and body typography. The action/change/unknown structure remains specific to election accountability. Muted category accents do not represent party or outcome judgment. Source actions and chevron disclosures follow the existing reader conventions. No shared generic component or palette changed.

A fresh independent gpt-6-astra review compared Bills and election screenshots before inspecting code. It could identify the historical officeholder, action, change and unknown, as well as fictional and missing states. It requested source actions distinct from metadata, then caught insufficient contrast in the muted accent on small text. Source actions now use white semibold underlined labels; scenario options have a separate high-contrast style. Native running UI, production-flow checks, editorial approval and real-reader comprehension remain publication gates. Browser text stress is not native Dynamic Type. One sourced action does not establish a comprehensive accountability record.
