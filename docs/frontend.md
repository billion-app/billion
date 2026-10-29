# Frontend apps

Expo is the primary client. Next.js serves the website and public article pages, and hosts the API both clients use. Start both for local mobile development with `pnpm dev`; use `pnpm dev:next` for website/API work. Setup is in [Contributing](../CONTRIBUTING.md).

## Find a mobile feature

Expo Router maps files in `apps/expo/src/app/` to routes. Start with the route, follow its query into `packages/api/src/router/`, then inspect the components it renders.

| Area                                                | Entry point                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Providers, fonts, and app initialization            | [Root layout](../apps/expo/src/app/_layout.tsx)                                                                                                                                                                                                                                                                                            |
| First-run onboarding and local preferences          | [Onboarding flow](../apps/expo/src/components/onboarding/OnboardingFlow.tsx), [gate](../apps/expo/src/components/onboarding/OnboardingGate.tsx), and [device store](../apps/expo/src/utils/onboarding-store.ts)                                                                                                                            |
| Feed brief — today’s local news                     | [DigestHome](../apps/expo/src/components/DigestHome.tsx), mounted from the [Feed tab](<../apps/expo/src/app/(tabs)/index.tsx>)                                                                                                                                                                                                             |
| Browse, filters, and search                         | [Browse catalog](<../apps/expo/src/app/(tabs)/index.tsx>) (`BrowseCatalog`) on the Browse tab (`feed` route)                                                                                                                                                                                                                               |
| Home address and coverage                           | Feed lockup menu in [DigestGreetingBar](../apps/expo/src/components/DigestGreetingBar.tsx); Browse [JurisdictionPicker](../apps/expo/src/components/JurisdictionPicker.tsx)                                                                                                                                                                |
| Address-based ballot lookup                         | [Elections route](<../apps/expo/src/app/(tabs)/elections.tsx>) — California preview entry followed by the address-based ballot                                                                                                                                                                                                             |
| Voting logistics (How to Vote)                      | [How to Vote route](../apps/expo/src/app/how-to-vote.tsx) ; the derivation model is [utils/voting.ts](../apps/expo/src/utils/voting.ts)                                                                                                                                                                                                    |
| Voting guide (How to Vote)                          | [How to Vote guide route](../apps/expo/src/app/how-to-vote-guide.tsx) — static, address-free guide entered from the top of the Elections tab; links to the method details in the How to Vote lookup                                                                                                                                        |
| Original content, explanation, brief, and citations | [Article detail](../apps/expo/src/app/article-detail.tsx)                                                                                                                                                                                                                                                                                  |
| Candidate race and ballot measure details           | [Contest detail](../apps/expo/src/app/contest-detail.tsx), [measure detail](../apps/expo/src/app/measure-detail.tsx)                                                                                                                                                                                                                       |
| Tab registration and visibility                     | [Tab layout](<../apps/expo/src/app/(tabs)/_layout.tsx>) and [custom TabBar](../apps/expo/src/components/ui/TabBar.tsx)                                                                                                                                                                                                                     |
| Lock-screen OS alerts                               | [local-notification](../apps/expo/src/utils/local-notification.ts) and [push-sync](../apps/expo/src/utils/push-sync.ts). Compact chrome is Apple’s. The phone registers an Expo token; [notifications](../packages/api/src/router/notifications.ts) stores prefs and follows; `notify-followers` sends the alert. Tap follows `data.href`. |
| In-app OTA restart prompt                           | [UpdatePrompt](../apps/expo/src/components/UpdatePrompt.tsx); visibility in [update-prompt](../apps/expo/src/utils/update-prompt.ts)                                                                                                                                                                                                       |

The California statewide guide lists every proposition returned by the current official-guide cache. Each entry opens [proposition detail](../apps/expo/src/app/proposition-detail.tsx), which reloads the guide by proposition number. The scraper captures the guide's official Yes and No descriptions, title, summary, fiscal text, arguments, source links, and proposed-law link when available. The detail page attributes these to the California Secretary of State and does not present them as Billion analysis. If the cache predates the Yes/No fields, it links to the official guide rather than substituting a hardcoded explanation. Issue #334 remains the editorial publication gate for Billion measure analysis.

