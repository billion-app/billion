# Billion

Welcome to the codebase. See below for development set-up instructions. See [Manifesto](./BRANDING.md) for what Billion even is.

## Quick Start

> These instructions were originally copy-pasted from https://github.com/t3-oss/create-t3-turbo (which this project is scaffolded from). I've modified it to get rid of the bs that we don't use. For example, I've commented out all of the original auth instructions cuz we're not using that for now.

> Anything in blockquotes without admonitions (like this one you're reading) is additional commentary I added

### If already set up

```
pnpm run dev
```

> And go to the `@acme/ios` tab in that TUI and follow Expo's instructions (press `i`, typically)

### Otherwise...

> Make sure you have:
> - pnpm
> - Xcode CLI stuff whatever (run `xcode-select --install`)
> - Xcode installed with the iOS simulator installed (go to App Store)
> - Postgres installed globally (unless you want to figure out how to run this project in a Docker container?). It's easy with https://postgresapp.com/ on macOS
> 
> (instructions copied from https://github.com/t3-oss/create-t3-turbo)

<!--

> **Note**
> The [db](./packages/db) package is preconfigured to use Supabase and is **edge-bound** with the [Vercel Postgres](https://github.com/vercel/storage/tree/main/packages/postgres) driver. If you're using something else, make the necessary modifications to the [schema](./packages/db/src/schema.ts) as well as the [client](./packages/db/src/index.ts) and the [drizzle config](./packages/db/drizzle.config.ts). If you want to switch to non-edge database driver, remove `export const runtime = "edge";` [from all pages and api routes](https://github.com/t3-oss/create-t3-turbo/issues/634#issuecomment-1730240214).

-->

To get it running, follow the steps below:

### 1. Setup dependencies

```bash
git clone https://github.com/ThatXliner/billion.git
cd billion
# Install dependencies
pnpm i

# Configure environment variables
# There is an `.env.example` in the root directory you can use for reference
cp .env.example .env

# Push the Drizzle schema to the database
pnpm db:push
```

<!--

### 2. Generate Better Auth Schema

This project uses [Better Auth](https://www.better-auth.com) for authentication. The auth schema needs to be generated using the Better Auth CLI before you can use the authentication features.

```bash
# Generate the Better Auth schema
pnpm --filter @acme/auth generate
```

This command runs the Better Auth CLI with the following configuration:

- **Config file**: `packages/auth/script/auth-cli.ts` - A CLI-only configuration file (isolated from src to prevent imports)
- **Output**: `packages/db/src/auth-schema.ts` - Generated Drizzle schema for authentication tables

The generation process:

1. Reads the Better Auth configuration from `packages/auth/script/auth-cli.ts`
2. Generates the appropriate database schema based on your auth setup
3. Outputs a Drizzle-compatible schema file to the `@acme/db` package

> **Note**: The `auth-cli.ts` file is placed in the `script/` directory (instead of `src/`) to prevent accidental imports from other parts of the codebase. This file is exclusively for CLI schema generation and should **not** be used directly in your application. For runtime authentication, use the configuration from `packages/auth/src/index.ts`.

For more information about the Better Auth CLI, see the [official documentation](https://www.better-auth.com/docs/concepts/cli#generate).

-->

### 2. Configure Expo `dev`-script

> Idk why these instructions tell you to change the `dev` script (in `apps/expo`) but if that's what helps, sure. Remember to change it back to `"dev": "expo start",`

#### Use iOS Simulator

1. Make sure you have XCode and XCommand Line Tools installed [as shown on expo docs](https://docs.expo.dev/workflow/ios-simulator).

> [!NOTE]
> If you just installed XCode, or if you have updated it, you need to open the simulator manually once. Run `npx expo start` from `apps/expo`, and then enter `I` to launch Expo Go. After the manual launch, you can run `pnpm dev` in the root directory.

   ```diff
   +  "dev": "expo start --ios",
   ```

2. Run `pnpm dev` at the project root folder.

#### Use Android Emulator

> (who is doing this anyway...)

1. Install Android Studio tools [as shown on expo docs](https://docs.expo.dev/workflow/android-studio-emulator).

2. Change the `dev` script at `apps/expo/package.json` to open the Android emulator.

   ```diff
   +  "dev": "expo start --android",
   ```

3. Run `pnpm dev` at the project root folder.

<!--### 4. Configuring Better-Auth to work with Expo

In order to get Better-Auth to work with Expo, you must either:

#### Deploy the Auth Proxy (RECOMMENDED)

Better-auth comes with an [auth proxy plugin](https://www.better-auth.com/docs/plugins/oauth-proxy). By deploying the Next.js app, you can get OAuth working in preview deployments and development for Expo apps.

By using the proxy plugin, the Next.js apps will forward any auth requests to the proxy server, which will handle the OAuth flow and then redirect back to the Next.js app. This makes it easy to get OAuth working since you'll have a stable URL that is publicly accessible and doesn't change for every deployment and doesn't rely on what port the app is running on. So if port 3000 is taken and your Next.js app starts at port 3001 instead, your auth should still work without having to reconfigure the OAuth provider.

#### Add your local IP to your OAuth provider

You can alternatively add your local IP (e.g. `192.168.x.y:$PORT`) to your OAuth provider. This may not be as reliable as your local IP may change when you change networks. Some OAuth providers may also only support a single callback URL for each app making this approach unviable for some providers (e.g. GitHub).-->

### Congratulations

> Congrats it's set up. See [CONTRIBUTING](./CONTRIBUTING.md) if you need to add a new UI component or a new package in the `packages/` folder.

---

Now, everything below is NOT copy+pasted from the original template README. Good job reading this far. Send me a text if you did.


### Troubleshooting

- If there's any issues with dependencies, just add to the project root.

```
# .npmrc
node-linker=hoisted
```

- Make sure Next.js is running. Maybe `cp .env.example .env` and update the values (if needed)?

#### "CommandError: No development build (dev.thatxliner.billion) for this project is installed. Please make and install a development build on the device first. Learn more: https://docs.expo.dev/development/build/"
  
In this case, `pnpm clean && pnpm install && cd apps/expo && pnpm ios` before you go back to root and run `pnpm dev`. Maybe open the Xcode project and build from there?

## FAQ & Deployment

Just see the original [here](https://github.com/t3-oss/create-t3-turbo#faq) (permalink [here](https://github.com/t3-oss/create-t3-turbo/tree/cf9aefdf46036df0b9a3bec4f08d0f4f2fe54e83?tab=readme-ov-file#faq)).
