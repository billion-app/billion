# TestFlight waitlist batches

Use Resend Broadcasts for the TestFlight invitation—not a loop of transactional
emails. Broadcasts preserve the campaign, delivery, and unsubscribe history.

Resend has Contacts, Segments, Topics, and Broadcasts, but it does **not**
automatically exclude people who received a previous Broadcast. Treat each
TestFlight round as its own immutable recipient Segment.

## One-time setup

1. Keep the existing `Waitlist` segment as the complete source of truth.
2. Create a `TestFlight — batch 1` segment.
3. In Resend, select the current waitlist contacts and add them to that batch
   segment. Do not use the all-waitlist segment as the Broadcast target.
4. Create a `Local updates` Topic and set its ID as
   `RESEND_LAUNCH_UPDATES_TOPIC_ID`. Send the Broadcast scoped to that Topic so
   people who opt out do not receive future marketing updates.
5. Set `RESEND_TESTFLIGHT_BATCH_SEGMENT_ID` to the batch segment ID. While it is
   configured, every new waitlist signup joins both `Waitlist` and that batch.

## Batch 1 Broadcast draft

**Internal name:** `TestFlight batch 1 — initial invite`

**Subject:** `Billion is ready for you to test`

**Preview text:** `The first TestFlight build is ready.`

```text
Hey — Billion is ready for you to test.

You can join the first TestFlight here:
https://testflight.apple.com/join/m2ay41KF

It is an early build, so we would really love to hear what works, what feels
off, and what you want next.

Thanks for being one of the first people in.

— Billion
```

Use the same copy in the Resend Broadcast editor, add the `TestFlight — batch
1` segment as the only audience, scope it to `Local updates`, save as a draft,
and verify the recipient count before sending. A sent Broadcast is the audit
record for batch 1; do not clone and send it again.

## Subsequent rounds without duplicates

For every later round, create a new segment—for example `TestFlight — batch 2`
or `TestFlight — July 2026`—then change
`RESEND_TESTFLIGHT_BATCH_SEGMENT_ID` to the new segment ID. Do not change
`RESEND_LAUNCH_UPDATES_TOPIC_ID`: that Topic represents the user's ongoing
email preference, not a recipient batch. Target only the new batch segment for
that round's Broadcast.

For a higher-volume workflow, add a custom Contact Property such as
`testflight_invited_at` for reporting, but continue to use the immutable batch
segments as the send audiences. Properties help answer who was invited;
segments are what make the Broadcast recipient set reviewable before send.

## Signup confirmation

The website now sends this transactional email only when it creates a new
contact. Set `RESEND_WAITLIST_CONFIRMATION_FROM_EMAIL` to a verified sender to
enable it:

**Subject:** `You're on the Billion waitlist`

```text
You're on the Billion waitlist.

We'll email you when there's an update. Thanks for being early.
```

If Resend cannot deliver the confirmation, the signup still succeeds and the
failure is logged. Submitting the form again does not send another confirmation.
