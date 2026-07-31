# Billion — Verified Data Inventory & App Store Privacy Answers

**Scope:** Summer 2026 read-only release candidate on `main` (iOS app
`app.billion-news.billion`, ASC app ID `6761675243`) and the marketing/legal website
`billion-news.app`.

**Review owner:** thatxliner (project owner, `thatxliner@gmail.com`)
**Reviewed:** 2026-07-24 against the release candidate on `main`
**Legal effective date ("Last updated"):** July 24, 2026

This is the single source of truth that the legal copy (`/terms`, `/privacy`, in-app
`settings/terms`) and the App Store Connect privacy answers are derived from. If any of
the behavior below changes, update this file first, then the copy and the ASC answers so
all three stay in agreement.

---

## 1. How the release actually behaves (verified in code)

| Area                    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts                | **No account and no sign-in exist in the app.** There is no login / Discord / sign-up / waitlist screen anywhere in `apps/expo`; the only matches are inside the legal copy. `better-auth` (Discord OAuth) is wired server-side but never reachable from the app UI. Core use (feed, articles, ballot, feedback) needs no account.                                                                                                                                                                                                                                                           | `apps/expo/src/app/**` (no auth screens); `packages/auth/src/index.ts`; `packages/api/src/router/auth.ts`                                                                         |
| Analytics SDK           | **PostHog is the only analytics/telemetry SDK.** No Sentry, Firebase, Segment, Amplitude, ad SDKs, Facebook SDK, AppsFlyer/Adjust/Branch, and no IDFA/AppTrackingTransparency. US cloud (`https://us.i.posthog.com`).                                                                                                                                                                                                                                                                                                                                                                        | `apps/expo/package.json`; `apps/expo/src/config/posthog.ts`; `apps/expo/.env`                                                                                                     |
| PostHog config          | `captureAppLifecycleEvents: true`; autocapture `captureTouches: true` / `captureScreens: false`, `propsToCapture: ["testID"]`. Manual `screen()` on every navigation. `identify()` is called only when a user exists — which never happens (no sign-in), so events stay tied to the random install ID.                                                                                                                                                                                                                                                                                       | `apps/expo/src/app/_layout.tsx`                                                                                                                                                   |
| Identifiers             | PostHog's randomly generated, persistent per-install **`distinct_id`** (a Device ID), plus automatic device/app properties: device type/model/manufacturer, OS + version, app name/version/build, locale, time zone, and emulator status. PostHog Cloud derives approximate **city-level location from the request IP** by default. When alerts are enabled, the Expo push token is also a Device ID used for app functionality. **No advertising identifier.** These IDs are linked to the installation/device under Apple's App Privacy definition, even when not tied to a name or email. | PostHog RN defaults; `expo-device`, `expo-application`, `expo-localization`, `expo-notifications`                                                                                 |
| Push notifications      | When explicitly enabled, Expo issues an app-installation push token. The backend stores the token, platform, opt-in, last-seen time, and per-alert ticket/receipt status. A signed-in user's ID may be associated with the installation; an account is not required. Invalid tokens are disabled after Expo/APNs or FCM reports `DeviceNotRegistered`.                                                                                                                                                                                                                                       | `apps/expo/src/utils/push-notifications.ts`; `packages/db/src/schema.ts`; `apps/nextjs/src/app/api/notifications/`                                                                |
| Event content           | Events include what you read and search: `article_viewed` sends `content_title`/`content_id`; `content_searched` sends the **raw query text**; plus saves, filters, ballot interactions, feedback events. So reading/search activity **does** leave the device.                                                                                                                                                                                                                                                                                                                              | `apps/expo/src/app/article-detail.tsx`, `(tabs)/index.tsx`, `(tabs)/elections.tsx`                                                                                                |
| Election address        | **Typed by the user — the app never reads GPS.** No `expo-location`, no `NSLocation*` usage strings. The selected address is stored on-device in the iOS Keychain via `expo-secure-store`. Partial address text is sent to the backend for autocomplete, and the selected/typed address is sent for civic lookups.                                                                                                                                                                                                                                                                           | `apps/expo/src/hooks/useUserAddress.ts`; `apps/expo/src/components/AddressAutocomplete.tsx`; `apps/expo/src/utils/client-storage.ts`; `app.config.base.json` (no location plugin) |
| Address → third parties | Partial address text is forwarded through the backend to **Google Places** for autocomplete. A selected/typed address is forwarded to the **Google Civic Information API** for ballot and district lookup. **Open States does not receive the street address**; the backend uses public Open States state-level data after Google resolves the relevant divisions. The `voter_address_set` analytics event sends only `{ is_update }`, **not** the address.                                                                                                                                  | `packages/api/src/lib/civic.ts`, `lib/places.ts`, `lib/elected-officials.ts`; `(tabs)/elections.tsx`                                                                              |
| Address retention       | Server caches lookup **results** in `CivicApiCache` keyed by **SHA-256 of the normalized address** (not the raw address). TTLs: voter info 24h, divisions 30d, elections 7d. The cached response body may contain normalized address components. The cache is not joined to an app account or the PostHog installation ID, but a physical address is inherently identifying and is treated as linked under Apple's App Privacy definition.                                                                                                                                                   | `packages/api/src/lib/civic.ts` (`hashAddress`, `getCache`/`setCache`, `CACHE_TTL`)                                                                                               |
| Feedback                | The production Feedback tab opens **Google Forms** for bug/feature feedback and the user's mail client for content issues or direct email. Prefilled details can include the message, category, app version/build, platform, and OS version. Email feedback also exposes the sender address and standard email headers. The otherwise hidden Settings feedback route can submit the same core fields through the backend and **Resend**.                                                                                                                                                     | `apps/expo/src/app/(tabs)/feedback.tsx`; `apps/expo/src/utils/feedback-form.ts`; `apps/expo/src/app/settings/feedback.tsx`; `packages/api/src/router/feedback.ts`                 |
| Website waitlist        | `billion-news.app` collects an email via `/api/waitlist`, stored as a **Resend contact/audience** with a confirmation email. Website also runs PostHog (`posthog-js`). This is a **website** flow — not part of the iOS app's data collection.                                                                                                                                                                                                                                                                                                                                               | `apps/nextjs/src/app/_components/waitlist-form.tsx`; `apps/nextjs/src/app/api/waitlist/route.ts`                                                                                  |
| Error diagnostics       | No dedicated crash SDK. PostHog automatic exception capture is disabled in the production project, and session replay is not enabled. One handled failure to open an original-source URL is sent with `captureException`. Lifecycle events record install/update/open/active/background state, not launch time, hang rate, energy use, or other performance measurements.                                                                                                                                                                                                                    | `apps/expo/src/app/article-detail.tsx`; production PostHog remote config verified 2026-07-24                                                                                      |
| Data sold               | No. No data brokers, no advertising, no cross-app tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                 |