The Feed tab is a short brief. [DigestHome](../apps/expo/src/components/DigestHome.tsx) shows up to seven featured local bills under “Today’s local news”; Massachusetts uses the recent mixed feed so bills and court dockets can both appear. “Also today” shows up to seven unread featured federal bills, falling back to recent federal bills only when no featured bills are available. It preserves the API's ordering rather than inventing a daily ranking or filtering by calendar date. Opening a successfully loaded [article detail](../apps/expo/src/app/article-detail.tsx) records its ID in [device-local read history](../apps/expo/src/utils/read-content.ts), so returning Home removes it from “Also today”. When that selection is empty or fully read, the section says “No new articles today”; loading and request failures remain separate states. Read history does not require an account, sync across devices, or affect Browse and the local rail. Saving a bill, case, or order reuses the separate device-local saved set; the article page draws a four-stop legislative path from the projected status label and does not invent chamber passage. The home greeting starts as soon as the splash has hidden and the local brief has settled, so a cold start does not consume the ceremony behind the splash or a loading spinner.

Mobile and web Browse offer All, Bills, Executive, and Courts. The duplicate
Briefings filter was removed because it queried the same government records as
Executive. Existing web links with `type=general` select Executive and preserve
their search text and jurisdiction. Government cards keep their source-type
badges, such as Order, Notice, or Proclamation.

Article detail renders bill `brief` with `BillBrief` and court `courtBrief` with
[CourtBrief](../apps/expo/src/components/ui/CourtBrief.tsx). Court sections explain
the specific relief and its procedural limits, attributed reasoning and opinions,
effects, unknowns, and linked official documents. Emergency orders are labelled
as interim relief. Legislative stages appear only for bills. Records missing a
current court brief keep their Markdown or original-text fallback; the original
text tab remains available alongside the brief and cited lenses.

Feed, Browse, and Elections are visible tabs. Feedback and Settings are reached from the profile mark. The Elections tab starts with a California preview invitation, preceded by a [How to Vote guide](../apps/expo/src/app/how-to-vote-guide.tsx) card. That guide is static — no address and no provider call — and answers "what are my options, and what does each take?" in short, icon-led lines before handing off to the How to Vote lookup (`/how-to-vote?method=…` for a single method), election access, and election process. The statewide guide links to California's official voter lookup and county offices while production address-based ballot access is unconfigured; its official-ballot link offers election-office resources, with retry when the release-state check fails. If the in-app statewide preview is missing, the entry opens California’s official guide directly. Development builds expose the address lookup and synthetic scenarios for testing. The standalone ballot route reads `civic.getBallotAvailability`; local elections remains development-only. Home address and coverage (federal, California, Massachusetts bills and court records, North Carolina, Texas) are available from the Feed lockup dropdown or the Browse jurisdiction sheet. City decisions come from the explicit `LOCAL_JURISDICTIONS` registry in [local-government.ts](../apps/expo/src/utils/local-government.ts), which currently holds only the City of San José. The Elections entry lists it below the California guide, and the Browse sheet nests it under California. Both open [local decisions](../apps/expo/src/app/local-decisions.tsx) with an explicit `jurisdiction` parameter, so neither needs a saved address. The nested row opens that list and leaves Browse scope unchanged, because Browse lists state and federal records. Without the parameter, the list falls back to the saved address. Detection requires the city to be the locality component, so county-only placemarks and other Legistar clients known to the API (Santa Clara, Sunnyvale) are never offered. The address field takes a typed entry or resolves a one-shot native device location fix. Check both Expo Router options and the custom `TabBar` when changing visibility.

The gated [national ballot route](../apps/expo/src/app/ballot.tsx) offers an election-office fallback until launch. The Elections tab displays the selected provider ballot in a card layout with Candidates/Measures tabs. The separate ballot route remains available from [local elections](../apps/expo/src/app/local-elections.tsx). The initial handoff reuses the caller’s query result; changing the lookup address or retrying fetches again. Lookup edits last for that mounted experience and do not replace the saved home address.

“How to vote” opens a focused view within the ballot experience, with the election context and a Back action that restores the ballot’s scroll position. Date-scoped California guidance appears as compact date rows that expand to the published instructions and source links. Receipt deadlines stay distinct from postmark requirements, and the source timestamp is labeled as retrieval. Loading, failures, and mismatched election responses hide stale details; a mismatched response offers recovery before showing any ballot or voting information.

