# Frontend Apps

## Expo (Mobile) — primary client

**Expo SDK 53, React 19, Expo Router 5.** It talks to the backend **exclusively over the tRPC HTTP API** — no direct DB access.

**Why mobile can't hit the DB directly:**

1. **No TCP socket in React Native.** Drizzle's `pg` driver needs Node's `net`/`tls` to open a Postgres connection; RN's runtime has no socket layer.
2. **Security.** A connection string in an app binary is extractable → unrestricted DB access for anyone.

A PostgREST-style HTTP API (Supabase anon key + RLS) would solve both, but our business logic and auth live in the tRPC layer, so we keep the DB server-side and reach it via RPC.

**tRPC client** (`apps/expo/src/utils/api.tsx`) uses `httpBatchLink`. The base URL (`utils/base-url.ts`) prefers `EXPO_PUBLIC_API_URL`, else auto-detects the dev machine's IP from the Expo debugger host, else `localhost:3000`. Requests carry `x-trpc-source: expo-react` and the auth cookie.

**Screens** (Expo Router): four tabs — Browse (`index`, content + search + an election banner for the signed-in user's own election), Feed (`feed`, swipeable video cards), Elections (`elections`, address-based voter info — a Places-backed address autocomplete resolves the registered address, then a **Candidates / Measures** segmented control splits the resolved ballot into the two contest types), Settings. Detail routes include `article-detail`, `contest-detail`, `measure-detail`, and `local-elections`. The measure-detail screen renders the short summary on the card and the long summary on detail, the `summaryIsAiGenerated` label, structured pro/con arguments, fiscal impact, and per-field source citations linking back to origin. The contest-detail screen renders the enriched candidate fields — photo, biography, incumbent badge, contact link, social channels — alongside the same per-field source citations.

**Styling:** NativeWind v5. All Expo styles are consolidated in `apps/expo/src/styles.ts`, which re-exports shared tokens from `@acme/ui/theme-tokens` and adds RN-specific layers (`planes` for surface depth, `hair` hairline borders, content-type colors) plus the `sp`/`rd` rem-to-px helpers and a `useTheme()` hook. Brand fonts (IBM Plex Serif, Inria Serif, Albert Sans) load via `expo-font`. See the [Expo styling guide](./expo-styling.md) for the full style API.

## Next.js (Web)

**Next.js 16, React 19, App Router.** Serves the marketing/landing page (hero, privacy, terms) and hosts the tRPC API. The route handler is `apps/nextjs/src/app/api/trpc/[trpc]/route.ts` (`fetchRequestHandler` over `appRouter`, with the server-side `auth` instance and CORS). RSC prefetch + `HydrateClient` on the server (`trpc/server.tsx`); the client (`trpc/react.tsx`) uses `httpBatchStreamLink`. In production it deploys to Vercel; in dev the Expo app tunnels to it via localtunnel (see [Localtunnel setup](./localtunnel.md)).

## Shared UI

`packages/ui/` provides Radix-based, shadcn-style web components (button, input, field, label, separator, dropdown-menu, toast via Sonner) plus React Native variants (`button-native`, `card-native`) and the cross-platform `theme-tokens.ts` (colors, dark/light themes — dark is default — font sizes, weights, shadows). Add components with `pnpm ui-add`.

## Auth (cross-platform)

better-auth (`packages/auth/`, `initAuth()`): Drizzle/Postgres adapter, Discord OAuth (when configured), `oAuthProxy`, and a custom **`expoPlugin`** that bridges OAuth/magic-link callbacks back to the native app. The plugin mirrors the `expo-origin` header to `origin` for better-auth's origin check and appends the set-cookie into deep-link params so the native client can store the session.

- **Web** — better-auth sets an HttpOnly cookie; fetch sends it automatically.
- **Mobile** — `@better-auth/expo` stores the session locally and the tRPC link injects it as a `Cookie` header; trusted origin `expo://`.