### Processors (sub-processors)

- **PostHog** (US) — product analytics + diagnostics (app and website).
- **Resend** — transactional/marketing email: feedback delivery + waitlist confirmation & audience.
- **Google Forms** — guided bug and feature feedback.
- **Google Civic Information API**, **Google Places** — address → ballot/district lookup and
  autocomplete.
- **Open States** (Plural Policy) — public representative data; the user's street address is
  not sent to Open States.

---

## 2. Production URLs for App Store Connect

Canonical domain is **`billion-news.app`** — it is the Next.js `metadataBase` in production
and the production API host (`https://www.billion-news.app`). Both legal pages are **live over
HTTPS** (verified 2026-07-24).

> ⚠️ `billion.app` is **not ours** — it redirects to a GoDaddy "for sale" parked page. Do not
> use it anywhere. The old in-app "Visit billion.app" link and some scraper `User-Agent`
> strings still reference it (see §6).

| App Store Connect field           | Value                              |
| --------------------------------- | ---------------------------------- |
| **Privacy Policy URL** (required) | `https://billion-news.app/privacy` |
| **Support URL** (required)        | `https://billion-news.app/support` |
| Marketing URL (optional)          | `https://billion-news.app`         |

Reachability (acceptance criterion — "reachable over public HTTPS"):