Candidate and measure details keep generated summaries separate from original text, with a reading control when both are available. A supplied short measure summary leads, with a distinct extended summary available on demand. Candidate statements lead below the identity card; biography opens as supporting context. These editorial screens use the article detail typography and shared segmented control, which reflows at enlarged text sizes. A measure with original text but no overview opens directly to the supplied text. Source disclosures retain field-specific links and distinguish retrieval from human verification. Missing details lead to an election-office link; language availability stays unknown unless verified evidence is supplied. Candidate filters appear for contests with more than five entries and use the supplied party names. A candidate explicitly marked as withdrawn but still on the ballot remains readable with that status shown.

The [OTA restart prompt](../apps/expo/src/components/UpdatePrompt.tsx) overlays the root stack. It asks to restart only when `expo-updates` is enabled and a downloaded update is waiting that is not already the running bundle. `isUpdatePending` alone is not enough — Expo can report the current launch as pending after a previous download. Restart [fetches the latest compatible update](../apps/expo/src/utils/restart-with-update.ts) before reloading, so a prompt left open across releases does not install an intermediate cached bundle. While fetching, the prompt shows its progress state and disables duplicate restart requests. A failed fetch leaves the app running and reports the failure; a check that finds no update does not reload. Preview the chrome in development with `EXPO_PUBLIC_FORCE_UPDATE_BANNER=1`.

## Onboarding and content preferences

`OnboardingGate` waits for the device store to load, then sends a reader who has not completed onboarding to the onboarding route. The store writes one JSON object to AsyncStorage under the versioned key `billion.onboarding.v1`. It contains the completion flag, selected government vectors, sectors, derived topic labels, alert choices, and whether the reader dismissed the account prompt. These values do not require an account and remain on that device. The final sheet offers an optional mailing list signup through the website’s `/api/waitlist` endpoint; the reader can still start exploring without subscribing. The email goes to the server only when submitted and is not saved in the onboarding record. The sheet handles new and existing subscribers separately and keeps network errors visible for retry.

The watch and topic pages share a rotating White House illustration. Each government selection adds a structural section; each topic selection adds architectural detail. On the topic page, the first three picks also complete any remaining structural sections, so choosing fewer governments still leads to a complete building. Removing a selection reverses its construction step, and reduced motion shows the new state without rotation or fades. The geometry lives in [whiteHouse3d.ts](../apps/expo/src/components/onboarding/whiteHouse3d.ts) and the animation in [WhiteHouseSpin.tsx](../apps/expo/src/components/onboarding/WhiteHouseSpin.tsx).

When onboarding finishes with an authenticated session, `OnboardingFlow` also calls the protected `user.setPreferences` procedure. That procedure upserts topic and content-type arrays in PostgreSQL. The device record remains the source used by the onboarding gate and Digest connection labels; the Settings interest screen reads the server record instead. There is no general synchronization between the two stores.

The current Feed does not filter or rank cards by stored topics or content types. It chooses local content from the saved address or Browse jurisdiction and uses selected government vectors only for connection copy such as “You watch Congress.” “Also today” loads more federal articles as the reader scrolls. Opening an article records its first-read time on the device; the card remains in the feed for 24 hours, then stays hidden. Saved-bill alerts and opted-in executive-order alerts use the notification pipeline. New onboarding opts into executive-order alerts when the reader selects executive orders and instant alerts. Older onboarding promised only saved-item alerts, so upgraded devices leave this new category off until explicitly enabled. Settings → Notifications has a separate Executive orders toggle; later choices persist. BREAKING, Daily Brief, and Evening Recap do not yet schedule notifications or email digests. Keep those limits explicit until the corresponding delivery paths exist.

## Language and Listen

The language control in page headers and Settings → Language offers English, Español, and 中文 (Simplified). Until the reader chooses, the device's preferred languages decide. The choice is stored on the device under `billion.language.v1` by [useLanguage](../apps/expo/src/hooks/useLanguage.ts). Selecting a language updates mounted screens in place; navigation, entered addresses, searches, and local preferences are preserved. The shared [LanguageButton](../apps/expo/src/components/LanguageButton.tsx) also appears during onboarding and on recovery screens.

Interface copy uses typed, committed catalogs: [strings.ts](../apps/expo/src/i18n/strings.ts) contains the existing reader and navigation messages; [app-strings.ts](../apps/expo/src/i18n/app-strings.ts) assembles domain catalogs for the rest of the app. Every entry requires English, Spanish, and Simplified Chinese. Use [useAppTranslation](../apps/expo/src/hooks/useAppTranslation.ts) inside components, and pass its translator or language explicitly into pure utilities. Keep complete sentences together with named placeholders, and provide plural forms for counts. Do not translate IDs, filter values, route names, analytics events, or stored preference values. Catalog tests check language and placeholder parity.

