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
| Address-based ballot lookup                         | [Elections route](<../apps/expo/src/app/(tabs)/elections.tsx>) — parked while `electionsAreLive()` returns false                                                                                                                                                                                                                           |
| Original content, explanation, brief, and citations | [Article detail](../apps/expo/src/app/article-detail.tsx)                                                                                                                                                                                                                                                                                  |
| Candidate race and ballot measure details           | [Contest detail](../apps/expo/src/app/contest-detail.tsx), [measure detail](../apps/expo/src/app/measure-detail.tsx)                                                                                                                                                                                                                       |
| Tab registration and visibility                     | [Tab layout](<../apps/expo/src/app/(tabs)/_layout.tsx>) and [custom TabBar](../apps/expo/src/components/ui/TabBar.tsx)                                                                                                                                                                                                                     |
| Lock-screen OS alerts                               | [local-notification](../apps/expo/src/utils/local-notification.ts) and [push-sync](../apps/expo/src/utils/push-sync.ts). Compact chrome is Apple’s. The phone registers an Expo token; [notifications](../packages/api/src/router/notifications.ts) stores prefs and follows; `notify-followers` sends the alert. Tap follows `data.href`. |
| In-app OTA restart prompt                           | [UpdatePrompt](../apps/expo/src/components/UpdatePrompt.tsx); visibility in [update-prompt](../apps/expo/src/utils/update-prompt.ts)                                                                                                                                                                                                       |

The Feed tab is a short brief. [DigestHome](../apps/expo/src/components/DigestHome.tsx) shows up to seven featured local bills under “Today’s local news”. “Also today” shows up to seven unread featured federal bills, falling back to recent federal bills only when no featured bills are available. It preserves the API's ordering rather than inventing a daily ranking or filtering by calendar date. Opening a successfully loaded [article detail](../apps/expo/src/app/article-detail.tsx) records its ID in [device-local read history](../apps/expo/src/utils/read-content.ts), so returning Home removes it from “Also today”. When that selection is empty or fully read, the section says “No new articles today”; loading and request failures remain separate states. Read history does not require an account, sync across devices, or affect Browse and the local rail. Saving a bill, case, or order reuses the separate device-local saved set; the article page draws a four-stop legislative path from the projected status label and does not invent chamber passage. The home greeting starts as soon as the splash has hidden and the local brief has settled, so a cold start does not consume the ceremony behind the splash or a loading spinner.

Article detail renders bill `brief` with `BillBrief` and court `courtBrief` with
[CourtBrief](../apps/expo/src/components/ui/CourtBrief.tsx). Court sections explain
the specific relief and its procedural limits, attributed reasoning and opinions,
effects, unknowns, and linked official documents. Emergency orders are labelled
as interim relief. Legislative stages appear only for bills. Records missing a
current court brief keep their Markdown or original-text fallback; the original
text tab remains available alongside the brief and cited lenses.

Feed, Browse, and Elections are visible tabs. Feedback and Settings are reached from the profile mark. The Elections tab is a coming-soon placeholder and does not call Civic or Places while `electionsAreLive()` returns false. While it is parked, set a home address (Places autocomplete) and coverage (federal, California, North Carolina, Texas) from the Feed lockup dropdown or the Browse jurisdiction sheet. Check both Expo Router options and the custom `TabBar` when changing visibility.

The [OTA restart prompt](../apps/expo/src/components/UpdatePrompt.tsx) overlays the root stack. It asks to restart only when `expo-updates` is enabled and a downloaded update is waiting that is not already the running bundle. `isUpdatePending` alone is not enough — Expo can report the current launch as pending after a previous download. Preview the chrome in development with `EXPO_PUBLIC_FORCE_UPDATE_BANNER=1`.

## Onboarding and content preferences

`OnboardingGate` waits for the device store to load, then sends a reader who has not completed onboarding to the onboarding route. The store writes one JSON object to AsyncStorage under the versioned key `billion.onboarding.v1`. It contains the completion flag, selected government vectors, sectors, derived topic labels, alert choices, and whether the reader dismissed the account prompt. These values do not require an account and remain on that device. The final sheet offers an optional mailing list signup through the website’s `/api/waitlist` endpoint; the reader can still start exploring without subscribing. The email goes to the server only when submitted and is not saved in the onboarding record. The sheet handles new and existing subscribers separately and keeps network errors visible for retry.

The watch and topic pages share a rotating White House illustration. Each government selection adds a structural section; each topic selection adds architectural detail. On the topic page, the first three picks also complete any remaining structural sections, so choosing fewer governments still leads to a complete building. Removing a selection reverses its construction step, and reduced motion shows the new state without rotation or fades. The geometry lives in [whiteHouse3d.ts](../apps/expo/src/components/onboarding/whiteHouse3d.ts) and the animation in [WhiteHouseSpin.tsx](../apps/expo/src/components/onboarding/WhiteHouseSpin.tsx).

When onboarding finishes with an authenticated session, `OnboardingFlow` also calls the protected `user.setPreferences` procedure. That procedure upserts topic and content-type arrays in PostgreSQL. The device record remains the source used by the onboarding gate and Digest connection labels; the Settings interest screen reads the server record instead. There is no general synchronization between the two stores.

The current Feed does not filter or rank cards by stored topics or content types. It chooses local content from the saved address or Browse jurisdiction and uses selected government vectors only for connection copy such as “You watch Congress.” “Also today” loads more federal articles as the reader scrolls. Opening an article records its first-read time on the device; the card remains in the feed for 24 hours, then stays hidden. Follow alerts use the notification pipeline; the other alert choices do not yet schedule notifications or email digests. Keep those limits explicit until the corresponding delivery paths exist.

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

## Authentication

[packages/auth/src/index.ts](../packages/auth/src/index.ts) configures Better Auth with the Drizzle adapter, optional Discord OAuth, the OAuth proxy, and the native callback bridge. Next.js exposes it through `/api/auth` and passes the resulting session into the tRPC context.

Web requests carry session cookies. The Expo auth client stores its session locally and supplies a `Cookie` header through the tRPC link. For an auth failure, follow the callback, stored cookie, and API context before changing a screen. See [API](api.md#request-path) and [Troubleshooting](troubleshooting.md).

### Notification history and testing

On a physical phone, Your alerts loads the server history when the screen opens. These are pushes accepted by Expo; entries are removed if a later receipt reports failure or delivery remains unknown after 24 hours. Receipt success confirms provider acceptance, not display on the phone. Empty history stays empty; old sample entries are discarded. Test reports push failures without substituting a local notification. Simulators use local OS notifications and keep only successfully scheduled tests in local history.

Push registration waits for onboarding to finish and notification preferences to load. Completing onboarding writes the selected instant and recap choices to the notification store before registration starts. Later Settings edits remain authoritative across launches.