- `https://billion-news.app/privacy` → 200, "Privacy Policy" ✓ (route live)
- `https://billion-news.app/terms` → 200, "Terms of Service" ✓ (route live)
- `https://billion-news.app/support` → public support contact and FAQ
- In-app (**production**): `Feedback tab → Terms and Privacy Policy` → `settings/terms` ✓
- In-app (dev only): `Settings → Privacy → Read full Privacy Policy`, and
  `Settings → About Billion → Privacy policy / Terms of service`

> ⚠️ **The Settings tab is hidden in release builds** (`(tabs)/_layout.tsx` sets
> `href: __DEV__ ? undefined : null`, and `TabBar.tsx` skips it when `!__DEV__`). Settings was
> the only route into the legal copy, so before the Feedback-tab link above, Terms and Privacy
> were unreachable in production. Keep a legal entry point on a tab that ships, or this
> acceptance criterion silently regresses.

> ⚠️ **Redeploy required.** As of 2026-07-24 the live privacy page serves the July 23 policy,
> not the corrected July 24 copy in this repository. The revised text goes live only after
> `apps/nextjs` is redeployed to `billion-news.app`. Redeploy **before** submitting to App
> Review so the ASC privacy-policy URL matches the label. The in-app copy ships with the new
> binary. Re-verify the privacy page shows "Last updated July 24, 2026" after deploy.

> These URL fields are stored in `apps/expo/store.config.json` and can be synced with
> `eas metadata:push` (see §5).

---

## 3. App Store "App Privacy" answers (iOS app)

Derived entirely from §1. **"Data collected? → Yes."** No listed type is used for tracking:
there is no IDFA, data-broker sharing, cross-company targeted advertising, or advertising
measurement. The app therefore does not require App Tracking Transparency.

Apple defines "linked" to include association with an identity **or device**. PostHog attaches
its persistent installation/device ID to analytics events, and a physical or email address is
itself identifying. The absence of an app account does not make those types unlinked.

| Apple data type                         | Purpose           | Linked | Tracking | Why (source)                                                                                                                  |
| --------------------------------------- | ----------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Contact Info → Email Address**        | App Functionality | Yes    | No       | A user who chooses an email feedback path sends us their sender address. See optional-disclosure note below.                  |
| **Contact Info → Physical Address**     | App Functionality | Yes    | No       | The registered address is used for autocomplete and civic lookup; cached responses may retain normalized components.          |
| **Location → Coarse Location**          | Analytics         | Yes    | No       | PostHog derives approximate city-level location from IP and stores it with the installation ID.                               |
| **User Content → Customer Support**     | App Functionality | Yes    | No       | Feedback messages go through Google Forms, email, or the backend/Resend path; email feedback links the message to the sender. |
| **Search History**                      | Analytics         | Yes    | No       | `content_searched` sends the raw query text to PostHog with the installation ID.                                              |
| **Identifiers → Device ID**             | Analytics         | Yes    | No       | PostHog's persistent random install `distinct_id` (not IDFA).                                                                 |
| **Usage Data → Product Interaction**    | Analytics         | Yes    | No       | Screens, article opens, taps, filters, ballot interactions, and feedback events are stored with the installation ID.          |
| **Diagnostics → Other Diagnostic Data** | App Functionality | Yes    | No       | A handled source-opening error and its context are sent to PostHog with the installation ID.                                  |

