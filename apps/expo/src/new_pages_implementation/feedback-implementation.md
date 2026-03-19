# Send Feedback Page Implementation

## Current Status

The Send Feedback page exists at `apps/expo/src/app/settings/feedback.tsx` with category selection, text input, and simulated submission with thank you screen.

## Backend Dependencies

- **Submission endpoint**: Needs real endpoint (tRPC or form service like Typeform/Linear).
- **Device metadata**: Should attach OS version, app version, user ID automatically.
- **Screenshot attachment**: Optional feature.
- **Rate limiting**: Prevent duplicate submissions.
- **Bug reports**: Optionally attach recent error logs.

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Email fallback**:
   - Use `Linking.openURL` with `mailto:` to send feedback via email.
   - Pre-fill subject with category and app version, body with user's text.

2. **Local storage for draft**:
   - Save feedback text and category locally as draft in case app closes.
   - Use `AsyncStorage` key `@billion/feedback_draft`.

3. **Device metadata**:
   - Use `expo-constants` for app version, `Platform.OS` for OS.
   - Append to email body or store locally.

4. **Rate limiting**:
   - Store timestamp of last submission in `AsyncStorage`.
   - Prevent another submission within, e.g., 5 minutes.

5. **Screenshot attachment**:
   - Use `expo-capture` or `react-native-view-shot` to capture screen.
   - Attach as base64 to email (may be large) or save locally.

### Local Storage Alternative:

- Store pending feedback submissions in local queue.
- Attempt to send via email; if fails, keep in queue for later retry.
- For offline users, store and sync when online.

### Migration Path to Backend:

- Implement tRPC endpoint `user.feedback.submit`.
- Forward feedback to issue tracker (Linear, Jira) or support desk.
- Add server-side rate limiting and spam detection.

## Priority: 🟠 Low (Can use email initially)

**Can ship with**: Email fallback, local draft, device metadata.
**Blockers**: None for email implementation.
