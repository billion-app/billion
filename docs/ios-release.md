# Building for iOS Locally (Without EAS)

You can build and archive the app entirely on your Mac using Xcode — no EAS build minutes needed.

## Prerequisites

- Xcode 16+ installed
- Apple Developer account with a valid distribution certificate and provisioning profile
- CocoaPods: `sudo gem install cocoapods`

## Environment Variables

`EXPO_PUBLIC_API_URL` is baked into the JS bundle at build time by the Xcode "Bundle React Native code and images" build phase. It is **not** set during prebuild.

A default `.env` pointing to production is already committed at `apps/expo/.env`:

```bash
# apps/expo/.env (committed — do not change for local dev)
EXPO_PUBLIC_API_URL=https://www.billion-news.app
```

For local dev, create `apps/expo/.env.local` (gitignored) and override there:

```bash
# apps/expo/.env.local
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

For EAS builds, set this in your EAS environment variables dashboard or via:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://www.billion-news.app
```

## Releasing a new build

From the **monorepo root** (requires `just` — `brew install just`):

```bash
# Full release: bump patch version + prebuild iOS
just release

# Choose bump type and/or platform
just release minor
just release patch android
just release major ios

# Or run steps separately:
just bump patch        # bump version, commit, tag
just build ios         # expo prebuild --clean + patch Xcode version
just build android
```

`just bump` updates `apps/expo/app.config.json`, commits with `chore: bump version to X.Y.Z`, and creates a git tag `vX.Y.Z`.

`just build` runs `expo prebuild --clean` and (for iOS) patches `MARKETING_VERSION` in the Xcode project so Xcode's UI shows the correct version.

After building, open Xcode to archive and distribute:

```bash
open apps/expo/ios/billion.xcworkspace
```

Then follow **Product → Archive → Distribute App** as described below.

### 1. Install pods (if prebuild ran without release script)

```bash
cd ios && pod install && cd ..
```

### 2. Open in Xcode

```bash
open ios/billion.xcworkspace
```

### 3. Configure signing

In Xcode → select the `billion` target → **Signing & Capabilities**:

- Check **Automatically manage signing**
- Select the **QIONG CHEN** team (or your own if building for personal distribution)

Alternatively, pass the team ID on the command line (avoids touching Xcode):

```bash
xcodebuild -workspace ios/billion.xcworkspace -scheme billion \
  -configuration Release -destination generic/platform=iOS \
  archive -archivePath /tmp/billion.xcarchive \
  DEVELOPMENT_TEAM=QKY5V6T98V CODE_SIGN_STYLE=Automatic
```

### 4. Archive

**Product → Archive** — this produces a `.xcarchive` in Xcode's Organizer.

### 5. Distribute

In the Organizer, click **Distribute App** → **App Store Connect** → follow the wizard. This uploads to App Store Connect where it appears in TestFlight.

## When to use EAS vs local

| Situation                      | Use                                                   |
| ------------------------------ | ----------------------------------------------------- |
| Quick TestFlight build         | EAS (`eas build --platform ios --profile production`) |
| Debugging a native build error | Local Xcode                                           |
| No EAS build minutes left      | Local Xcode                                           |
| CI/CD                          | EAS                                                   |

> Always open `ios/billion.xcworkspace`, never `ios/billion.xcodeproj` — the `.xcodeproj` alone won't include CocoaPods dependencies and the build will fail to link. More build issues: [Troubleshooting](./troubleshooting.md).