**Explicitly NOT collected by the iOS app:** Name, Phone Number, User ID; Precise Location /
GPS; Payment, Financial, Purchases, Credit info; Health & Fitness; Contacts; Browsing History;
Audio; Photos/Videos; Sensitive Info (including political affiliation — viewing civic content
does not establish the user's political opinion); Advertising Data / IDFA; Crash Data; and
Performance Data.

### Disclosure notes

1. **Physical Address.** Declare it. Although the raw address is used to service the civic
   feature and the cache key is a one-way hash, cached response data may contain normalized
   address components for up to 30 days. Because the address itself can identify a person or
   household, answer **Linked: Yes**.

2. **Coarse Location (IP).** The recommended answer above **matches current behavior** (PostHog
   geo-IP is on) and the policy's city-level disclosure, so copy + label + SDK agree with no
   code change. _Alternative if you want a cleaner label:_ disable IP/geo-IP in PostHog, then
   answer **Coarse Location: not collected** and delete the "city-level location" sentence from
   `/privacy` §5. Pick one; keep all three surfaces consistent either way.

3. **Feedback and email.** Apple's optional-disclosure rules may permit omitting infrequent,
   voluntary support data when every criterion is met. The conservative recommendation is to
   disclose both **Email Address** and **Customer Support** as above. If the review owner
   deliberately relies on the optional-disclosure exception, omit both types together and
   document that decision here.

_Optional data-minimization (not required for launch):_ stop sending the raw `content_searched`
query text (send only length/filter) to drop **Search History** from the label.

---

## 4. Apple Privacy Manifest & Required-Reason APIs (verify after `expo prebuild`)

`apps/expo/app.config.base.json` declares the same eight collected-data types listed in §3.
Expo writes those declarations into `apps/expo/ios/billion/PrivacyInfo.xcprivacy` during
prebuild. After `just build ios`, confirm:

- `NSPrivacyTracking = false`, `NSPrivacyTrackingDomains` empty (PostHog is first-party
  analytics, not tracking).
- Required-Reason API declarations are present for what the SDKs use, e.g. **UserDefaults**
  (`CA92.1`, via AsyncStorage), and any **File Timestamp / System Boot Time / Disk Space** reasons
  pulled in by Expo/PostHog.
- Collected-data types in the manifest match §3.

---

## 5. Manual App Store Connect checklist (requires Apple credentials — do this yourself)

I can't sign in to App Store Connect. Steps:

1. **App Privacy → Privacy Policy URL:** set `https://billion-news.app/privacy`.
2. **App Information → Support URL:** set `https://billion-news.app/support`. (Optional
   Marketing URL: `https://billion-news.app`.)
3. **App Privacy → Data Collection:** answer "Yes", then enter exactly the eight types in §3
   with the listed purposes; for each set _Linked to You = Yes_ and _Used to Track You = No_.
   If deliberately relying on Apple's optional support-data exception, omit Email Address and
   Customer Support together and record the decision in §3.
4. **App Privacy → confirm** the label preview shows **no** "Data Used to Track You" section.
5. Cross-check the published label against `https://billion-news.app/privacy` so they agree
   (acceptance criterion).

The checked-in `apps/expo/store.config.json` codifies the public URLs. Sync it from
`apps/expo` with `eas metadata:push`. Its minimal shape is:

```jsonc
{
  "configVersion": 0,
  "apple": {
    "info": {
      "en-US": {
        "title": "Billion News",
        "marketingUrl": "https://billion-news.app",
        "supportUrl": "https://billion-news.app/support",
        "privacyPolicyUrl": "https://billion-news.app/privacy",
      },
    },
  },
}
```

(App-privacy answers in §3 are not covered by `eas metadata` and must be entered in the ASC UI.)

---

## 6. Follow-ups noticed (out of scope for legal/ASC, flagged for later)

- **Dead account surfaces.** `Settings` still shows Edit Profile, Content Interests, Saved
  Articles, Blocked Content — all `protectedProcedure` (login-only) and non-functional in this
  no-account release. Consider hiding them for the read-only build.
- **Stray `billion.app` references** in non-shipped code: scraper/measure-source `User-Agent`
  strings and a `civic@billion.app` address (`apps/scraper/...`, `packages/api/src/lib/measure-sources/*`,
  `candidate-sources/*`). Not user-visible, but they point at a domain we don't own.
- **Contact address — resolved.** The public-facing contact is now
  `billionnewsapp@gmail.com` (the organization inbox) across the legal copy, the in-app
  privacy screen, the Feedback tab, and the `FEEDBACK_TO_EMAIL` default. The owner's personal
  `thatxliner@gmail.com` is retained only as the review-owner of record (above), not as a
  public contact.
- **No acceptance gate.** There is no onboarding or first-launch flow, so users never
  affirmatively accept the Terms. Not required by Apple for a no-account, read-only app, but a
  first-launch notice ("By continuing you agree to…") linking both documents would materially
  improve enforceability. Revisit before accounts, purchases, or EU availability.
