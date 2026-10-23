# New bill notification verification

The reported bill was S. 5686, **No Public Executions in America Act**. Production
stored its introduction date as October 15, 2026 and its first import as
October 18 at 03:17:44 UTC, which was October 17 at 8:17 PM Pacific. Read-only
inspection found no notification for the bill. The worker supported saved-bill
actions and executive orders, but had no new-bill subscription or enqueue path.

## Local delivery replay

The replay used a disposable local PostgreSQL database, the source title and dates,
and a synthetic phone. The after-fix run explicitly subscribed the phone before
the import and mocked only the Expo HTTP response. No real push was sent.

Before the change:

```text
S. 5686 replay before fix: {"enqueued":0,"sent":0,"failed":0,"unregistered":0,"receipts":{"checked":0,"failed":0,"unregistered":0}}
```

After the change:

```text
S. 5686 replay after fix: {"enqueued":1,"sent":1,"failed":0,"unregistered":0,"receipts":{"checked":0,"failed":0,"unregistered":0}}
Repeat run: {"enqueued":0,"sent":0,"failed":0,"unregistered":0,"receipts":{"checked":0,"failed":0,"unregistered":0}}
```

The committed [delivery integration test](../../../packages/api/src/lib/notifications/deliver.integration.test.ts)
also exercises API registration, delayed discovery, quiet hours, concurrent workers,
opt-out, re-enabling, stale subscriptions, excluded bills, and server history.
Run it with the disposable-database procedure in
[Contributing](../../../CONTRIBUTING.md#notification-delivery-integration-test).
The independent verification run passed all 17 tests without skips.

## Running interface

These screenshots show the actual Expo web Settings screen with local fixture
responses and synthetic preferences. External requests were blocked. They do not
show physical-device push delivery.

- [English, off, 390 × 844](settings-off-en.png).
- [English, on, 390 × 844](settings-on-en.png).
- [Chinese, off, 320 × 740](settings-off-zh-320.png).

Browser automation verified that older stored preferences default off, enabling
survives reload, disabling persists, the switch stays inside the viewport, and
its accessible checked state matches the setting. Captures wait for the enabled
switch animation to settle. The narrow Chinese screen has no horizontal overflow.

The independent Astra review approved the implementation and screenshots with no
actionable findings. The reviewer inspected the code and images but did not rerun
tests or verify a physical phone.

## Release boundary

Apply migration `0030_petite_ironclad` before deploying the API and worker. Publish
the mobile JavaScript change after those services support the new preference.
Existing and new installations remain opted out until the reader enables
**Settings → Notifications → New bills in Congress**.

This change does not retroactively send S. 5686 to a phone that subscribes after
its import. The local replay proves eligibility for an earlier subscription,
not receipt on the reporting reader's phone.
