# PR 494 review and verification

Verified October 18, 2026 in the isolated PR checkout, integrated with main
`1636c0b3`. These screenshots are the running Expo Web app, not mockups.
All addresses and election responses are fixtures. External requests were
intercepted or blocked; no production database writes or ingestion ran.

## Rendered evidence

- [Empty location form](location-empty-390.png), [permission denied](location-denied-390.png),
  [saved location](location-saved-390.png): 390 × 844, development build. Manual
  submission saved the exact typed value, and a second edit replaced it.
- [Spanish edit form](location-edit-es-320.png): 320 × 740, development build.
  Document width was 320 pixels with no horizontal overflow.
- [Ballot permission denial](ballot-denied-390.png): real ballot form, intercepted
  availability and voter responses. Denial followed by manual submission worked.
- [How to Vote](how-to-vote-dw-390.png) and [missing locations](how-to-vote-locations-390.png):
  fictional Democracy Works response with empty normalized address, a California
  election OCD ID, and `lookup_links_only`. The screen recognizes the election,
  omits unsourced checklists, and directs the voter to the official finder.
- [Closed production launch gate](how-to-vote-gated-production-390.png):
  `expo start --web --no-dev`, saved fixture address and availability false.
  A direct `/how-to-vote` visit made **zero** personalized voter requests.
  Reproduce with [verify-production-gate.cjs](verify-production-gate.cjs), an
  available Playwright installation, and `BILLION_PREVIEW_URL` if changing port.

Some development screenshots show Expo's SVG DOM-prop warning toast. It is not
present in the production render. Native GPS and VoiceOver/TalkBack require
hardware verification; browser permission denial and controlled-hook tests do
not substitute for that.

## Confirmed fixes

- GPS fills a draft for confirmation and cannot overwrite a subsequent manual
  edit, submission, cancellation or unmount.
- Reverse-geocoding failure asks for manual entry; it never submits coordinates
  as a street address. The active Democracy Works contract requires an address.
- A delayed initial storage read cannot replace a more recent cross-screen save
  or removal.
- California election jurisdiction works with Democracy Works' empty normalized
  address. It does not claim to verify voter residence. Out-of-coverage Edit
  opens location settings instead of toggling an invisible form.
- How to Vote respects the existing production launch gate, performs no
  enrichment, and does not attribute hardcoded advice to an official source or
  claim unavailable locations have not been published.
- Merge resolutions preserve main's localization and Expo versions, the PR's
  native-address entry, and its removal of invented registration deadlines.
- Input accessibility labels and readable new status/saved-label text restored.

## Checks and review

- Workspace `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format`, and
  `pnpm lint:ws` passed. Existing Next.js `<img>` warning remains.
- Final affected Expo checks: typecheck and lint passed; 335 tests passed and
  one existing artifact-dependent court-render test skipped.
- Expo tab visibility test passed.
- iOS and Android production exports passed using an isolated temporary Metro
  cache. The first export used a stale DOM-entry cache from another checkout;
  a clean isolated-cache export resolved that environment failure.
- Independent GPT-6-Astra code review and re-review cleared all code findings;
  reviewer independently reran 44 focused tests. A separate fresh-context Astra
  reviewer inspected rendered UI first and cleared the accessibility fixes.
- Claude design consultation was attempted; account session quota prevented it.

At the time of this #494 review, the privacy disclosure review was still pending.
The integrating #414 follow-up corrected the website and all three app languages,
removed the retired Places claims, and documented the iOS collection assessment in
[the data inventory](../../legal/data-inventory.md#native-location-assessment--october-18-2026).
Publishing the corrected website policy and checking the existing ASC label remain
release steps. The public ballot launch gate remains unchanged.