[Locale formatting](../apps/expo/src/i18n/format.ts) handles dates, numbers, percentages, currency, and lists. Calendar dates such as Election Day retain their printed day in every time zone; timestamps use the device time zone. Pass years and identifiers as strings when interpolating, so number grouping cannot change their meaning. Original source text, proper names, addresses, and private reader notes remain as published. Localizing a screen's interface does not create a translation of its source documents.

Home, Browse, search results, saved articles, and sponsored legislation send the device language with their list requests. The API translates display titles, summaries, and featured takeaways from its own stored records; IDs, bill numbers, source documents and links remain unchanged. The list query key includes language, so switching back to English immediately reads the original record. A compact notice labels translated text, and pending or failed requests explain the English fallback and offer the existing language/retry controls. Queued cards poll while the page is active.

Card translations use separate per-card cache IDs from the full article reader. A page reads the cache and queues misses in batches; polling preserves worker leases and failure backoff. Editorial takeaways use a separate scope so ordinary Browse cannot replace a featured-card job. The card prompt reads each title together with its summary to resolve legal meanings (for example, criminal-justice “Corrections”). Its version is independent of the reader prompt, and older workers cannot satisfy it. Deploy the matching translation worker when that prompt changes. [Runtime evidence](evidence/content-localization/README.md) includes the originally reported Home cards and language-switch checks.

Articles are translated on the server by `content.getTranslation`, which caches the result per article and language in `content_translation`. Billion-authored prose, document titles, and the displayed legislative timeline are translated; the linked official timeline retains its original wording. Quotes, original documents, cited headlines, and URLs stay in English, because a translated quote is no longer what the source says, and "View source" finds quotes by matching them against the original text. Markdown quotations, cited links, and URLs are replaced with protected placeholders before translation and restored exactly afterward; missing or duplicated placeholders reject the result. The reader shows English first, then swaps in the translation and labels it as machine translated. Mobile query keys include the English reader revision, including source quotations, so updated explanations cannot reuse an older overlay. Queued translations retry every three seconds while the screen is active and show a preparing message until the worker finishes. The allowlist of translated brief fields lives in [content-translation.ts](../packages/api/src/lib/content-translation.ts). It includes full Markdown explanations, deep dives, both sides’ arguments/examples, and timeline display text. Add a field there when a new authored field is added to a brief.

[TranslationNotice](../apps/expo/src/components/TranslationNotice.tsx) makes that wait explicit: the article notice sits beneath the navigation bar and stays visible while the English content is displayed. Article and measure readers share the pending, failure/retry, translated, and original-source messages. A queue miss remains pending between polls, and a validated cached translation stays visible during background refresh. Readers can switch to English at any point. Bill and court brief headings, status chips, source controls, glossary labels, and reader accessibility text use the same language dictionary. Names and source records remain unchanged. [Verification screenshots](evidence/reader-translation-status/README.md) show Chinese and Spanish at narrow phone widths.

The statewide measure guide and proposition readers also expose a language button in the upper-right controls. It changes the same device preference, so returning to Settings shows the chosen language. Guide cards request a small title-only translation; opening a measure requests its explanation and published debate through `civic.getMeasureTranslation`. The API loads the official guide and publication-gated graph itself, then queues only the allowed display fields from [measure-translation.ts](../packages/api/src/lib/measure-translation.ts). The existing private worker processes these requests. Titles, summaries, vote descriptions, and authored debate nodes are machine-translated display copies; quoted passages, advocacy submissions, original documents, source links, graph identities and provenance stay intact. The UI labels that distinction and lets the reader switch back to English. No database migration or native dependency is needed for these measure controls.

[ReaderTools](../apps/expo/src/components/ReaderTools.tsx) provides the measure language and Listen controls. [measure-speech.ts](../apps/expo/src/utils/measure-speech.ts) narrates the displayed explanation in its current language; while a translation is pending it reads the visible English. A failed request keeps the original readable and offers Retry. The shared playback code waits for the previous native stop to finish before starting a new utterance, reports startup errors, and requests a system-managed speech session on iOS. The iPhone player reminds readers who hear nothing to turn off Silent Mode and raise their volume. Physical-device audibility, including the mute switch and audio routing, still needs checking before a release.

