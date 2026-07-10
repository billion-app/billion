---
name: release-billion-testflight
description: Create, validate, build, submit, and monitor iOS TestFlight releases for the Billion Expo app. Use when asked to make a new Billion iOS build, bump the mobile version, upload an EAS build, submit a build to App Store Connect or TestFlight, replace a faulty TestFlight build, or verify the status of a Billion release.
---

# Release Billion to TestFlight

Ship a reproducible Billion iOS release through EAS and App Store Connect. Continue through build and submission completion unless an Apple account gate requires user action.

## Release principles

- Preserve unrelated working-tree changes. Stage and commit only release files.
- Treat the requested release behavior as acceptance criteria. Add targeted verification when the change involves navigation, environment-gated UI, authentication, or another runtime-sensitive feature; do not impose unrelated UI checks on every release.
- Build from an exact commit or tag in a clean worktree.
- Run EAS from `apps/expo`, never from the monorepo root. Confirm the working directory before every build or submit command.
- Do not confuse these states: EAS build finished, Apple upload accepted, Apple processing finished, testers can install.
- Do not print secrets. Public Expo variables such as `EXPO_PUBLIC_API_URL` may be shown.

## 1. Inspect the release state

From the repository root, inspect:

```bash
git status --short --branch
git log -10 --oneline --decorate
git tag --sort=-version:refname | head
sed -n '1,220p' apps/expo/app.config.json
sed -n '1,220p' apps/expo/eas.json
```

Read `docs/ios-release.md` when present. Verify rather than assume these current identifiers:

- Expo project: `@thatxliner/billion`
- Bundle identifier: `app.billion-news.billion`
- App Store Connect app ID: `6761675243`
- EAS project ID: `c38bc8f8-f82c-4a45-b819-d62bd366ac8b`

Confirm the EAS identity and remote build number:

```bash
pnpm dlx eas-cli@latest whoami
pnpm dlx eas-cli@latest project:info
pnpm dlx eas-cli@latest build:version:get --platform ios --profile production --non-interactive
```

## 2. Define acceptance criteria

Extract the user-requested changes and verify each one before releasing. Examples:

- For an environment change, verify the production variable and live endpoint.
- For a production-only tab or feature flag, inspect both the router and any custom navigation renderer, then validate a production bundle where `__DEV__` is false.
- For authentication or API changes, exercise the relevant production endpoint without exposing credentials.

Do not claim a behavior is fixed solely because a framework option appears correct in source. Check custom components and runtime-specific branches that can override it.

## 3. Verify the production environment

Compare the committed mobile environment with EAS production:

```bash
sed -n '1,40p' apps/expo/.env
cd apps/expo
pnpm dlx eas-cli@latest env:list --environment production
```

The production API should use the canonical URL `https://www.billion-news.app` unless the repository explicitly changes it. Avoid shipping a redirecting hostname when cookies, authentication, or POST requests may be involved.

If the EAS variable is wrong, update it before building and confirm the result:

```bash
pnpm dlx eas-cli@latest env:update production \
  --variable-name EXPO_PUBLIC_API_URL \
  --value https://www.billion-news.app \
  --non-interactive
```

Verify the live site and at least one public app API request.

## 4. Run preflight checks

Run the standard mobile checks:

```bash
cd apps/expo
pnpm typecheck
pnpm lint
pnpm dlx expo-doctor@latest .
EXPO_PUBLIC_API_URL=https://www.billion-news.app \
  pnpm exec expo export --platform ios --output-dir /tmp/billion-expo-export --clear
```

Require Expo Doctor to pass all checks. Treat missing direct native peer dependencies, SDK version mismatches, config schema errors, and duplicate native modules as release blockers.

Run `expo prebuild --platform ios --no-install` when native dependencies, Expo plugins, or app configuration changed. Remove only generated ignored output that this task created.

Run targeted checks for the current acceptance criteria. Keep them proportional to the change; a normal content-only release does not require an unrelated UI audit.

## 5. Version and record the release

Increment `version` in `apps/expo/app.config.json` using semver. EAS owns the iOS build number remotely and the production profile should use `autoIncrement: true`.

Review the full diff before committing. Commit only intended release files, create the matching tag, and push both:

```bash
git add <intended-files>
git commit -m "chore: release X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

Use a fix-oriented commit message when the release is primarily a correction. Never stage unrelated user work.

## 6. Build from a clean release worktree

Create a detached worktree from the exact release tag or commit. This prevents unrelated local changes from entering the EAS archive.

```bash
git worktree add --detach /tmp/billion-release-X.Y.Z vX.Y.Z
```

If EAS needs local dependencies to resolve Expo config plugins, link the existing ignored `node_modules` directories into the temporary worktree. Do not commit them.

Before invoking EAS, confirm all three:

```bash
pwd
test -f app.config.json
test -f eas.json
```

The directory must end in `/apps/expo`. Running EAS from the repository root can generate unintended root `app.json` and `eas.json` files.

Start the production build and schedule submission:

```bash
cd /tmp/billion-release-X.Y.Z/apps/expo
pnpm dlx eas-cli@latest build \
  --platform ios \
  --profile production \
  --auto-submit \
  --non-interactive \
  --message "Release X.Y.Z"
```

The production submit profile must contain the verified `ios.ascAppId`. Capture the EAS build and submission IDs immediately.

### Manual Xcode fallback for EAS quota exhaustion

Use a local Xcode archive when EAS reports that the account has exhausted its free iOS builds, credits, or build quota. Do not use quota exhaustion as a reason to skip validation, versioning, signing, or TestFlight submission.

Continue in the clean release worktree. Choose an App Store build number greater than every build already uploaded for this marketing version. The EAS remote number is a starting point, but App Store Connect is authoritative:

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

In Organizer, choose **Distribute App → App Store Connect → Upload**. Use the configured QIONG CHEN team and allow Xcode to validate the archive before the final upload. This is an authorized release action, but an interactive Apple login, two-factor prompt, agreement, or final Organizer confirmation may require the user.

After Apple accepts the local upload, synchronize EAS's remote iOS build number so a later `autoIncrement` build does not reuse it:

```bash
cd /tmp/billion-release-X.Y.Z/apps/expo
pnpm dlx eas-cli@latest build:version:set \
  --platform ios \
  --profile production
```

Enter the exact locally uploaded `BUILD_NUMBER`. Then monitor App Store Connect processing and record the local archive path in the handoff. Never attempt to download or reconstruct an App Store Connect private key stored only on EAS servers.

## 7. Monitor build and submission

Poll the build until it reaches `FINISHED`:

```bash
pnpm dlx eas-cli@latest build:view BUILD_ID --json
```

On failure, inspect the current EAS/Xcode logs, fix the root cause, rerun preflight, create a new build number, and continue. Do not stop at the first recoverable build or submission error.

Verify submission completion using the EAS submit command output or submission URL. A successful transport log should state that the package was uploaded to App Store Connect and the submission finished without an error.

Apple may keep the build in `Processing` after EAS submission succeeds. Verify App Store Connect directly when a signed-in session is available. Otherwise state precisely that Apple accepted the upload and that processing is pending; do not claim tester availability without evidence.

## 8. Final audit and handoff

Confirm:

- Marketing version and remote build number
- EAS build status `FINISHED`
- EAS submission status `FINISHED` with no error
- Canonical production environment value
- Release commit and tag pushed
- Requested release-specific behavior verified
- Unrelated working-tree changes preserved

Remove the temporary worktree after monitoring is complete. Report the final version/build and provide direct EAS build, EAS submission, and App Store Connect TestFlight links.
