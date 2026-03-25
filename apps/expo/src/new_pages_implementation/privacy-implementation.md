# Privacy Settings Page Implementation

## Current Status

The Privacy Settings page exists at `apps/expo/src/app/settings/privacy.tsx` with toggle switches for analytics, personalization, location, crash reports, and a "Download My Data" button.

## Backend Dependencies

- **Toggle states**: Load from tRPC (`trpc.user.preferences.get`).
- **Persist toggles**: Save via tRPC mutation (`trpc.user.preferences.setPrivacy`).
- **Download My Data**: Trigger GDPR/CCPA export request via tRPC.
- **Location toggle**: Should request device location permission when enabled.
- **Analytics toggle**: Integrate with analytics SDK opt-in/out (Amplitude, PostHog).

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Local storage for toggle states**:
   - Use `AsyncStorage` to store each toggle's state.
   - Load initial values from storage, default to `true` for personalization, location, crash; `false` for analytics.

2. **Persist toggle changes locally**:
   - When user flips a switch, save new state to `AsyncStorage`.
   - Update local state for immediate UI feedback.

3. **Location permission integration**:
   - Use `expo-location` to request permissions when location toggle enabled.
   - If denied, revert toggle and show alert.

4. **Analytics SDK integration**:
   - If using Amplitude/PostHog, call their opt-out methods based on toggle.
   - Store opt-out preference locally.

5. **Download My Data action**:
   - For now, open email client with pre-filled subject/body requesting data export.
   - Or show message that feature coming soon.

### Local Storage Alternative:

- Store toggle states under key `@billion/privacy_settings` as JSON object.
- Use `expo-secure-store` for sensitive preferences.

### Migration Path to Backend:

- Sync privacy preferences to backend user preferences table.
- Implement server-side data export endpoint.
- Centralize analytics opt-out handling on backend.

## Priority: 🟡 Medium (User trust)

**Can ship with**: Local storage for preferences, location permission integration.
**Blockers**: Need analytics SDK setup for opt-out.
