# Listen and language review evidence

Captured October 15, 2026 from the running Expo web app in the PR #477 review
worktree at a 390 × 844 viewport. These are screenshots of the implemented
routes, not mockups. Article data is a synthetic fixture supplied by a local
Playwright request handler; its translation response is explicitly unavailable.
No production API or model provider was used for these captures.

- [Language selection](language-es.png): selecting Español updates the title and
  explanatory copy and marks the selected language.
- [Unavailable article translation](article-unavailable-es.png): the article
  identifies Billion's explanation, offers Original text, and explicitly tells
  the reader that translation is unavailable and English is being shown.

Independent Astra review understood the selected language, the separation
between source and explanation, and the English fallback from these screenshots.
Native speech playback and live translation quality require separate release
verification; these web screenshots do not verify either.

The independent code review found one additional source-attribution bug: records
with source text but no generated explanation announced that source text as
Billion's analysis. The final patch selects a source introduction for those
records, retains the original English title, and covers that case with a passing
regression test. The reviewer confirmed the fix and found no other code blockers.

The UI review also found that language radio options exposed `selected` rather
than `checked`. The final screen exposes checked state to native accessibility
and explicit `aria-checked` on web. A Playwright check reproduced the missing
state before the fix and then verified Spanish as checked and English as
unchecked after selection.
