# Web Browse Implementation Plan

> **Status: implemented** on `feat/web-browse` (2026-09-23). This is the plan as
> written before the build, kept for history; the checked boxes are done. Where
> the build departed from it, see [Changes during implementation](#changes-during-implementation).
> The code and [the frontend guide](../../frontend.md#web-browse-and-the-reader)
> describe current behavior.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/browse`, `/browse/saved` and `/read/[id]` in `apps/nextjs`: the phone's Browse tab and article reader, laid out for a browser, with no sign-in.

**Architecture:** The new routes sit in one route group, `apps/nextjs/src/app/(reader)/`, whose layout emits the Digest tokens as CSS custom properties and draws the web chrome. `/browse` server-prefetches its first page through the tRPC server proxy and hydrates. After that, search, filters and paging run on the client, and scope, type and query live in the URL. `/read/[id]` server-renders through a session-less caller, the same pattern as `/b/[id]`. It hydrates only the mode toggle, the save button and "View source". Everything personal goes through one `ReaderState` module backed by `localStorage`.

**Tech Stack:** Next.js 16 App Router, React 19, tRPC v11 + TanStack Query, Tailwind v4, `markdown-it` for non-brief articles, Node's test runner via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-22-web-browse-design.md`

## Global Constraints

- No new tRPC procedures and no change to API behavior. Use only public procedures: `content.getByType`, `content.getFeaturedBills`, `content.search`, `content.getById` and `content.byIds`.
- No component touches `localStorage` directly. Only `apps/nextjs/src/lib/reader-state.ts` does.
- `/b/[id]` is not modified.
- The explainer/source toggle, the "Written by Billion AI · Always check the source" disclosure (same copy as the phone), quote locators and the closing link to the official record all ship in the first reader.
- A record that does not resolve renders a 404 (`notFound()`), not an error page.
- Breakpoints: <768px phone layout; ≥768px left rail + two-column results, reader column ≈720px; ≥1280px reader right rail with timeline and glossary.
- Digest values come from one module, `packages/ui/src/digest-tokens.ts`. `apps/expo/src/styles.ts` re-exports it, and no parallel palette file is added.
- Keep `@acme/db/client` out of client bundles. Only `server-only` modules import it.

## Decisions made while planning (spec open questions and gaps)

- **Indexing (Q1):** `/browse` gets metadata but no per-scope SEO work. `/read/[id]` sets `canonical` to the share URL `/b/<slug>-<id>`, so search engines keep one URL per record.
- **Phone linking (Q2):** separate surfaces. Nothing changes in Expo apart from the token re-export.
- **Sharing (Q3):** out of scope. The reader has a "Copy link" button only, which needs no share art.
- **Saved list hydration:** uses `content.byIds`, an existing public procedure the spec's table omits. It adds no new plumbing.
- **Sponsor card:** `content.getById` already returns `sponsor`, so the reader renders it without calling `getSponsorProfile`. The card is not a link, because a sponsor page is out of scope.
- **Route group:** components live in `app/(reader)/browse/_components` and `app/(reader)/read/_components`. The URL paths match the spec.

## File map

| File                                                                    | Responsibility                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/ui/src/digest-tokens.ts` (new)                                | Plain-data Digest palette, hairlines, radii, spacing, type scale, content-type colors           |
| `packages/ui/package.json`                                              | add `./digest-tokens` export                                                                    |
| `apps/expo/src/styles.ts`                                               | import + re-export Digest values from `@acme/ui/digest-tokens`                                  |
| `apps/nextjs/src/lib/digest-css.ts` (+test)                             | turn tokens into one `:root{--digest-…}` block                                                  |
| `apps/nextjs/src/app/globals.css`                                       | `@theme inline` mapping `--color-digest-*` → vars                                               |
| `apps/nextjs/src/lib/browse-params.ts` (+test)                          | parse/serialize `scope`, `type`, `q`                                                            |
| `apps/nextjs/src/lib/jurisdictions.ts`                                  | web display copy for jurisdictions                                                              |
| `apps/nextjs/src/lib/content-card.ts` (+test)                           | `toCardItem`, `relativeActivity`, `withoutFeatured`, type presentation                          |
| `apps/nextjs/src/lib/reader-state.ts` (+test)                           | `ReaderState` interface, localStorage impl, `useSaved`/`useJurisdiction` hooks                  |
| `apps/nextjs/src/lib/source-match.ts` (+test)                           | locate a quote inside original text                                                             |
| `apps/nextjs/src/app/(reader)/layout.tsx`                               | tokens `<style>`, web chrome (wordmark, Browse, Saved)                                          |
| `apps/nextjs/src/app/(reader)/_components/*`                            | `SiteBar`, `Icon`, `SaveButton`                                                                 |
| `apps/nextjs/src/app/(reader)/browse/page.tsx`                          | server prefetch + `HydrateClient`                                                               |
| `apps/nextjs/src/app/(reader)/browse/_components/*`                     | `BrowseCatalog`, `ScopeBar`, `SearchField`, `FilterPills`, `FeaturedRail`, `ResultCard`, states |
| `apps/nextjs/src/app/(reader)/browse/saved/page.tsx`                    | saved list                                                                                      |
| `apps/nextjs/src/app/(reader)/read/[id]/page.tsx` + `reader-content.ts` | server fetch, metadata, 404                                                                     |
| `apps/nextjs/src/app/(reader)/read/_components/*`                       | `ReaderHeader`, `ReaderBody`, `BriefBlocks`, `LensPanel`, `Timeline`, `SourcePanel`, `Markdown` |

---

### Task 1: Shared Digest tokens

**Files:**

- Create: `packages/ui/src/digest-tokens.ts`
- Modify: `packages/ui/package.json` (exports)
- Modify: `apps/expo/src/styles.ts:31-230` (replace literal definitions with imports + re-exports)
- Create: `apps/nextjs/src/lib/digest-css.ts`, `apps/nextjs/src/lib/digest-css.test.ts`
- Modify: `apps/nextjs/src/app/globals.css`

**Interfaces:**

- Produces: `planes`, `hair`, `digest`, `DigestHair`, `DigestRadii`, `DigestSpace`, `contentTypeColors` from `@acme/ui/digest-tokens`, and `digestCssVariables(): string` from `~/lib/digest-css`. The CSS names follow `--digest-<group>-<key>`, e.g. `--digest-planes-navy` and `--digest-hair-card-border`.

- [x] **Step 1:** Move the literal objects `planes`, `hair`, `digest`, `DigestHair`, `DigestRadii`, `DigestSpace` and the `contentType` colors from `styles.ts` into `digest-tokens.ts`, unchanged, `as const`, with no React Native imports.
- [x] **Step 2:** In `styles.ts`, `import { planes, hair, digest, DigestHair, DigestRadii, DigestSpace } from "@acme/ui/digest-tokens"` and `export { … }`. Keep `DigestPalette`, `DigestColor` and the rest as derived aliases in `styles.ts` so every `~/styles` import still resolves.
- [x] **Step 3:** Write the failing test `digest-css.test.ts`. It asserts that the output contains `--digest-planes-navy:#0E1530;`, `--digest-digest-ink-on-night:#F7F4EE;` and `--digest-hair-card-border:rgba(247,244,238,0.08);`, and that numeric radii get `px`.
- [x] **Step 4:** Implement `digestCssVariables()`: flatten the groups, kebab-case the keys, add `px` to numbers, wrap in `:root{…}`.
- [x] **Step 5:** In `globals.css`, add `@theme inline { --color-night: var(--digest-planes-navy); --color-slate: …; --color-surface: …; --color-paper: …; --color-ink-night: …; --color-quiet: …; --color-spark: …; --color-primary-blue: …; --color-rule: var(--digest-hair-section-rule); --color-card-border: …; --color-bill: …; --color-order: …; --color-case: … }`.
- [x] **Step 6:** Run `pnpm --filter @acme/nextjs test`, `pnpm --filter @acme/expo typecheck` and `pnpm --filter @acme/ui typecheck`. Commit: `refactor(ui): extract Digest tokens for web and mobile`.

### Task 2: Browse URL params, jurisdictions, card mapping

**Files:**

- Create: `apps/nextjs/src/lib/browse-params.ts` (+ `.test.ts`)
- Create: `apps/nextjs/src/lib/jurisdictions.ts`
- Create: `apps/nextjs/src/lib/content-card.ts` (+ `.test.ts`)

**Interfaces:**

- Produces:
  - `type Scope = "federal" | "ca" | "nc" | "tx"`; `type TypeFilter = "all" | "bill" | "government_content" | "court_case" | "general"`
  - `parseBrowseParams(sp: Record<string, string | string[] | undefined> | URLSearchParams): { scope: Scope | null; type: TypeFilter; q: string }`
  - `browseHref(p: { scope: Scope; type: TypeFilter; q: string }): string`. It omits defaults (`type=all`, empty `q`) and always keeps `scope` when it is not federal.
  - `JURISDICTIONS: Record<Scope, { name; body; code }>`, `SCOPES: Scope[]`, `isScope(v): v is Scope`
  - `FILTERS: { id: TypeFilter; label: string }[]` (All, Bills, Executive, Courts, Briefings)
  - `presentType(type)` → `{ label, kind, color }`
  - `toCardItem(item, { showJurisdiction? })` → `CardItem { id, typeLabel, color, tag?, title, gist?, status?, activityAt?, jurisdictionCode?, imageUri? }`
  - `relativeActivity(value, now)` (the phone's copy, verbatim)
  - `withoutFeatured(items, featured)`

- [x] **Step 1:** Write the failing tests. `parseBrowseParams({scope:"ca",type:"bill",q:" wildfire "})` returns `{scope:"ca",type:"bill",q:"wildfire"}`. An unknown scope or `mo` returns `null`. An unknown type returns `"all"`. `browseHref({scope:"federal",type:"all",q:""})` returns `/browse`. The state-bill tag becomes `"AB 12"` from `"CA AB 12 (2025-2026)"`, and `relativeActivity` covers today, 1 day and 5 days.
- [x] **Step 2:** Run `pnpm --filter @acme/nextjs test` and confirm the tests fail.
- [x] **Step 3:** Implement the modules as ports of `apps/expo/src/utils/content.ts`, `utils/jurisdiction.ts`, `utils/relative-activity.ts` and `utils/featured-bills.ts`.
- [x] **Step 4:** Run the tests and confirm they pass. Commit: `feat(web): browse params and card mapping`.

### Task 3: ReaderState

**Files:**

- Create: `apps/nextjs/src/lib/reader-state.ts` (+ `.test.ts`)

**Interfaces:**

- Produces:
  ```ts
  interface SaveMeta {
    type: string;
    title: string;
  }
  interface ReaderState {
    savedIds(): Promise<string[]>;
    save(id: string, meta: SaveMeta): Promise<void>;
    unsave(id: string): Promise<void>;
    jurisdiction(): Promise<Scope>;
    setJurisdiction(j: Scope): Promise<void>;
    subscribe(listener: () => void): () => void;
  }
  function createLocalReaderState(
    storage: Pick<Storage, "getItem" | "setItem"> | null,
  ): ReaderState;
  function useSavedIds(): {
    ids: string[];
    ready: boolean;
    isSaved(id): boolean;
    toggle(id, meta): void;
  };
  function useStoredJurisdiction(): {
    jurisdiction: Scope | null;
    setJurisdiction(j: Scope): void;
  };
  ```
- Keys: `billion.web.saved-content.v1` (ordered ids, newest first, max 200) and `billion.web.jurisdiction.v1`. `subscribe` covers same-tab changes and cross-tab `storage` events.

- [x] **Step 1:** Write the failing tests against a fake storage. A save puts the id first, and saving again moves it without duplicating. Unsave removes. Corrupt JSON reads as `[]`. The list is capped at 200. `jurisdiction()` defaults to `"federal"` and ignores unsupported values. A throwing `setItem` keeps the in-memory value. A `null` storage (SSR or blocked) works in memory.
- [x] **Step 2:** Run the tests and confirm they fail.
- [x] **Step 3:** Implement it, mirroring `apps/expo/src/utils/saved-store.ts`: pure list rules and a serialized update queue. Add the hooks with `useSyncExternalStore`. Server snapshot: `[]` / `null`.
- [x] **Step 4:** Run the tests and confirm they pass. Commit: `feat(web): local reader state behind one interface`.

### Task 4: Reader-group layout and chrome

**Files:**

- Create: `apps/nextjs/src/app/(reader)/layout.tsx`
- Create: `apps/nextjs/src/app/(reader)/_components/site-bar.tsx`, `icon.tsx`, `save-button.tsx`

**Interfaces:**

- Consumes: `digestCssVariables()`, `useSavedIds()`
- Produces: `<Icon name="bookmark"|"bookmarkFill"|"search"|"chevD"|"chevR"|"external"|"sparkle"|"doc"|"arrowRight"|"close"|"scale"|"book"|"help"|"clock"|"quote"|"link" size? />` and `<SaveButton id type title variant="icon"|"pill" />`

- [x] **Step 1:** The layout renders `<style dangerouslySetInnerHTML={{__html: digestCssVariables()}} />`, `<SiteBar />` and `{children}` on `bg-night text-ink-night`.
- [x] **Step 2:** `SiteBar` is sticky, with a 1px `rule` bottom border. It holds the wordmark "Billion" (IBM Plex Serif) linking to `/browse`, the nav links Browse and Saved (with a count badge, client), and "Get the app" linking to `/`.
- [x] **Step 3:** Run `pnpm --filter @acme/nextjs typecheck`. Commit.

### Task 5: `/browse`

**Files:**

- Create: `apps/nextjs/src/app/(reader)/browse/page.tsx`
- Create: `apps/nextjs/src/app/(reader)/browse/_components/browse-catalog.tsx` (client), `scope-bar.tsx`, `search-field.tsx`, `filter-pills.tsx`, `featured-rail.tsx`, `result-card.tsx`, `list-states.tsx`

**Interfaces:**

- Consumes: `parseBrowseParams`, `browseHref`, `toCardItem`, `withoutFeatured`, `useSavedIds`, `useStoredJurisdiction`, `trpc` (server proxy) / `useTRPC` (client)
- Page-size constant `PAGE_SIZE = 20`; `MIN_SEARCH_LENGTH = 2`; debounce 300ms.

- [x] **Step 1:** In `page.tsx`, await `searchParams` and parse. Treat `scope ?? "federal"` as `initialScope`. Prefetch `trpc.content.getByType.infiniteQueryOptions({type, limit: PAGE_SIZE, jurisdiction}, {initialCursor: 0, getNextPageParam: p => p.nextCursor})`, and prefetch `getFeaturedBills({jurisdiction})` when the type is all or bill and there is no query. Wrap in `<HydrateClient><BrowseCatalog initial={…} /></HydrateClient>`. Set metadata to `Browse — Billion`.
- [x] **Step 2:** `BrowseCatalog` holds `scope`/`type`/`q` state seeded from the props and writes changes back with `router.replace(browseHref(…), {scroll:false})`. A new scope also calls `setJurisdiction`. On mount, if the URL had no scope and the stored jurisdiction is not federal, adopt the stored one.
- [x] **Step 3:** Queries match the phone's `BrowseCatalog` (`apps/expo/src/app/(tabs)/index.tsx:84-190`): infinite list, featured, search, and other-jurisdiction search (limit 3).
- [x] **Step 4:** Layout. At `md:` it is a grid `[260px_1fr]`: the left rail (sticky) holds ScopeBar (a select-like menu of the four scopes, gold name), "Saved" and the vertical FilterPills. The main area holds the "Browse" display title, SearchField, FeaturedRail (horizontal, scroll-snap, 280px tall cards, gradient overlay), the results count and a `md:grid-cols-2` ResultCard grid with hairline rules. Below `md`, it is a single column with horizontally scrolling pills.
- [x] **Step 5:** States. A list error shows "`<name>` didn’t load / Your scope hasn’t changed" with Try again, and "Browse Federal instead" when not federal. The empty copy is the phone's, including "Show `<state>` bills". Other-jurisdiction matches get a dashed box with a count and "Switch". "Show more" calls `fetchNextPage`, with an IntersectionObserver sentinel for auto-load.
- [x] **Step 6:** Run typecheck and lint, then check against the dev server at 375/768/1440. Commit: `feat(web): browse catalog`.

### Task 6: `/read/[id]`

**Files:**

- Create: `apps/nextjs/src/app/(reader)/read/[id]/page.tsx`, `reader-content.ts` (server-only)
- Create: `apps/nextjs/src/lib/source-match.ts` (+ `.test.ts`)
- Create: `apps/nextjs/src/app/(reader)/read/_components/reader-body.tsx` (client), `brief-blocks.tsx`, `lens-panel.tsx`, `timeline.tsx`, `source-panel.tsx` (client), `markdown.tsx`, `emphasis.tsx`, `sponsor-card.tsx`

**Interfaces:**

- `getReaderContent(id: string): Promise<ReaderContent | null>` uses a caller with `session: null` and maps `NOT_FOUND` to `null`.
- `findQuote(text: string, quote: string): { before: string; match: string; after: string; found: boolean }` does an exact search, then a case-insensitive one.
- `ReaderBody` props: `{ accent: string; hasBrief: boolean; explainer: ReactNode; original: string; sourceUrl?: string; officialLabel: string }`. It provides `useViewSource()` to `ViewSourceButton`.

- [x] **Step 1:** Write the failing `source-match` tests: exact match, case-insensitive match, and a miss returning `found:false` with `after = text`. Implement and pass.
- [x] **Step 2:** In `page.tsx`, call `notFound()` on null. `generateMetadata` sets title, description, and a canonical pointing at `/b/<shareSegment>`. The layout is a grid: `xl:grid-cols-[minmax(0,720px)_300px]`, centered.
- [x] **Step 3:** The header renders header art (`<img>`, since it may be a data URI), the type badge, bill number, state body/session line, serif title, description, sponsor card and a Save and Copy link row.
- [x] **Step 4:** `ReaderBody` has a segmented toggle, "The brief"/"Plain explainer" against "Original text". Under the explainer: the provenance disclosure (`<details>`), with the phone's copy verbatim, then the explainer slot. Under the source: a "View on Original Site" / "View Federal Register record" button, then `SourcePanel`, which highlights and scrolls to the quote.
- [x] **Step 5:** `BriefBlocks` is a server component that renders blocks in the phone's order. Hook: the short-version card, with the extended version in `<details>`. WhyNotBefore: `<details>` with numbered sources. Terms: inline, `xl:hidden`. Changes: cards in a grid, not a carousel, with a quote disclosure and a `ViewSourceButton`. Affected: outcome rows with `<details>` "Why this matters". Unknowns. Dual lens. Keep reading: the deep dive as `<details>` rendered with Markdown, and external links. Records without a brief render `articleContent` through `markdown-it` (`html:false`, `linkify:true`), or as plain text.
- [x] **Step 6:** `Timeline` gives the phone's "Where it stands" card, with the actions sorted by date and each long entry expandable in `<details>`. It ends with "Official record · {sourceLabel}". It renders inline below `xl` and in the right rail at `xl` and above, next to the Key terms.
- [x] **Step 7:** The explainer ends with "Don't take our word for it." and an "Open the source" button.
- [x] **Step 8:** Run typecheck, lint and test, then view a bill with a brief, one without, an order and a case. Commit: `feat(web): full reader`.

### Task 7: `/browse/saved`

**Files:**

- Create: `apps/nextjs/src/app/(reader)/browse/saved/page.tsx`, `_components/saved-list.tsx`

- [x] **Step 1:** The client list reads `useSavedIds()` and queries `content.byIds({ids})`, reordered to save order. Its empty state is "Nothing saved yet — Tap the bookmark on any record to keep it here." with a link to `/browse`. Results use `ResultCard`, and unsaving removes them in place.
- [x] **Step 2:** Run typecheck, then save, reload, unsave. Commit: `feat(web): saved list`.

### Task 8: Verification

- [x] `pnpm --filter @acme/nextjs typecheck && pnpm --filter @acme/nextjs lint && pnpm --filter @acme/nextjs test`
- [x] `pnpm --filter @acme/expo typecheck`, `pnpm --filter @acme/ui typecheck`
- [x] `pnpm --filter @acme/nextjs build`
- [x] Take screenshots at 375, 768 and 1440 of `/browse`, `/browse?scope=ca&type=court_case`, a search, `/read/<bill with brief>`, its source mode and `/browse/saved`. Check the back button on a filtered URL.
- [x] Update the spec status line to "implemented on `feat/web-browse`" and add a short section to `docs/frontend.md` or `docs/README.md` linking the routes.

## Changes during implementation

Recorded after the build; these supersede the tasks above where they differ.

- `/browse` awaits its first-screen data on the server (`prefetchNow` in
  `apps/nextjs/src/trpc/server.tsx`) instead of streaming it, and prefetches
  search results when the URL has a query. Streaming hydrated `useQuery`
  against a loading state and produced a hydration mismatch.
- `scope` is always written to the URL, federal included, and the stored
  jurisdiction is mirrored to a `billion_scope` cookie so the server renders a
  bare `/browse` in the reader's scope. Previously a shared federal link could
  be rewritten to the reader's stored state.
- Jurisdiction names, legislatures and session labels come from
  `@acme/api/content-jurisdiction` (a new package export of an existing pure
  module) rather than a web copy.
- "View source" matches quotes with the pipeline's normalization
  (`normalizeForQuoteMatch`), not only exact text.
- Saved state is one shared `useSyncExternalStore` snapshot; the saved page
  forgets ids the server no longer returns. Only bills, orders and cases are
  saveable, as on the phone.
- Added after review with the product owner: an "On this page" section list
  in the wide-screen reader rail, and "Clear highlight" in the source view.
