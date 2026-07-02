# Saved Articles Page Implementation

## Current Status

The Saved Articles page lives at `apps/expo/src/app/settings/saved-articles.tsx` and is
wired to real backend data via `trpc.content.saved.list` (paginated), with
swipe-to-unsave backed by `trpc.content.saved.remove`. Saving/unsaving from the
article detail screen and the feed use `trpc.content.saved.add` /
`trpc.content.saved.remove` / `trpc.content.saved.isSaved`.

## Backend Dependencies

- **Data source**: Real data via `trpc.content.saved.list` (cursor/offset pagination, `limit`/`cursor` input).
- **Persist unsave**: `trpc.content.saved.remove` mutation, invalidates the list query on success.
- **Navigation**: Tapping a card navigates to `/article-detail?id=...`.
- **Sort/filter**: Not implemented (filter icon is a placeholder).
- **Pagination**: Implemented via `useInfiniteQuery` + `FlatList` `onEndReached`.

## Priority: 🟢 High (Core bookmarking feature)

**Shipped**: Real backend-backed saved articles list, save/unsave from article
detail and feed, swipe-to-unsave, pagination.
**Remaining**: Sort/filter controls are still a placeholder.
