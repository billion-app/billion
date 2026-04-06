# About Page Implementation

## Current Status

The About page exists at `apps/expo/src/app/settings/about.tsx` with placeholder data and TODOs.

## Backend Dependencies

- **Version info**: Requires `expo-constants` for real version number
- **Build channel**: Requires `expo-updates` for build channel
- **Platform**: Requires `Platform.OS` from React Native
- **Legal URLs**: Need real URLs (billion-news.app/privacy, etc.)

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Replace version hardcoding**:

```typescript
import Constants from "expo-constants";

// Use: Constants.expoConfig?.version ?? "1.0.0"
```

2. **Replace platform hardcoding**:

```typescript
import { Platform } from "react-native";

// Use: Platform.OS
```

3. **Replace build channel**:

```typescript
import * as Updates from "expo-updates";

// Use: Updates.channel ?? 'release'
```

4. **Update legal URLs** (still requires real URLs but no backend):

- Update `LINKS` array with correct production URLs

### Local Storage Alternative:

- None needed - this is purely display information

### Migration Path to Backend:

- Version/build info stays client-side
- Legal text could move to CMS for updates without app release

## Priority: 🟢 High (Legal requirement for app stores)

**Can ship with**: Updated version/build info using expo packages
**Blockers**: Need real legal URLs before production
