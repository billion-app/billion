# Frontend apps

Expo is the primary client. Next.js serves the website and public article pages, and hosts the API both clients use. Start both for local mobile development with `pnpm dev`; use `pnpm dev:next` for website/API work. Setup is in [Contributing](../CONTRIBUTING.md).

## Find a mobile feature

Expo Router maps files in `apps/expo/src/app/` to routes. Start with the route, follow its query into `packages/api/src/router/`, then inspect the components it renders.

| Area                                                | Entry point                                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Providers, fonts, and app initialization            | [Root layout](../apps/expo/src/app/_layout.tsx)                                                                        |
| Feed brief — today’s local news                     | [DigestHome](../apps/expo/src/components/DigestHome.tsx), mounted from the [Feed tab](<../apps/expo/src/app/(tabs)/index.tsx>) |
| Browse, filters, and search                         | [Browse catalog](<../apps/expo/src/app/(tabs)/index.tsx>) (`BrowseCatalog`) on the Browse tab (`feed` route)            |
| Address-based ballot lookup                         | [Elections route](<../apps/expo/src/app/(tabs)/elections.tsx>)                                                         |
| Original content, explanation, brief, and citations | [Article detail](../apps/expo/src/app/article-detail.tsx)                                                              |
| Candidate race and ballot measure details           | [Contest detail](../apps/expo/src/app/contest-detail.tsx), [measure detail](../apps/expo/src/app/measure-detail.tsx)   |
| Tab registration and visibility                     | [Tab layout](<../apps/expo/src/app/(tabs)/_layout.tsx>) and [custom TabBar](../apps/expo/src/components/ui/TabBar.tsx) |

The Feed tab is a short brief. [DigestHome](../apps/expo/src/components/DigestHome.tsx) shows featured local bills plus the federal cover — at most seven items — under “Today’s local news”. It does not invent a daily ranking, a moved-count, or a read-time. Following a bill, case, or order reuses the device-local saved set; the article page draws a four-stop legislative path from the projected status label and does not invent chamber passage.

Browse, Elections, and Feedback are visible tabs. Settings is available in development and hidden in production. Feed remains a route but is hidden, and its API returns an empty page for older clients. A navigation change must account for both the router's options and the custom tab renderer. Check production behavior when changing `__DEV__` conditions.

The historical notes in `src/new_pages_implementation/` describe earlier page plans. Read the actual route before using one as an implementation reference.

## How mobile reaches the API

The [tRPC client](../apps/expo/src/utils/api.tsx) creates typed query options for TanStack Query. It uses `httpBatchLink`, SuperJSON, and the API base URL from [base-url.ts](../apps/expo/src/utils/base-url.ts). The link forwards the stored auth cookie and adds `x-trpc-source: expo-react`.

URL selection first uses `EXPO_PUBLIC_API_URL`, then the Expo development host on port `3000`. Expo web has a browser-host fallback. Native clients throw when neither an explicit URL nor a development host is available. A configured production URL wins over auto-detection, so set `apps/expo/.env.local` for local API work as described in [Contributing](../CONTRIBUTING.md#run-the-mobile-app).

Mobile imports API types, not the database client. `@acme/db/client` requires Node's PostgreSQL driver and server credentials. Put data access and authorization in the API procedure.

## Styling and shared UI

Use [styles.ts](../apps/expo/src/styles.ts) as the mobile styling entry point. It combines shared theme tokens with native helpers and reusable styles. The [Expo styling guide](expo-styling.md) explains tokens, spacing, and the theme hook.

`packages/ui` contains web components, native helpers, and shared tokens. Radix/shadcn web components require browser APIs; choose native exports or mobile components for Expo. `pnpm ui-add` adds shared web components.

Dependency versions live in the [Expo manifest](../apps/expo/package.json) and [workspace catalog](../pnpm-workspace.yaml). After adding a native dependency, rebuild with `pnpm ios` or `pnpm android`; restarting Metro only reloads JavaScript.

## Web pages and server rendering

The Next.js App Router lives in [apps/nextjs/src/app](../apps/nextjs/src/app). It includes the landing page, legal/support pages, public content previews, waitlist routes, and API endpoints. [Sharing and saves](virality.md) follows the public preview and share-image paths in detail.

[trpc/server.tsx](../apps/nextjs/src/trpc/server.tsx) supplies server-side callers and query hydration. [trpc/react.tsx](../apps/nextjs/src/trpc/react.tsx) supplies the browser client with `httpBatchStreamLink`. Both use the same `appRouter`; server callers can invoke it without an HTTP request.

## Authentication

[packages/auth/src/index.ts](../packages/auth/src/index.ts) configures Better Auth with the Drizzle adapter, optional Discord OAuth, the OAuth proxy, and the native callback bridge. Next.js exposes it through `/api/auth` and passes the resulting session into the tRPC context.

Web requests carry session cookies. The Expo auth client stores its session locally and supplies a `Cookie` header through the tRPC link. For an auth failure, follow the callback, stored cookie, and API context before changing a screen. See [API](api.md#request-path) and [Troubleshooting](troubleshooting.md).