The headphones button in the article header narrates an audio-first brief with the phone's own speech engine through `expo-speech`. The voices run on the device, so listening is free, works offline, and sends nothing to a server. [speech-script.ts](../apps/expo/src/utils/speech-script.ts) builds the narration from existing article information, without another AI call. It avoids repeating the subtitle and summary, introduces figures, gives before/after comparisons spoken context, and explains affected groups and uncertainties. Court narration distinguishes allegations and party arguments from court reasoning and orders; the Opinions tab reads attributed opinions instead of the case brief. Transitions are localized in English, Spanish, and Chinese. Original text mode reads the source rather than adapting it. Records with only source text use that source introduction even when opened in the default explainer mode; they are never narrated as Billion's analysis. The script is split into chunks the engine accepts. [useArticleSpeech](../apps/expo/src/hooks/useArticleSpeech.ts) plays the chunks in order. Pause is stop-and-resume at the current chunk because Android has no native pause. `expo-speech` is a native module, so builds made before it was added hide the button instead of crashing. Shipping it requires a new binary.

The historical notes in `src/new_pages_implementation/` describe earlier page plans. Read the actual route before using one as an implementation reference.

## How mobile reaches the API

The [tRPC client](../apps/expo/src/utils/api.tsx) creates typed query options for TanStack Query. It uses `httpBatchLink`, SuperJSON, and the API base URL from [base-url.ts](../apps/expo/src/utils/base-url.ts). The link forwards the stored auth cookie and adds `x-trpc-source: expo-react`.

