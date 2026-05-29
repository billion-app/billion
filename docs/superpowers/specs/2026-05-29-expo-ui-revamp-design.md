# Expo UI Revamp — Design Spec

**Date:** 2026-05-29
**Goal:** Revamp `apps/expo/` UI to pixel-match the mockups in `new-design/` (billion-core, billion-screens-main, billion-screens-content, billion-screens-settings, billion.css).

## Decisions (from brainstorming)

- **Fidelity:** Pixel-match all screens.
- **Tab bar:** 4 tabs — Browse · Feed · Elections · Settings (icons: search / layers / vote / settings). Move `local-elections` into `(tabs)/elections.tsx`.
- **Icons:** Keep `@expo/vector-icons` (Ionicons/FontAwesome), mapped via a single `Icon` component so the icon set is swappable later.
- **Missing data:** Build screens, stub data inline. Real tRPC where it exists (content, video, elections/voterInfo); hardcoded sample data for user-specific features (saved/blocked/interests/profile, dual-lens stances, timeline).
- **Auth/profile:** Placeholder profile (mockup "Jordan Avery") across Settings; defer real auth wiring.

## Architecture

The Expo app already shares the design palette via `@acme/ui/theme-tokens` (navy planes, content-type colors, semantic colors) and loads the three brand fonts (IBM Plex Serif / Inria Serif / Albert Sans). `styles.ts` is the single styling source of truth. This revamp extends — not rewrites — that foundation.

### Shared primitives — `src/components/ui/`

One file per primitive (or grouped where tiny), each a focused, themed RN component mirroring `billion-core.jsx`:

- `Icon` — maps design glyph names (`search`, `layers`, `vote`, `bookmark`, `chevR`, `scale`, `sparkle`, …) to Ionicons/FontAwesome. Single swap point.
- `Badge` — content-type uppercase pill.
- `Spine` — thin colored left-edge bar on cards.
- `PrimaryButton` (white pill, 52h) / `GhostButton`.
- `Avatar` — initials on tinted plane.
- `Toggle` — switch.
- `Segmented` — article explainer/source control.
- `Pill` — filter / interest chip (active = white fill).
- `LensStrip` — compact dual-lens spectrum read-out (tap to expand).
- `LensPanel` — two-column "both sides side by side" dual-lens card.
- `NavHeader` — back circle / title / action; `large` variant for display title.
- `Placeholder` — striped art block.
- `SettingsRow` — icon tile + label + subtitle + chevron.
- `ContentCard` — spine + badge + tag + bookmark + serif title + gist + status + timestamp.

`styles.ts` gains the missing surface planes (`surface` #323848, `hi` #3C4356) and hairline tiers (`hair`/`hair2`/`hair3`) plus an `ELECTION`/`local` type color alias. Theme tokens stay the source.

### Screens

| Screen | File | Data |
|---|---|---|
| Browse | `(tabs)/index.tsx` | real `content.getByType` + Fuse search |
| Feed | `(tabs)/feed.tsx` | real `video.getInfinite`; lens/stat/chips stubbed |
| Elections | `(tabs)/elections.tsx` (moved) | real `civic.getVoterInfo`/`getElections`; restyle existing section components; candidate/measure/lens detail stubbed |
| Article detail | `article-detail.tsx` | real `content.getById`; meta strip / timeline / lens stubbed |
| Settings hub | `(tabs)/settings.tsx` | placeholder profile, 4 groups, sign out |
| Edit Profile / Interests / Saved / Blocked / Privacy / Help / Feedback / About | `settings/*.tsx` | inline stub state (local `useState`); Saved pulls real content, stub-flagged |

`local-elections.tsx` deleted; banner `onPress` routes to `/elections` tab. `terms.tsx` kept, reachable from About's "Terms of service" link (mockup folds it there). Existing election section components (`MyBallotSection`, `KeyDatesSection`, `CandidatesSection`, `BallotMeasuresSection`, `LocalBillsSection`) restyled to match, data wiring preserved.

## Data flow

- Content/video/elections: unchanged tRPC + react-query.
- User-specific (saved/blocked/interests/profile): component-local `useState` seeded with sample data matching the mockups. Marked `// TODO(backend)` so the wiring point is obvious. No backend/schema changes this pass.
- Dual-lens stances, article timeline, feed key-facts: derived/stub content, `// TODO(backend)`.

## Error / loading / edge

Preserve existing loading (ActivityIndicator), error, and empty states; restyle to match (centered, serif heading + muted subtext). Feed snap-scroll, infinite query, and safe-area insets preserved.

## Testing

Visual match against mockups is the bar. `tsc --noEmit` and `eslint` must pass. Existing `testID`s on cards/badges preserved so any current tests keep resolving.

## Out of scope

Backend tables/routes for user data; real auth profile; light-mode polish beyond what tokens already give; animations beyond existing fade/slide.
