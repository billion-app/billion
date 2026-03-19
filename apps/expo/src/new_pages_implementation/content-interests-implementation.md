# Content Interests Page Implementation

## Current Status

The Content Interests page exists at `apps/expo/src/app/settings/content-interests.tsx` with hardcoded topic taxonomy, local selection state, search filtering, and a save button.

## Backend Dependencies

- **Topic taxonomy**: Fetch from tRPC (`trpc.topics.list`).
- **Selected topics**: Load from user preferences via tRPC (`trpc.user.preferences.get`).
- **Persist selection**: Save via tRPC mutation (`trpc.user.preferences.setTopics`).
- **Grouping**: Consider grouping topics by category (civic, economic, social).

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Local storage for selected topics**:
   - Store selected topic IDs array in `AsyncStorage`.
   - Load on mount, default to initial selection (bills, executive, courts, economy).

2. **Persist selection locally**:
   - Update local storage whenever selection changes (optimistically).
   - Save button can still exist for explicit user action.

3. **Topic taxonomy**:
   - Keep hardcoded taxonomy for now; can be updated via app updates.
   - Consider moving to a JSON file for easier updates.

4. **Search filter**:
   - Already implemented client-side.

5. **Grouping by category**:
   - Add `category` field to topic objects and group visually with section headers.

### Local Storage Alternative:

- Store selected topic IDs under key `@billion/content_interests`.
- Store entire taxonomy in a local JSON file if dynamic updates needed.

### Migration Path to Backend:

- Fetch taxonomy from backend to allow dynamic updates without app release.
- Sync selected topics to backend user preferences.
- Implement category grouping from backend metadata.

## Priority: 🟡 Medium (Feed personalization)

**Can ship with**: Local storage for selected topics, static taxonomy.
**Blockers**: None for local implementation.
