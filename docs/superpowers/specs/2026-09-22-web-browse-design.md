# Web Browse — design

Status: proposed. Nothing here is built yet.
Date: 2026-09-22

## What this is

A browser version of the app's Browse tab and its article reader, served from
`apps/nextjs`. Someone on a laptop should be able to search the government
archive, filter it, switch jurisdiction, open a record, read the full brief,
and save it for later — without installing the app.

## Why now

Browse is the part of the app that works without an account and without a
location. Every procedure it needs is already public
(`content.getByType`, `content.getFeaturedBills`, `content.search`,
`content.getById` in `packages/api/src/router/content.ts`). The Next.js app
already loads the same three brand fonts and already renders a navy record
page at `/b/[id]`. The work is a new surface, not new plumbing.

## Decisions taken

These were settled during design. Revisit them deliberately, not by accident.

1. **Signed-in is not a prerequisite.** Accounts are not built. The phone's
   sign-up sheet says so (`apps/expo/src/components/onboarding/ClaimWorkspaceSheet.tsx:4`),
   saves are device-local (`apps/expo/src/utils/saved-store.ts`), and the only
   configured provider is optional Discord OAuth. Web Browse ships without
   login, and stores saves and preferences behind one interface so a later
   account system replaces the storage rather than the screens. See
   [Reader state](#reader-state).
2. **A full web reader, not the share page.** `/b/[id]` stays what it is: a
   thin, skimmable, forwardable page that ends in an install prompt. The web
   reader is a separate route with the phone's depth — brief, dual lens,
   timeline, glossary, deep dive, original text.
3. **The look follows the phone.** Same Digest palette, type scale and
   rhythm. Not a pixel port: a desktop viewport gets desktop layout.

## Scope

In scope:

- A Browse page: jurisdiction scope, search, type filters, featured rail,
  paged result list.
- A reader page: the phone's article detail, adapted to a document layout.
- Local saves, a saved list, and jurisdiction persistence.
- Shared design tokens so the two clients cannot drift silently.

Out of scope, and stated so a reader does not assume otherwise:

- Accounts, sign-in, cross-device sync.
- The Feed brief, onboarding, notifications, Elections.
- Changes to `/b/[id]` beyond leaving it alone.
- Any change to the API's behavior. If a screen needs data the API does not
  return, that is a separate decision, not a quiet router edit.

## Architecture

### Where it lives

Routes inside `apps/nextjs`, not a new app:

| Route | Renders |
| --- | --- |
| `/browse` | The catalog. Scope, search, filters, featured rail, results. |
| `/browse/saved` | The local saved list. |
| `/read/[id]` | The full reader. |

`/read/[id]` rather than reusing `/b/[id]`: two pages with two jobs and two
endings. The share page keeps its install call to action and its deliberate
thinness; the reader assumes someone who came to read.

A new app would need its own auth wiring, its own tRPC setup, its own deploy
target, and would still import the same routers. The existing app already has
all four.

### Rendering

Server-render the first screen, hydrate for interaction:

- `/browse` server-renders the first page of results for the requested scope
  and filter through the server caller (`apps/nextjs/src/trpc/server.tsx`),
  the same pattern `/b/[id]` uses via `shared-content.ts`. Search,
  filter changes and pagination then run on the client through
  `apps/nextjs/src/trpc/react.tsx`.
- Scope and filter live in the URL (`/browse?scope=ca&type=bill&q=wildfire`).
  A filtered view is then linkable, shareable and back-button correct — three
  things the phone does not have to care about and the web does.
- `/read/[id]` server-renders through the server caller and hydrates only the
  parts that need it: the explainer/source toggle, the save button, the
  provenance disclosure.

### Data

No new procedures. Reuse:

| Need | Procedure |
| --- | --- |
| Result list, paged | `content.getByType` (cursor, `limit`, `jurisdiction`) |
| Featured rail | `content.getFeaturedBills` |
| Search, and the cross-jurisdiction count | `content.search` |
| The record | `content.getById` |
| Sponsor card | `content.getSponsorProfile` |

`content.getById` already returns the brief, the lens data and the sponsor
identity, so the reader's depth is a rendering problem, not a data problem.

### Design tokens

The Digest values live in `apps/expo/src/styles.ts` and nothing outside Expo
can read them. Copying them into CSS would mean two sources of truth for a
palette that is still being tuned.

Extract them once, into `packages/ui/src/digest-tokens.ts`, as plain data:
palette, radii, spacing, type scale, hairlines. Then:

- `apps/expo/src/styles.ts` re-exports from that module. Every existing
  `~/styles` import keeps working; the file stays the mobile entry point, as
  [the styling guide](../../expo-styling.md) requires.
- The web emits the same values as CSS custom properties from a single
  generated block, and Tailwind reads them.

The guide's rule — do not add a parallel palette file — is the reason for
this shape, not an argument against it. One module, two consumers.

### Layout

The phone is one column because it has to be. The web should not pretend to
be a phone, and should not become a different product either.

- Below 768px: the phone's layout, near enough. One column, filter pills
  scroll horizontally, cards full width.
- 768px and up: content column capped around 720px for the reader, and a
  two-column result grid for Browse, with the scope and filter controls
  pinned in a left rail.
- 1280px and up: the reader gets a right rail carrying the timeline and the
  glossary, which on the phone sit inline. Same content, less scrolling.

The featured rail stays horizontal at every width. It is the one piece of
the phone's rhythm that already reads as a rail rather than a compromise.

### Reader state

One module, `apps/nextjs/src/lib/reader-state.ts`, owns everything personal:

```
interface ReaderState {
  savedIds(): Promise<string[]>;
  save(id: string, meta: SaveMeta): Promise<void>;
  unsave(id: string): Promise<void>;
  jurisdiction(): Promise<Jurisdiction>;
  setJurisdiction(j: Jurisdiction): Promise<void>;
}
```

The first implementation writes to `localStorage`, mirroring the shape of
`apps/expo/src/utils/saved-store.ts` — an ordered list, newest first,
under a versioned key. Async in the signature though synchronous underneath,
so a server-backed implementation is a swap and not a refactor of every
caller.

When accounts arrive, a second implementation calls `content.saved.*` (those
procedures already exist and are protected), and the local list is uploaded
once on first sign-in. Nothing else changes.

No component touches `localStorage` directly. That rule is the whole point
of the module; a single direct call defeats it.

## Components

Web components, in `apps/nextjs/src/app/browse/_components` unless shared:

| Component | Phone counterpart |
| --- | --- |
| `ScopeBar` | `JurisdictionScopeRow` |
| `SearchField` | `SearchInput` |
| `FilterPills` | `Pills` / `Pill` |
| `FeaturedRail` | `FeaturedBills` |
| `ResultCard` | `ContentCard` |
| `ReaderHeader` | `NavHeader` + badge row |
| `BriefBlocks` | `BillBrief` |
| `LensPanel` | `DualLens` |
| `Timeline` | the inline timeline in `article-detail.tsx` |
| `SourcePanel` | `HighlightedSource` |

These are rewrites in HTML and CSS, not shared code. `packages/ui`'s web
components need browser APIs and its native ones need React Native; the two
halves do not meet, and forcing them to would cost more than the duplication
saves. What is shared is the token module and the API types.

`BriefBlocks` is the largest piece. `BillBriefData`
(`apps/expo/src/components/ui/BillBrief.tsx:78`) carries hook, summary,
facts with quotes, changes, affected groups, unknowns, glossary terms,
`whyNotBefore`, deep dive and reading list. Each is a block renderer; build
them in the order above, since a record missing later fields still renders.

## Provenance

The distinction the repo protects — source text is not generated
explanation — carries over without exception:

- The explainer/source toggle ships in the first reader, not later.
- The "Written by Billion AI · Always check the source" disclosure appears on
  the explainer view, expandable, same copy as the phone.
- Quotes keep their locators; the link to the official record keeps its
  place at the end of the explainer.

A reader that renders the brief but not the source toggle would present AI
analysis as the record. It would not be a smaller version of this design; it
would be the wrong one.

## Failure and empty states

Carried from Browse, because they say something true about the data:

- A state jurisdiction has bills but no courts or orders yet. The empty
  state says that, and offers the bills filter.
- A failed list keeps the current scope and offers a retry, rather than
  silently falling back to federal.
- A search with matches in the other jurisdiction shows the count and a
  switch, as the phone does.
- A record that does not resolve is a 404, not an error page. `/b/[id]`
  already makes this distinction; follow it.

## Verification

- `pnpm --filter @acme/nextjs typecheck`, `lint`, `test`.
- `pnpm --filter @acme/expo typecheck` after the token extraction, since
  `styles.ts` changes underneath every mobile screen.
- A production build (`pnpm --filter @acme/nextjs build`), since the reader
  is server-rendered and a server caller failure will not show in dev.
- Manual: 375px, 768px, 1440px. Search, filter, scope switch, pagination,
  save, reload, and back-button behavior on a filtered URL.

## Open questions

Answer these before or during planning; none of them block starting.

1. Does `/browse` need to be indexed by search engines? If yes, result pages
   need stable URLs per page and metadata per scope. The design supports it;
   nobody has asked for it.
2. Should the phone eventually link into web Browse for anything, or do the
   two stay separate surfaces? Assumed separate.
3. Does the reader need sharing (copy link, image card)? `/b/[id]` already
   has share art. Assumed out of scope for the first version.
