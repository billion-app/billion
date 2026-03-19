# Blocked Content Page Implementation

## Current Status

The Blocked Content page exists at `apps/expo/src/app/settings/blocked-content.tsx` with mock data, swipe-to-unblock UI, undo toast, and empty state.

## Backend Dependencies

- **Blocked list**: Fetch from tRPC (`trpc.user.blocked.list`).
- **Persist unblock**: Mutation (`trpc.user.blocked.remove`).
- **Blocking sources/topics**: Should be blockable from article cards and content-interests screen (not implemented).

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Local storage for blocked items**:
   - Store blocked items array in `AsyncStorage` with `{ id, name, type, blockedAt }`.
   - Load initial state from storage, fallback to mock data for demo.

2. **Persist unblock actions locally**:
   - When user swipes to unblock, remove item from local storage.
   - Undo toast restores item to local storage.

3. **Blocking from other screens**:
   - Add blocking functionality to article cards (store source ID) and content-interests screen (store topic ID).
   - Update local blocked list accordingly.

4. **Empty state**: Already implemented.

### Local Storage Alternative:

- Use `AsyncStorage` key `@billion/blocked_items`.
- Store as JSON array; ensure uniqueness by composite key (type + name/id).

### Migration Path to Backend:

- Sync blocked items to backend when user logs in.
- Implement tRPC endpoints for blocked list.
- Use optimistic updates: update UI immediately, sync in background.

## Priority: 🟡 Medium (User control over feed)

**Can ship with**: Local storage for blocked items, full UI interaction.
**Blockers**: Need blocking actions from other screens.
