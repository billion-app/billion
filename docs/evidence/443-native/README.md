# Native candidate research evidence

These are captures of the running Expo implementation, not the HTML design
prototype. All pictured candidates, amounts, quotations, and classifications are
fictional development fixtures. They do not demonstrate live research coverage or
editorial approval. The production publication policy remains disabled.

## Screens and interactions

| Capture                                      | Surface and purpose                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| [Candidate brief](01-candidate-web.png)      | Expo web, 390px: recorded actions and promises have different treatments     |
| [Native evidence](02-evidence-ios.png)       | iOS Simulator: original record in a dismissible native sheet                 |
| [Web evidence](03-evidence-web.png)          | Expo web: quotation, explanation, and limits stay distinct                   |
| [Promise brief](04-promise-brief-web.png)    | Expo web: separate promise route and short reading                           |
| [Promise depth](05-promise-analysis-web.png) | Expo web: benefits and tradeoffs presented together                          |
| [Money](06-money-web.png)                    | Expo web: donor types, lobbying roles, and interest areas                    |
| [Donor](07-donor-web.png)                    | Expo web: classification sources and unknown interests                       |
| [Comparison](08-comparison-web.png)          | Expo web: full roster, consistent questions, explicit gaps                   |
| [Sparse finance](09-sparse-web.png)          | Expo web: unavailable data does not become zero                              |
| [Native donor](10-donor-ios.png)             | iOS Simulator: donor detail and source actions                               |
| [Large text](11-large-type-ios.png)          | iOS Simulator: accessibility extra-extra-large text, wrapping navigation     |
| [Large evidence](12-large-evidence-ios.png)  | iOS Simulator: persistent Source/Done controls, long title in scrolling body |

The simulator used an installed development client on iOS 26.5. Native checks
covered the Money tab, donor detail, source sheet, Done, accessibility-tree labels,
and large text. This is not a physical-device VoiceOver readout or a novice-reader
comprehension study. Those remain acceptance gates before live rollout.

The [browser script](verify.cjs) checks roster navigation, promise depth and URL
reload, source dismissal and focus restoration, donor filters, comparison roster
and withdrawal visibility, sparse finance, and 320/390/768px layouts.
[Its recorded result](verification.json) contains 11 passing check groups and no
browser JavaScript errors. Layout checks do not prove comprehension.

To reproduce from the repository root, run Expo on port 8444 in development and
then the script. It uses the repository's Playwright dependency and a local
Chromium installation. The preview URL parameters work only in development.

```sh
pnpm --filter @acme/expo exec expo start --web --port 8444
node docs/evidence/443-native/verify.cjs
```

## Data-path verification

Final workspace verification passed `pnpm lint`, `pnpm lint:ws`, `pnpm typecheck`,
`pnpm test`, and `pnpm format`. The test run had 767 passes and six optional skips;
the candidate publication database integration was run separately below. Lint
retained one existing Next.js image warning in `JourneyOverlay.tsx`. The separate
Expo tab-visibility test, documentation formatting/relative links, and
`git diff --check` passed. The final production export completed for iOS, Android,
and web after the large-text navigation and evidence-sheet changes.

The API suite has a real Postgres integration covering revisions, independent
review events, releases, and tRPC reads. It also checks that a revoked successor
cannot revive an old release and that review withdrawal removes the whole race.
All 12 focused publication/router tests passed with zero skips against a newly
created disposable database on localhost:55443. Every committed migration was
applied there, including the new release table. No shared database was migrated.

To reproduce, create a disposable local database whose name begins with
`billion_candidate_`, apply the committed migrations, and supply its URL:

```sh
CANDIDATE_RESEARCH_TEST_DATABASE_URL=postgresql://127.0.0.1:55443/billion_candidate_research \
  pnpm --filter @acme/api exec tsx --test \
  src/lib/candidate-brief-publication.test.ts src/router/candidate-briefs.test.ts
```

The ordinary test run skips this integration without that explicit local target.
The suite verifies pending-policy reads do not touch the database. CLI draft
validation was also exercised without writes. Production iOS and Android exports
verify the native bundle path; they do not constitute a store release.

## Independent review

An independent GPT-6 Astra reviewer first assessed actual screenshots for reader
comprehension without implementation rationale, then reviewed the implementation.
Resolved findings were missing withdrawal status in comparison, incomplete donor
accessible labels, wrapping comparison controls, and release catalog limiting
before selection of the latest snapshot. Large-text review also confirmed the
persistent sheet controls after the long title moved into the scroll area.
Re-review reported no new blocking defect.

Live pilot selection, official source ingestion and reconciliation, editorial
approval, authenticated editorial tooling, automated source refresh/revocation,
physical-device accessibility, and real-reader acceptance are still unverified.
See [the implementation guide](../../candidate-research-reader.md) for the exact
publication boundary. This evidence does not close all acceptance criteria in
issue #443.
