# Ballot UI review evidence

Native iPhone 17 Pro simulator captures for source commit `626684a`, with the separately owned shared evidence contrast and voting-resource recovery fixes integrated during review.

These are synthetic local HTTP responses through the actual tRPC client and actual Elections/local-elections entry routes. They do not establish live-provider coverage. Fictional supplied locations exercise the shared component; the current Democracy Works adapter supplies lookup links rather than these location arrays.

Default captures use iOS text size `large` (the default). Files marked `enlarged` use `accessibility-medium`. The simulator was restored to its default afterward.

Actual native button actions covered How to vote, location and original-note disclosures, Back, election selection, Retry, and address edits A→B→A. Initial handoff made one request; address changes and Retry made new requests with enrichment disabled. Mismatched results and refresh failures hid cached ballot/voting details. Reopening used the saved address because lookup edits are session-local.

The before/after scroll pair used temporary `scrollTo` positioning before real How to vote and Back taps. The lower enlarged notes and ballot footer were also positioned programmatically. These captures do not claim native swipe, VoiceOver, or Android runtime verification.

Both independent visual and interaction reviewers reported ready with no remaining actionable findings in their reviewed scope. All temporary harness code and launch-gate overrides were removed before the source commit. The public launch gate remains closed.
