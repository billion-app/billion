# PR #371 simulator evidence

Source: `c9dd08e49af966ba836e92bf2ca8dafbff28aac8`.

Captured on a dedicated iPhone 17 Pro simulator, iOS 26.5, named `Billion PR371 fixtures` (UDID `5B7ED98C-2A93-434E-9C01-1457D5DF8223`). An existing Billion Debug simulator binary loaded this source through its development client and a dedicated local Metro server. Temporary fixture routes were used only in the evidence worktree, with analytics disabled and API traffic directed at an unused local port.

The ballot fixture uses fictional North Carolina/California addresses, elections, candidates and citations. Its California results renderer is a no-network marker. These are native iOS Simulator screenshots of synthetic states, not installed-production or live-provider coverage evidence. The production lookup gate remains disabled. No changes to the PR's implementation branch are included here.

Captures use the real ballot view. The fixture-only scenario toolbar was hidden, and the source view was scrolled programmatically for capture. Application content and styling are unchanged. Temporary preview code was not committed.

- `ballot-election-selection.png`: address-specific returned election alternatives and honest ballot status.
- `ballot-sources.png`: fictional candidate/contest source attribution and unknown language availability.
- `ballot-failure.png`: failed lookup with retry and no stale ballot content.
