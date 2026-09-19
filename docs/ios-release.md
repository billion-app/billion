# iOS and OTA releases

A store binary and an over-the-air update have different release paths. Choose the path before changing a version or starting a build.

| Change                                                          | Release path                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| New native dependencies, native configuration, or store version | Push a version tag to trigger the TestFlight build workflow        |
| JavaScript or assets compatible with an installed store build   | Use the production OTA workflow with that build's EAS ID           |
| Device testing of `main`                                        | Use an internal preview build; CI publishes to its preview channel |
| EAS unavailable or build quota exhausted                        | Use a clean local Xcode archive after the same preflight checks    |

Commands below use `pnpm dlx eas-cli@latest` so they do not depend on a globally installed EAS CLI. Run EAS from `apps/expo`, including inside a release worktree.

## Release configuration

[app.config.base.json](../apps/expo/app.config.base.json) holds the marketing version, bundle identifier, scheme, and Expo project metadata. [app.config.js](../apps/expo/app.config.js) adds environment-dependent configuration. [eas.json](../apps/expo/eas.json) holds build profiles, the remote build-number policy, and the App Store Connect app ID. Verify these files and the signed-in EAS project before releasing.

The committed `apps/expo/.env` supplies the canonical production API URL. Local development uses ignored `apps/expo/.env.local`; EAS uses its configured production environment. `EXPO_PUBLIC_API_URL` is embedded when JavaScript is bundled, so a successful prebuild does not prove the final API URL is correct.

## TestFlight through CI

[release-ios.yml](../.github/workflows/release-ios.yml) runs when a `v*` tag is pushed. It checks that the tag matches the marketing version, runs mobile typecheck, lint, and Expo Doctor, then starts a production EAS build with automatic submission.

