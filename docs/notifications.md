# Breaking-news notifications

Billion uses `expo-notifications` and the Expo Push Service. Expo forwards iOS
messages to APNs and Android messages to FCM, so the API does not store Apple or
Google push credentials.

Notifications are installation-based and do not require a Billion account. If
the installation is signed in, its device row is also associated with that
user.

## One-time setup

1. Apply the database migration:

   ```sh
   pnpm db:migrate
   ```

2. Configure `BILLION_NOTIFICATIONS_SECRET` in the Next.js deployment. Use at
   least 32 random characters and share it only with trusted operators or the
   receipt scheduler.

3. Create a new native build. Adding `expo-notifications` changes native app
   capabilities, so an OTA update is not sufficient:

   ```sh
   cd apps/expo
   eas build --profile development --platform ios
   ```

   On the first EAS build, allow EAS to create or reuse the Apple Push
   Notification key. Production builds use the same EAS project ID already
   configured in `app.config.base.json`.

4. Test on a physical device. Open **Settings → Notifications**, enable
   **Breaking legislation**, and accept the operating-system prompt.

## Send an editorially approved alert

The send endpoint requires a bearer secret and an idempotency key. Repeating a
request with the same key returns the existing alert without broadcasting it
again.

```sh
curl https://API_ORIGIN/api/notifications/breaking \
  --request POST \
  --header "Authorization: Bearer YOUR_NOTIFICATION_SECRET" \
  --header "Content-Type: application/json" \
  --data '{
    "title": "BREAKING",
    "body": "The Senate passed a major online privacy bill.",
    "contentId": "00000000-0000-0000-0000-000000000000",
    "route": "/article-detail?id=00000000-0000-0000-0000-000000000000",
    "idempotencyKey": "privacy-bill-senate-passage-2026-07-30"
  }'
```

Use a new idempotency key for a genuinely new editorial alert. Titles are
limited to 100 characters and bodies to 240.

## Process Expo receipts

Expo tickets only mean that Expo accepted a message. Run the receipt endpoint
around 15 minutes after sending, and periodically while ticketed deliveries
remain:

```sh
curl https://API_ORIGIN/api/notifications/receipts \
  --request POST \
  --header "Authorization: Bearer YOUR_NOTIFICATION_SECRET"
```

Successful receipts mark deliveries as `delivered`. Failed receipts preserve
the Expo error. A `DeviceNotRegistered` receipt disables that installation so
future broadcasts do not target an uninstalled or deregistered app.

For production, invoke this endpoint from the existing scheduler or another
trusted cron service. Do not put the notification secret in the mobile app.

## Data model

- `push_device`: installation token, platform, opt-in, and last-seen time
- `notification_alert`: editorial content and idempotency key
- `notification_delivery`: per-device Expo ticket and receipt lifecycle

The app stores the local opt-in as well as the server preference. On launch, it
refreshes an existing token without displaying the permission prompt. The
prompt is shown only when the user explicitly enables breaking alerts.

## Delivery behavior

Alerts use high priority, the ordinary system sound, and Android's
`breaking-news` channel. They do not use Apple's Critical Alerts entitlement
and therefore never bypass mute or Focus modes. Tapping an alert opens the
internal route supplied in its data payload.
