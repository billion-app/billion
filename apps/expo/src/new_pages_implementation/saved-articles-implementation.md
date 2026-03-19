# Saved Articles Page Implementation

## Current Status

The Saved Articles page exists at `apps/expo/src/app/settings/saved-articles.tsx` with mock data, swipe-to-unsave UI, and undo toast functionality.

## Backend Dependencies

- **Data source**: Currently mock data. Needs tRPC endpoint (`trpc.content.saved.list`).
- **Persist unsave**: Needs tRPC mutation (`trpc.content.saved.remove`).
- **Navigation**: Tap card should navigate to article detail (requires content detail screen).
- **Sort/filter**: Not implemented.
- **Pagination**: Not implemented for real data.

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Local storage for saved articles**:
   - Use `AsyncStorage` or `expo-sqlite` to store saved articles locally.
   - Schema: `{ id, type, title, date, color, contentId, savedAt }`.
   - Initialize state from local storage on mount.

2. **Persist unsave actions locally**:
   - When user swipes to unsave, remove item from local storage.
   - Undo toast should restore item to local storage.

3. **Navigation to article detail**:
   - If article detail screen exists, navigate with `contentId` and `type`.
   - Otherwise, temporarily disable tap or show placeholder.

4. **Sort/filter controls**:
   - Implement local sorting by date (newest first) and filtering by type.
   - Use local state for sort criteria.

### Local Storage Alternative:

- Use `AsyncStorage` for simple key-value storage of saved articles array.
- For better performance, use `expo-sqlite` with proper indexing.
- Store saved articles as JSON array under key `@billion/saved_articles`.

### Migration Path to Backend:

- Sync local saved articles with backend on user login.
- Implement tRPC endpoints for saved articles.
- Use optimistic updates: update UI immediately, sync in background.

## Priority: 🟢 High (Core bookmarking feature)

**Can ship with**: Local storage for saved articles, full UI interaction.
**Blockers**: Need article detail screen for navigation.
