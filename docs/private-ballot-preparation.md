# Private ballot preparation

Preparation keeps a reader's saved races and measures, notes, review progress,
and optional tentative candidate choice on the device. Saving does not register
the reader or cast a vote. “Reviewed” records reading progress independently from
a tentative choice. Measure choices belong in notes until verified marking
options are available; the app does not invent Yes/No options.

[PrivatePreparation](../apps/expo/src/components/preparation/PrivatePreparation.tsx)
uses the supplied election and contests in
[BallotLookupView](../apps/expo/src/components/ballot/BallotLookupView.tsx).
Preparation is unavailable for unidentified elections and duplicate contest
snapshots. The standalone [archive](../apps/expo/src/app/ballot-preparation.tsx)
reads local preparation without fetching a ballot, requiring an account, or
requiring the provider to continue listing an older election. The new personalized
Elections entry owned by #418 still needs to expose the archive in its production
invitation and validate the real ballot flow.

## Persistence and privacy

The versioned AsyncStorage record `billion.private-preparation.v1` holds at most
200 saved contest snapshots across elections. Each note is limited to 1,000
characters. Writes are serialized, and successful saving is reported only after
storage accepts the write. Mounted editors subscribe to committed changes, so
deleting in the archive also clears matching ballot drafts before returning. Unreadable data stays untouched until explicit deletion;
read/save failures preserve edits. Delete-all requires a second confirmation and
also works when the stored record is malformed.

This is app-local storage, not encrypted storage or account synchronization.
Operating-system/device backups may include it. The feature sends no notes,
choices, or progress through tRPC, analytics, or sharing. Its controls and containing
card exclude PostHog touch capture. Sharing #340 and offline content caching #317
remain separate features; the archive contains preparation, not cached official
ballot content. The exact lookup input is stored only in the private identity key
to prevent choices transferring between addresses; it is not rendered or shared.

The election key contains provider, election ID, date, division and exact lookup
input. Missing lookup scope disables saving. Changed lookup input conservatively
starts new preparation, leaving prior records in the archive. Until durable
provider contest/candidate IDs exist, the contest key is a conservative exact
snapshot of ballot-defining fields and the named candidate roster, including
withdrawal status. Ordering the candidate list does not change identity. A changed
snapshot retains the old notes/choice under “Previous snapshot” and requires new
review; it never binds a choice to a different contest or candidate. Withdrawn
candidates and ambiguous duplicate names cannot be selected. Indistinguishable
same-named candidates remain a provider identity gate, rather than a claim that
these snapshots replace durable IDs.

Explicitly save edits before leaving the screen or changing elections. Switching
items inside the editor offers a keep-editing/discard boundary; notes cannot be
edited during a pending save. The production navigation owner must validate the
leaving/changed-election flow as part of #418 integration.

## Reminder gate and verification

Reminders are unavailable in the UI. The
[reminder contract prototype](../apps/expo/src/utils/preparation-reminders.ts)
accepts only explicitly verified, applicable, source-linked deadlines for the same
election. Opt-out, stale/missing dates, and election changes cancel the previous
identifier before scheduling. Denied permission schedules nothing. This prototype
has no native adapter or production scheduling call.

Before enabling reminders, #422 must supply stable deadline ID/revision,
election identity, applicability to the selected jurisdiction and voting method,
exact timestamp/timezone, official source and explicit verification validity.
Integration must persist scheduled identifiers, reconcile/cancel on launch and
deadline refresh, handle permission changes and deletion, and provide cancellation
controls. Native scheduling and deadline changes while the app is closed need
real-device validation. Neither fetched dates nor fictional fixtures establish
verification.

[Store tests](../apps/expo/src/utils/preparation.test.ts) cover restoration,
concurrent writes, failed persistence, election/roster/withdrawal/rule changes,
and deletion across subscribed views. [Reminder prototype tests](../apps/expo/src/utils/preparation-reminders.test.ts)
cover stale data, election changes, opt-out, denied permission and revision
replacement. [The controlled fixture](../apps/expo/src/components/preparation/PreparationFixture.tsx)
is not an app route. [Screenshot evidence](evidence/427/README.md) comes from its
actual Expo web rendering. Production native flow, Dynamic Type, VoiceOver,
real-reader comprehension and reminder delivery remain unverified gates.
