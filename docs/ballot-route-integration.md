# Dedicated ballot route (#329)

## Ownership and scope

This route answers "What’s on my ballot?": address-specific races, candidates, and measures, with source evidence and honest explanations of coverage and missing data. Arnav owns "What are the midterms?" and "How can you participate?", along with the Elections tab redesign. Keep explanatory and participation content in that workstream.

#331’s reusable component now renders returned address-specific voting logistics on this route. Placement coordination with Arnav’s final participation UI remains pending through the coordinating task, so the two surfaces do not duplicate guidance. This implementation does not decide the final participation experience.

## Route behavior

Implemented entry point: [`/ballot`](../apps/expo/src/app/ballot.tsx). Expo Router discovers it in the root stack, so an internal `router.push("/ballot")` or the app scheme's `/ballot` deep link opens it without changing the Elections tab. The route checks `electionsAreLive()` before mounting any query hooks; while disabled, deep links show coming-soon copy. `BallotExperience` is exported for controlled test mounting. The route has a back action, including a home fallback when opened directly. Once enabled, it accepts a manually entered voting address without Places autocomplete, stores it only in component state, and does not put addresses in route parameters or analytics events.

The route requests Civic voter information for that address first. The response's election and `otherElections` populate the selector. Choosing an election sends its exact ID with the same address. The discovery response stays available while another election loads; changing the address remounts the lookup and clears election selection. Errors have a retry action and suppress previous data. Missing contests mean only that none were returned, not that publication or eligibility is known.

The [lookup model](../apps/expo/src/utils/ballot-lookup.ts) retains every contest regardless of state, candidate count, or enrichment. The [view](../apps/expo/src/components/ballot/BallotLookupView.tsx) renders provider race names, candidate names/parties, and referendum text. It does not render generated summaries as source text. California results mount only when the current response's normalized state is California. California local-content previews are not mounted. Other states can use administration-body election information links supplied by the response; those links are not evidence that results have been published.

## Integrated components and release dependencies

The route uses #335's `includeEnrichment: false` contract for discovery and selection. Changing addresses clears the selected election. Local validation rejects blank, too-short, control-character, and over-300-character addresses before a request. A response for a different election is labeled with both returned and requested IDs. Cached contests and logistics are hidden during loading, errors, and invalid input.

#330's `BallotStatusNotice` distinguishes invalid input, provider failure, an election without contests, and no data. Contest and candidate citations retain field attribution and explicit official flags through `BallotSources`. Provider-linked referendum URLs carry no inferred official status. `BallotLanguages` reports unknown availability because this response has no verified language evidence. No verification dates or source freshness are invented.

#331's `VotingLogisticsSection` displays only the current response's address-specific locations and office links under "Address-specific voting information". It remains reusable for Arnav's participation view; coordinate placement through the project owner to avoid duplicating guidance across surfaces. This integration adds no midterms lesson or general participation explanation and leaves his Elections layout untouched.

The Elections tab owner can add `router.push("/ballot")` after #332's coverage decision and #337's launch review. The public route still checks `electionsAreLive()` before mounting query hooks. The production lookup gate, tab registration, and custom TabBar are unchanged. Nationwide activation remains blocked by coverage/provider evidence.

## Verification and remaining acceptance criteria

Run Expo's tests/typecheck plus the tab-visibility test and production platform export commands from [Contributing](../CONTRIBUTING.md#check-your-change). The lookup tests cover California and other states, missing candidates/enrichment/contests, multiple election IDs, and unsafe source URLs.

A production export proves bundling, not a device lookup. Before release, exercise CA, non-CA, partial, empty, and failed responses on the integrated production mobile build, switch elections, change the address, retry a failure, follow source links, and inspect the custom TabBar and direct-route back behavior. Production-device acceptance checks and coverage/release approval remain outstanding. The combined components have been exercised in the local browser fixture. No nationwide readiness claim follows from this implementation.

## Controlled fixture harness

`BallotLookupFixture` in [the fixture module](../apps/expo/src/components/ballot/BallotLookupFixture.tsx) mounts the real view with CA, NC, partial, empty, failed, and loading cases. It is not an app route and is never mounted by production code. A temporary test entry can mount it under the existing Expo Router providers. It renders the same integrated source/status, language, citation, and logistics components as the real route. The California results slot displays a marker instead of fetching; all fixture addresses and elections are fictional. Select NC then the special election, switch to CA, retry failed, and submit an edited address to check transitions. The real `BallotExperience` request flow has also passed mocked-transport checks described below. Installed-device behavior and live provider coverage remain unverified.

## Combined runtime verification

The integrated fixture was exercised at a 390×844 viewport, plus a 320-pixel narrow-width check. It showed non-CA contests, per-field candidate/contest citations, unknown language availability, supplied location hours, and California-only results. Interactions covered election switching, failed lookup retry, distinct partial/empty/no-data states, mismatched election IDs, invalid input recovery, and loading with deliberately supplied stale data. A separate temporary entry mounted the real `BallotExperience` with intercepted fetch responses: discovery omitted election ID, selection sent the exact ID with the same address, both sent `includeEnrichment: false`, address changes cleared selection, and invalid input sent no request. All addresses and provider responses were fictional. These checks do not establish live coverage.

Temporary preview routes are removed before committing or exporting production bundles. To reproduce the visual fixture, temporarily mount `BallotLookupFixture` under the app's existing Router providers, then remove that entry. Keep the public gate intact. Parent workspace checks cover the assembled stack; focused Expo checks and iOS/Android production exports cover this integration.
