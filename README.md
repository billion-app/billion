# Billion

Welcome to the codebase. See below for development set-up instructions. See [Manifesto](./BRANDING.md) for what Billion even is, [CONTRIBUTING.md](./CONTRIBUTING.md) for how to start working on it, and [docs/](./docs/README.md) for how the system works.

## Quick Start

Run the contributor onboarding assistant from the repository root:

```bash
git clone https://github.com/billion-app/billion.git
cd billion
pnpm onboard
```

It installs dependencies, prepares `.env`, finds or starts Postgres, applies
the schema, and optionally prepares the Expo native projects. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the exact steps and non-interactive
flags.


### If already set up...

#### Running the Expo app (`apps/expo`)

This sets up Expo and Next.js (Next.js is necessary to run the Expo app)

```
pnpm run dev
```

And go to the `@acme/ios` tab in that TUI and follow Expo's instructions (press `i`, typically)

#### Running the website (`apps/nextjs`)

```bash
pnpm dev:next
```

Opens at `http://localhost:3000`. This runs Next.js + all dependency packages (api, auth, db, ui, validators) via Turborepo.

#### Running the scrapers (`apps/scraper`)

```bash
cd apps/scrapers && pnpm dev
```

Make sure you have the relevant environment variables set up

---

If anything goes wrong, continue reading to see the old, manual set up instructions:


**Requirements:**

- Node >=22.20.0 (22.15.0 works with a warning)
- pnpm installed
- A Postgres instance selected or started by `pnpm onboard`

### Mobile app (`apps/expo`)

> Make sure you have:
>
> - Xcode CLI stuff (`xcode-select --install`)
> - Xcode installed with iOS simulator (App Store)
> - A database selected by `pnpm onboard` (system Postgres or Docker fallback).

### 1. Setup (same steps as website above)

### 2. Configure Expo `dev`-script

> Remember to change it back to `"dev": "expo start",` when done.

#### iOS Simulator

1. Make sure you have XCode and XCommand Line Tools installed [as shown on expo docs](https://docs.expo.dev/workflow/ios-simulator).

> [!NOTE]
> If you just installed XCode, or updated it, open the simulator manually once. Run `npx expo start` from `apps/expo`, then enter `I` to launch Expo Go. After that, `pnpm dev` from root works.

```diff
+  "dev": "expo start --ios",
```

2. Run `pnpm dev` at the project root folder.

#### Android Emulator

1. Install Android Studio tools [as shown on expo docs](https://docs.expo.dev/workflow/android-studio-emulator).

2. Change the `dev` script at `apps/expo/package.json`:

   ```diff
   +  "dev": "expo start --android",
   ```

3. Run `pnpm dev` at the project root folder.

### If already set up

```bash
# Website only
pnpm dev:next

# Everything (broken on Windows — use dev:next instead)
pnpm dev
```

### Congratulations

> See [CONTRIBUTING](./CONTRIBUTING.md) if you need to add a new UI component or a new package in `packages/`.

---

Now, everything below is NOT copy+pasted from the original template README. Good job reading this far. Send me a text if you did.

### Troubleshooting

**Website:**

- **`pnpm dev` fails with "No package found with name ''!@acme/scraper''"** — Use `pnpm dev:next` instead. The single quotes around the filter get mangled on Windows.
- **`Cannot find module '@tailwindcss/postcss'`** — Make sure `@tailwindcss/postcss` is in `apps/nextjs/package.json` devDependencies (pnpm strict isolation requires it as a direct dependency).
- **DB connection errors** — Verify `POSTGRES_URL` in root `.env` is set correctly and the database is running. Run `pnpm db:migrate` to apply the schema (see [docs/data-layer.md](docs/data-layer.md#migrations)).
- **Dependency issues** — add this to root `.npmrc`:
  ```
  node-linker=hoisted
  ```

**Expo:**

#### "CommandError: No development build (dev.thatxliner.billion) for this project is installed. Please make and install a development build on the device first. Learn more: https://docs.expo.dev/development/build/"

In this case, `pnpm clean && pnpm install && cd apps/expo && pnpm ios` before you go back to root and run `pnpm dev`. Maybe open the Xcode project and build from there?

#### Xcode build errors??

Always open `ios/billion.xcworkspace`, never `ios/billion.xcodeproj`. If that doesn't help, re-create the ios directory with `pnpm expo prebuild --platform ios --clean` from `apps/expo/`.

See [docs/troubleshooting.md](./docs/troubleshooting.md) for common `pnpm run ios` crash errors and their fixes.

## FAQ & Deployment

Just see the original [here](https://github.com/t3-oss/create-t3-turbo#faq) (permalink [here](https://github.com/t3-oss/create-t3-turbo/tree/cf9aefdf46036df0b9a3bec4f08d0f4f2fe54e83?tab=readme-ov-file#faq)).