1. Verify the requested behavior and production configuration. For navigation or other production-only behavior, test a production bundle as well as development.
2. Run the [release preflight](#release-preflight).
3. From the root, use `pnpm bump patch`, `pnpm bump minor`, or `pnpm bump major`. This edits the marketing version, commits, and creates the tag. It does not push. Review staged changes first because the script's commit can include files already staged.
4. Review the release commit and tag, then push the intended branch and `vX.Y.Z` tag. Replace the example version with the one just created.
5. Inspect the workflow for that tag with `gh run list --workflow release-ios.yml --limit 3`. Monitor the existing build; do not start another manual build for the same tag.
6. Follow [build and submission verification](#verify-build-and-submission).

EAS owns the iOS build number remotely and the production profile increments it. The marketing version in source and Apple's build number are separate values.

## Release preflight

Use a clean checkout of the intended release source with its own `pnpm install`. Do not link another checkout's `node_modules`; resolved native paths affect Expo's fingerprint.

From `apps/expo`:

```bash
pnpm typecheck
pnpm lint
pnpm dlx expo-doctor@latest .
EXPO_PUBLIC_API_URL=https://www.billion-news.app \
  pnpm exec expo export --platform ios --output-dir /tmp/billion-expo-export --clear
```

Resolve Expo Doctor failures, including native peer dependencies, SDK mismatches, configuration errors, and duplicate native modules. Run `pnpm exec expo prebuild --platform ios --no-install` when native dependencies, plugins, or app configuration changed. Verify the behavior being released and a live public API request. For auth changes, verify the relevant session flow without exposing credentials.

Compare public mobile configuration with EAS production. Inspect secrets by presence only; do not copy secret values into logs. The canonical API host is `https://www.billion-news.app` unless committed production configuration changes. Redirecting API hosts can affect cookies and POST requests.

## Manual EAS fallback

Use this only after establishing that CI does not already own a build for the release and cannot complete it, for example because its token is unavailable. Record the reason before starting another build.

From the root, replace `X.Y.Z` with the release version:

```bash
git worktree add --detach /tmp/billion-release-X.Y.Z vX.Y.Z
cd /tmp/billion-release-X.Y.Z
pnpm install
cd apps/expo
pnpm dlx eas-cli@latest whoami
pnpm dlx eas-cli@latest project:info
pnpm dlx eas-cli@latest fingerprint:generate --platform ios
pnpm dlx eas-cli@latest build \
  --platform ios --profile production --auto-submit --non-interactive \
  --message "Release X.Y.Z"
```

Confirm the directory contains `app.config.js` and `eas.json` before building. Record the build and submission IDs, and compare the local fingerprint with the build's fingerprint. Keep the worktree until verification finishes.

## Local Xcode fallback

Use a local Xcode archive when EAS reports that the account has exhausted its free iOS builds, credits, or build quota. Do not use quota exhaustion as a reason to skip validation, versioning, signing, or TestFlight submission.

Use the clean release worktree from the previous section. Local archives require Xcode, CocoaPods, and a signed-in Apple Developer account. Check the iOS image in `apps/expo/eas.json` for the toolchain used by CI. Choose an App Store build number greater than every build already uploaded for this marketing version. The EAS remote number is a starting point, but App Store Connect is authoritative:

```bash
cd /tmp/billion-release-X.Y.Z/apps/expo
pnpm dlx eas-cli@latest build:version:get \
  --platform ios \
  --profile production \
  --non-interactive
```

Set explicit shell values; never allow a local development `.env.local` URL into the archive:

```bash
VERSION=X.Y.Z
BUILD_NUMBER=N
PRODUCTION_API_URL=https://www.billion-news.app
```

Generate the native project and install pods:

```bash
EXPO_PUBLIC_API_URL="$PRODUCTION_API_URL" \
  pnpm exec expo prebuild --platform ios --clean
cd ios
pod install
```

Archive from the workspace with explicit marketing/build versions and the Billion Apple team:

```bash
EXPO_PUBLIC_API_URL="$PRODUCTION_API_URL" \
xcodebuild \
  -workspace billion.xcworkspace \
  -scheme billion \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "/tmp/billion-${VERSION}-${BUILD_NUMBER}.xcarchive" \
  DEVELOPMENT_TEAM=QKY5V6T98V \
  CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates \
  archive
```

Always use `billion.xcworkspace`, not `billion.xcodeproj`. Treat an archive warning or signing error as a blocker and inspect the complete Xcode result before uploading.

Open the successful archive in Xcode:

```bash
open "/tmp/billion-${VERSION}-${BUILD_NUMBER}.xcarchive"
```

In Organizer, choose **Distribute App → App Store Connect → Upload**. Use the configured QIONG CHEN team and allow Xcode to validate the archive before the final upload. Complete any Apple login, two-factor, or agreement prompts before confirming the upload.

After Apple accepts the local upload, synchronize EAS's remote iOS build number so a later `autoIncrement` build does not reuse it:

```bash
cd /tmp/billion-release-X.Y.Z/apps/expo
pnpm dlx eas-cli@latest build:version:set \
  --platform ios \
  --profile production
```

Enter the exact locally uploaded `BUILD_NUMBER`. Then monitor App Store Connect processing and record the local archive path in the release notes.

## Verify build and submission

From `apps/expo`, inspect the recorded build:

```bash
pnpm dlx eas-cli@latest build:view BUILD_ID --json
```

An EAS build reaching `FINISHED` is only the first milestone. Verify submission completion from its output or submission page, then inspect App Store Connect for Apple processing and tester availability. An accepted upload may still be processing. Report the exact state you observed.

For a recoverable failure, inspect the build or submission logs, correct the cause, rerun the relevant preflight, and use a new build number when required. An Apple login, two-factor prompt, or agreement may require the account holder.

Record the release commit and tag, version/build number, build and submission links, production API URL, and requested behavior checks. Remove the temporary worktree after monitoring completes.

## Production OTA updates

Merges to `main` publish to the preview channel after CI. To install an internal preview binary, run from `apps/expo`:

```bash
pnpm dlx eas-cli@latest build --platform ios --profile preview
```

Use `preview-simulator` for the iOS Simulator.

Production updates use [Release OTA (Production)](../.github/workflows/release-ota.yml) in GitHub Actions. Choose the branch containing the JavaScript update from GitHub's **Use workflow from** menu and run the workflow without inputs.

The workflow uses that branch's exact commit and creates the update message from its commit subject. It generates the production iOS fingerprint, selects the newest finished production store build with the same fingerprint, and validates that build's app identity and runtime before publishing. If no compatible build exists, the workflow stops and the change needs a new TestFlight build.

The workflow runs checks and compares the source's native fingerprint and app identity with that store build. If they match, it publishes to production. If native code changed on `main`, create a release branch from the installed build's source and backport only the compatible fix, or ship a new store binary. Keep the fingerprint runtime policy and compatibility check intact. The in-app restart prompt appears only after that update has downloaded and differs from the running bundle; see [Frontend](frontend.md).

Agent-operated releases use the [TestFlight release skill](../.codex/skills/release-billion-testflight/SKILL.md), which adds completion criteria and directs agents through these same paths.