URL selection first uses `EXPO_PUBLIC_API_URL`, then the Expo development host on port `3000`. Expo web has a browser-host fallback. Native clients throw when neither an explicit URL nor a development host is available. A configured production URL wins over auto-detection, so set `apps/expo/.env.local` for local API work as described in [Contributing](../CONTRIBUTING.md#run-the-mobile-app).

Mobile imports API types, not the database client. `@acme/db/client` requires Node's PostgreSQL driver and server credentials. Put data access and authorization in the API procedure.

## Styling and shared UI

Every new content type must follow the [content-detail design language and workflow](content-detail-design.md): share typography, cards, and source disclosure while designing its own structure and interactions. That guide explains bills and court cases and identifies executive orders as the next structured-output adaptation.

Use [styles.ts](../apps/expo/src/styles.ts) as the mobile styling entry point. The Digest palette, hairlines, radii and spacing are defined once in [`@acme/ui/digest-tokens`](../packages/ui/src/digest-tokens.ts): `styles.ts` re-exports them and the web reader emits them as CSS variables, so both clients change together. It combines shared theme tokens with native helpers and reusable styles. The [Expo styling guide](expo-styling.md) explains tokens, spacing, and the theme hook.

`packages/ui` contains web components, native helpers, and shared tokens. Radix/shadcn web components require browser APIs; choose native exports or mobile components for Expo. `pnpm ui-add` adds shared web components.

Dependency versions live in the [Expo manifest](../apps/expo/package.json) and [workspace catalog](../pnpm-workspace.yaml). After adding a native dependency, rebuild with `pnpm ios` or `pnpm android`; restarting Metro only reloads JavaScript.

## Web pages and server rendering

The Next.js App Router lives in [apps/nextjs/src/app](../apps/nextjs/src/app). It includes the landing page, legal/support pages, public content previews, waitlist routes, and API endpoints. [Sharing and saves](virality.md) follows the public preview and share-image paths in detail.

The landing page uses [CinematicExperience](../apps/nextjs/src/app/_components/cinematic/CinematicExperience.tsx) for its scroll-driven story on desktop, tablet, and mobile. Its hero stacks copy above the phone through 1100px; wider windows place the copy beside the phone. [journey.ts](../apps/nextjs/src/app/_components/cinematic/journey.ts) fits the phone to both viewport dimensions and gives compact screens their own motion path. On portrait phones, the product moves below the copy and the bill timeline advances one milestone at a time. Short landscape windows put the phone beside the copy. The phone exits before the compact signup scene, whose form can scroll when the keyboard reduces available space. Touch scrolling stays native. Only the reduced-motion preference selects [StaticExperience](../apps/nextjs/src/app/_components/cinematic/StaticExperience.tsx) and disables scroll animation.

[trpc/server.tsx](../apps/nextjs/src/trpc/server.tsx) supplies server-side callers and query hydration. [trpc/react.tsx](../apps/nextjs/src/trpc/react.tsx) supplies the browser client with `httpBatchStreamLink`. Both use the same `appRouter`; server callers can invoke it without an HTTP request.

### Web Browse and the reader

`/browse`, `/browse/saved` and `/read/[id]` are the phone's Browse tab and article screen, laid out for a browser. They live in the [`(reader)` route group](<../apps/nextjs/src/app/(reader)>), whose layout emits the Digest tokens as CSS custom properties. [The design spec](superpowers/specs/2026-09-22-web-browse-design.md) records why each decision was made.

- **The view lives in the URL.** `/browse?scope=ca&type=bill&q=wildfire` can be linked, reloaded and reached with the back button. [browse-params.ts](../apps/nextjs/src/lib/browse-params.ts) is the only code that knows the parameter names. `scope` is always written, and a bare `/browse` renders the reader's stored jurisdiction from the `billion_scope` cookie. The page awaits what the first screen shows on the server (`prefetchNow`) so results are in the HTML. Later filtering and paging run on the client through the same public procedures the phone uses.
- **`/read/[id]` is not the share page.** `/b/[id]` stays thin and ends with an install prompt. The reader carries the full brief, the Dual-Lens, the timeline and the original text. Its canonical URL points at `/b/…`, so search engines see one URL per record. The explainer/source toggle and the Billion AI provenance note are required: without them the page would present analysis as the record.
- **No accounts.** Saves and the chosen jurisdiction go through [reader-state.ts](../apps/nextjs/src/lib/reader-state.ts), which uses `localStorage` today. Components never touch storage directly, so a server-backed implementation (`content.saved.*`) can replace it without screen changes.

### Inline word definitions

[DefinedText](../apps/expo/src/components/ui/DefinedText.tsx) is the shared native
reader component for tap-to-define words. Court briefs and candidate research
both use it. Pass the paragraph, its content-specific `{ term, plain }`
definitions, body style, and optional exact emphasis phrases. It keeps the original
text intact, matches whole terms (longer phrases first), and opens one definition
below that paragraph. Terms support keyboard activation; Close returns focus to
the term. The lighter shared `linkOnNight` token provides contrast for body-sized
links on dark cards.

Use ordinary words first. Definitions are for necessary names and terms, not a
reason to keep avoidable jargon. Supply meanings with the content so the same
word can have the right meaning for that record. Do not put a defined paragraph
inside another button: give the card its own separate navigation action.

## Authentication

[packages/auth/src/index.ts](../packages/auth/src/index.ts) configures Better Auth with the Drizzle adapter, optional Discord OAuth, the OAuth proxy, and the native callback bridge. Next.js exposes it through `/api/auth` and passes the resulting session into the tRPC context.

Web requests carry session cookies. The Expo auth client stores its session locally and supplies a `Cookie` header through the tRPC link. For an auth failure, follow the callback, stored cookie, and API context before changing a screen. See [API](api.md#request-path) and [Troubleshooting](troubleshooting.md).

### Notification history and testing

On a physical phone, Your alerts loads the server history when the screen opens. These are pushes accepted by Expo; entries are removed if a later receipt reports failure or delivery remains unknown after 24 hours. Receipt success confirms provider acceptance, not display on the phone. Empty history stays empty; old sample entries are discarded. Test reports push failures without substituting a local notification. Simulators use local OS notifications and keep only successfully scheduled tests in local history.

Settings offers **New bills in Congress** after Executive orders. It defaults off for every installation, including new ones, and onboarding does not enable it. The choice persists locally and syncs through `PushSync`, including when the app returns to the foreground. Each eligible bill gets one alert that opens its article; new-bill alerts also appear in Your alerts.

Push registration waits for onboarding to finish and notification preferences to load. Completing onboarding writes the selected instant and recap choices to the notification store before registration starts. Later Settings edits remain authoritative across launches.

The [election-process education route](../apps/expo/src/app/election-process.tsx) is reached from the Elections invitation. It uses hand-authored summaries of linked official sources to compare presidential nomination, California congressional top-two elections and Texas party primaries. These are labeled educational examples, not personalized ballots or live contest timelines. Current stage and next milestone remain unavailable; official registration and election-office links provide the next action. Candidate-status distinctions do not create a 2028 roster. [Prototype gates](evidence/419/README.md) record the remaining editorial, reader and native verification work.

## Development ballot scenarios

The Elections invitation opens the live, statewide California official guide cached by the scraper. It includes source-linked candidate statements and propositions, and official candidate photos when available. It is not an address-matched ballot or complete candidate roster. The production guide sends readers to the California Secretary of State and county offices for personalized information until the Democracy Works credential and live ballot path have been verified. Development builds expose a separate scenario picker beneath the guide: `full` opens a synthetic ballot with candidate statements, a measure and voting locations. `partial` omits statements and locations; `empty` omits contests; `error` exercises retry handling. `live` uses the saved address and normal provider. Mock selection does not overwrite the saved address.

These screens call the local `civic.getVoterInfo` API with explicit `mock:full`, `mock:partial`, `mock:empty` or `mock:error` addresses. The server recognizes them only when `NODE_ENV=development`, before any provider or cache operation. Production never returns these fixtures. Names, instructions and schedules in the fixtures are fictional.

Article detail on mobile, the web reader, and shared article pages shows Introduced for bills with a source introduction date from `content.getById`. Federal bills use the stored `introducedDate`; state bills require a dated introduction action because older records can store the provider’s creation date in that column. Government content shows Posted by White House or Published in Federal Register using its source publication date; this is not the signing date or a later citation added to a White House record. Supreme Court opinion-index dates are labeled Opinion released; eCourt docket activity is labeled Latest docket entry. Other court source dates use Court record dated. The underlying court column is named `filedDate`, but it can represent an opinion or docket activity, so the header does not call every date a filing or final decision. The shared `sourceDate` API metadata carries the date kind and source timezone to every reader. White House posts use Eastern time; date-only legislative, Federal Register, and court records use UTC. Records without a source date show Added to Billion using `createdAt`; this is when Billion first stored the record, not an official event date. Updated on Billion uses `updatedAt`, falling back to `createdAt` if no update timestamp exists. Source dates keep their source timezone rather than the reader’s device timezone. Labels and date formats follow the selected language.

The voting plan opens inline in the statewide guide and the address ballot, so
readers keep their election, tab and ballot position while checking official
services. `VotingPlanSection` routes registration, primary eligibility, voting
methods and missing logistics to authorities. It does not determine personal
status or infer deadlines. Only a method preference is saved on the device,
scoped by election ID, date and jurisdiction; addresses and party choices are
not stored in the plan. The statewide guide remains a routing experience until
personalized logistics are available. The address ballot keeps supplied dates
and locations in `VotingLogisticsSection`. Issue #422 remains gated on the
production personalized-ballot path and real-reader flow verification.

### Ballot measure loading

TanStack Query owns graph fetching, deduplication, failure handling, and caching. Expo Router’s `useIsFocused` supplies navigation focus; React Native’s `AppState` supplies foreground state and `requestIdleCallback` schedules spare-time work. The custom queue only serializes requests and pauses them for visibility, touch, and scrolling.

After the Feed queries settle, idle preloading fills the shared California guide cache, including measure text, and prepares Elections with Expo Router's `router.prefetch`. On Measures, React Native FlatList viewability selects the rows actually visible in the viewport, including partially visible rows. Once scrolling stops, idle work warms those graphs and prepares their screens. Measure-number route identities let navigation adopt the matching screen. Each new viewport releases only hidden measure screens that are no longer visible; active readers, Back history, unrelated preloads, and cached data remain intact. The viewport bounds retained hidden readers instead of a fixed first-two limit.

Each preload starts in a new idle callback while its source screen is focused and the app is active. Touches and scrolling pause the queue; navigation, backgrounding, or unmounting cancel queued callbacks. An existing query can finish so navigation can share it. The guide and graph queries use a one-minute freshness window. Hidden guide and graph observers read the cache without fetching. Focusing a prepared screen enables its query, so stale or failed preparation can fetch again without discarding available content. Background guide and graph requests do not retry. Expo owns the prepared screens; the custom queue only schedules idle work and bounds reader preparation.

Hidden readers can load their DOM content and fonts before navigation. iOS defers their paint callbacks until they are visible, so the native skeleton still covers the first paint. Cold or incomplete preparation also retains the skeleton. Hidden readers do not start the reader failure deadline or translation polling, and their speech cleanup cannot stop a visible reader.

The debate reader's Map view offers **Show all arguments** below the List/Map
switch and in the full-screen map header. Checking it reveals every available
card and connection and fits the whole graph; readers can zoom in to read it.
Unchecking returns to the current topic. This choice survives navigation and
language changes within the same graph revision, and starts off for a new debate.
Whole-map mode uses link attraction, repulsion and measured card separation so
connected arguments form neighborhoods without overlapping. At overview scale,
solid nodes replace text that would be too small to read; zooming in restores
complete short labels, and tapping a node opens the argument and its sources.
The simulation settles at rest and reheats while dragging. Cards and connections
share one viewport so their positions and tap targets stay aligned.
The implementation lives in the [shared map engine](../apps/expo/src/components/trillion/dom/reader-engine.js).

The [native debate host](../apps/expo/src/components/trillion/TrillionScreen.tsx) keeps its header and skeleton visible while the DOM reader mounts. Storage completion is not a visual-ready signal: the reader waits for its stylesheet, fonts, and a painted frame before revealing content. A two-second typography deadline selects system fonts for that document if font loading stalls, preventing both indefinite loading and a late font swap. The DOM root has an explicit full column width, and the native navigation container shares the navy canvas so iOS rounded transitions cannot expose white corners. [Runtime evidence](evidence/measure-loading/README.md) records the verified states and limits.

The How to Vote entry opens an address-free California guide with official
registration, voting-location, ID and same-day registration links. Its wording
and controls follow the selected app language; source names and published
wording remain as supplied. The personalized `/how-to-vote` route keeps the
server launch gate and selected election context. It reuses the shared official
voting-guidance reader, retains citations on individual locations, and lets a
reader edit an address after a failed lookup. A partially dated set of locations
cannot establish that an entire voting method is closed or not open yet.

### Ballot, research, and shared readers

Address-ballot responses attach a short-lived signed translation reference. The server signs only its canonical contest title and allowed generated summaries, with the ordered candidate names as identity; the client cannot submit arbitrary prose for paid translation. The reference expires after 24 hours. The [ballot translation hook](../apps/expo/src/hooks/useBallotTranslation.ts) checks the returned identity and exact original field before applying a display overlay, and offers a ballot reload after expiration. These queries use POST because a signed source snapshot can exceed browser URL limits. Addresses and private preparation notes are never part of the reference or translation queue.

Candidate research is translated only after its release/publication gates pass. The catalog and full research reader use separate translation scopes. Claims, promises, finance explanations and evidence context translate; source excerpts, provenance, names, monetary values, release IDs and review digests do not change. Measure relationships and budget context follow the same rule: localized money labels live in an optional `display` object, while canonical amounts, comparison denominators and evidence remain unchanged.

Public card lists keep their initial English cards while translations are queued.
[Card polling](../apps/expo/src/hooks/useCardTranslationPolling.ts) checks only
translation cache IDs and source hashes, then reloads a list when new translations
are ready. Readiness requests use POST to support large paginated lists. Polling
backs off from three to fifteen seconds and stops after two minutes; the existing
Retry action starts another wait. Public content queries stay fresh for one minute
to avoid duplicate reads when a reader moves between screens.

Alert history requests the selected language through its private token-scoped
endpoint and refreshes while translation is pending, with the same backoff and
two-minute limit. Private alerts never use public card readiness. Test notifications use fixed localized copy and normalize to the current language when read. Ordinary OS push alerts still use their delivery-time copy; this does not persist a device language preference on the notification service.

App share links carry `lang`; `/b/[id]`, its metadata, and the story/preview images use the same reader translation cache. A missing translation displays a localized preparing state instead of producing an English share image. The standalone marketing site and editorial tools have no app language selection and are outside this mobile-page audit. See the [October page audit](localization-audit.md) for coverage and intentional source-language boundaries.

### Address confirmation, privacy, and updates

Device location fills an editable draft. Both full forms and compact news menus
require a visible confirmation action; Cancel discards the draft and invalidates
pending location requests. News copy refers to a coverage address, while ballot
copy asks for the registered voting address. The address-free voting guide labels
its links as deadlines to check with official sources instead of presenting them
as current dates. Settings → Privacy opens the Privacy Policy first and links
directly to address and OS permission controls.

[UpdatePrompt](../apps/expo/src/components/UpdatePrompt.tsx) owns the optional
update notices. Its OTA card stays dismissible while preparing a restart; dismiss
cancels restart intent, and a stalled preparation times out. Reduced motion does
not change the action's urgency. The localized
[App Store card](../apps/expo/src/components/AppStoreUpdateBanner.tsx) is suppressed
while the OTA notice or preparation is active. Both notices sit above the tab
bar so Back and the language selector remain reachable. It uses the installed native
version and a validated public Apple listing through `appRelease.latestIos`.
Development builds do not offer real App Store updates.
