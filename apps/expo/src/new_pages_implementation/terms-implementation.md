# Terms & Privacy Page Implementation

## Current Status

The Terms & Privacy page exists at `apps/expo/src/app/settings/terms.tsx` with placeholder legal text and TODOs.

## Backend Dependencies

- **Terms text**: Currently hardcoded placeholder. Could be fetched from CMS for updates without app release.
- **Last updated date**: Hardcoded. Should be fetched from terms document.
- **Acceptance tracking**: Need to record user acceptance with version timestamp in user preferences (`trpc.user.acceptTerms`).
- **Privacy Policy URL**: Use `https://billion-news.app/privacy`.

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Update legal copy**:
   - Replace placeholder sections with actual terms of service and privacy policy text.
   - Can use static markdown or HTML content embedded in the app.

2. **Update last updated date**:
   - Hardcode a realistic date (e.g., release date) or use current date via `new Date().toLocaleDateString()`.

3. **Update Privacy Policy URL**:
   - Use the official URL `https://billion-news.app/privacy`.

4. **Local acceptance tracking**:
   - Use `AsyncStorage` to store acceptance status and version.
   - Add a checkbox "I agree to Terms & Privacy" and store `termsAccepted: true` and `acceptedVersion: "1.0.0"`.

### Local Storage Alternative:

- Store terms acceptance locally using `AsyncStorage` or `expo-secure-store`.
- Store accepted version string to detect when terms have changed.

### Migration Path to Backend:

- Later, sync acceptance to backend via `trpc.user.acceptTerms` mutation.
- Fetch terms content from CMS endpoint (e.g., tRPC `content.terms.get`).
- Last updated date can come from CMS metadata.

## Priority: 🟢 High (Legal requirement for app stores)

**Can ship with**: Updated static legal text and local acceptance tracking.
**Blockers**: Need final legal copy from legal team.
