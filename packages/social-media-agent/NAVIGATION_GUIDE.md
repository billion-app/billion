# Billion Codebase Navigation Guide

This guide helps you navigate the Billion codebase, focusing on the mobile app's screens and functionality. Billion is a T3 Turbo monorepo with Expo (React Native) and Next.js apps.

## Project Structure

```
billion/
├── apps/
│   ├── expo/                 # Mobile app (React Native with Expo)
│   └── nextjs/               # Web app (Next.js)
├── packages/                 # Shared packages
│   ├── api/                  # tRPC API routers
│   ├── auth/                 # Authentication (Better Auth)
│   ├── db/                   # Database schema and client
│   ├── ui/                   # Reusable UI components
│   └── validators/           # Validation utilities
└── social-media-agent/       # This directory (agent-specific docs)
```

## Mobile App Screens (`apps/expo/src/app/`)

All mobile app screens are located in `apps/expo/src/app/`. The app uses Expo Router for file‑based navigation.

### Tab Navigation (`(tabs)/`)

The main tab navigation is defined in `(tabs)/_layout.tsx`. Three tabs are available:

| Tab Screen | File | Purpose |
|------------|------|---------|
| **Browse** | `(tabs)/index.tsx` | Main discovery screen |
| **Feed** | `(tabs)/feed.tsx` | Personalized content feed |
| **Settings** | `(tabs)/settings.tsx` | Entry point to settings stack |

### Settings Stack (`settings/`)

Settings screens are organized in a stack navigator (`settings/_layout.tsx`). Each screen is a separate file:

- `settings/about.tsx` – App version and legal info
- `settings/blocked‑content.tsx` – Content blocking preferences
- `settings/content‑interests.tsx` – Topic preferences
- `settings/edit‑profile.tsx` – User profile editing
- `settings/feedback.tsx` – Submit feedback
- `settings/help.tsx` – Help & support
- `settings/privacy.tsx` – Privacy policy
- `settings/saved‑articles.tsx` – Saved articles list
- `settings/terms.tsx` – Terms of service

### Other Screens

- `article‑detail.tsx` – Detailed article view
- `modal.tsx` – Generic modal screen
- `+not‑found.tsx` – 404‑style fallback

## Web App (`apps/nextjs/`)

The Next.js web app shares the same API and database but has its own UI layer:

- `src/app/` – Next.js 15 app router pages
- `src/app/_components/` – Web‑specific components (e.g., `auth‑showcase.tsx`, `posts.tsx`)
- `src/trpc/` – tRPC utilities for React and server components

## Shared Functionality (`packages/`)

### API (`packages/api/`)

tRPC routers define the backend API:

- `src/root.ts` – Aggregates all routers
- `src/router/auth.ts` – Authentication endpoints
- `src/router/content.ts` – Content‑related endpoints
- `src/router/post.ts` – Post‑related endpoints
- `src/router/video.ts` – Video‑related endpoints

The API is consumed in the Expo app via `apps/expo/src/utils/api.tsx`, which provides a type‑safe `trpc` client.

### Database (`packages/db/`)

- `src/schema.ts` – Drizzle schema for main tables
- `src/auth‑schema.ts` – Generated authentication schema (from Better Auth)
- `src/client.ts` – Database client
- `src/index.ts` – Exports for use throughout the monorepo

### Authentication (`packages/auth/`)

Better Auth configuration:

- `src/index.ts` – Runtime auth configuration
- `script/auth‑cli.ts` – CLI‑only config for schema generation

### UI Components (`packages/ui/`)

Reusable React components and design tokens:

- `src/button.tsx`, `src/button‑native.tsx` – Buttons
- `src/card‑native.tsx` – Card component
- `src/theme‑tokens.ts` – Design tokens (colors, spacing, typography)
- `src/theme.tsx` – Theme provider

### Validators (`packages/validators/`)

Zod validation schemas exported from `src/index.ts`.

## Key Files for Styling and Configuration

### Styles (`apps/expo/src/styles.ts`)

**Single source of truth** for all styling in the mobile app. Exports:

- `colors`, `darkTheme`, `lightTheme` – Design tokens
- `fontDisplay`, `fontEditorial`, `fontBody` – Brand font families
- `layout`, `typography`, `cards`, `headers`, `inputs`, `buttons`, `badges`, `settings`, `actions` – StyleSheet objects
- `useTheme()` hook for theme‑aware components

### API Client (`apps/expo/src/utils/api.tsx`)

Creates the tRPC client with authentication headers and query client.

### App Layout (`apps/expo/src/app/_layout.tsx`)

Root layout that loads fonts, sets up error boundaries, and provides theme and authentication providers.

### Components (`apps/expo/src/components/`)

Reusable components used throughout the mobile app:

- `AIDisclaimerBanner.tsx` – Banner for AI‑generated content notices
- `EditScreenInfo.tsx` – Development helper showing screen info
- `ExternalLink.tsx` – Wrapper for external links
- `StyledText.tsx` – Themed text component
- `Themed.tsx` – Theme‑aware view and text components

### Utilities (`apps/expo/src/utils/`)

- `api.tsx` – tRPC client (see above)
- `auth.ts` – Authentication client (Better Auth)
- `base‑url.ts` – Helper to determine the API base URL
- `styles.css` – Web‑specific styles (imported in `_layout.tsx` for web platform)

## Running the App

See the root `README.md` for full setup instructions. Quick commands:

```bash
# Install dependencies
pnpm i

# Copy environment variables
cp .env.example .env

# Push database schema
pnpm db:push

# Start all apps (Expo + Next.js) in Turbo TUI
pnpm dev
```

Navigate to the `@acme/expo` tab in the TUI and press `i` for iOS simulator or `a` for Android emulator.

## Common Development Tasks

### Adding a New Screen

1. Create a new `.tsx` file in `apps/expo/src/app/` (or a subdirectory).
2. Export a default React component.
3. Add a route in the appropriate `_layout.tsx` if needed (tabs or stack).

### Adding a New API Endpoint

1. Add a new procedure in the relevant router under `packages/api/src/router/`.
2. The endpoint will be automatically available via the `trpc` client in the Expo app.

### Modifying Styles

Always use tokens and helpers from `apps/expo/src/styles.ts`. Do not hard‑code colors, spacing, or font families.

### Updating the Database Schema

Edit `packages/db/src/schema.ts`, then run `pnpm db:push` to update the database.

---

*This guide is maintained in the `social‑media‑agent` directory. Last updated March 19, 2026.*