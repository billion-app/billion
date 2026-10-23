# Billion — Verified Data Inventory & App Store Privacy Answers

**Scope:** Billion iOS app (
`app.billion-news.billion`, ASC app ID `6761675243`) and the marketing/legal website
`billion-news.app`.

**Review owner:** thatxliner (project owner, `thatxliner@gmail.com`)
**Reviewed:** 2026-07-24 full inventory; onboarding and content preferences rechecked 2026-09-14; address/location flow and disclosures rechecked 2026-10-18. Other historical findings below have not been re-audited.
**Legal effective date ("Last updated"):** October 18, 2026

This is the single source of truth that the legal copy (`/terms`, `/privacy`, in-app
`settings/terms`) and the App Store Connect privacy answers are derived from. If any of
the behavior below changes, update this file first, then the copy and the ASC answers so
all three stay in agreement.

---

## 1. How the release actually behaves (verified in code)

| Area                    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts                | **No usable account or sign-in flow exists in the app.** Onboarding shows a “Save your workspace” sheet, but its Apple, Google, and email controls only show a coming-soon message. “Explore first” is the working exit. Better Auth remains wired server-side but is not reachable from production app UI. Core reading does not require an account.                                                                                                                                                                                                                                                                                                                                   | `apps/expo/src/components/onboarding/ClaimWorkspaceSheet.tsx`; `packages/auth/src/index.ts`; `packages/api/src/router/auth.ts`                                                                                                            |
| Content preferences     | First-run onboarding stores completion, government vectors, sectors, derived topic labels, alert choices, and account-prompt dismissal as JSON in AsyncStorage under `billion.onboarding.v1`. If an authenticated session already exists, it also upserts topics and content types into the account's `user_preference` row. The Feed does not currently filter or rank cards from these values, and the alert choices do not schedule delivery.                                                                                                                                                                                                                                        | `apps/expo/src/utils/onboarding-store.ts`; `apps/expo/src/components/onboarding/OnboardingFlow.tsx`; `packages/api/src/router/user.ts`; `packages/db/src/schema.ts`                                                                       |
| Analytics SDK           | **PostHog is the only analytics/telemetry SDK.** No Sentry, Firebase, Segment, Amplitude, ad SDKs, Facebook SDK, AppsFlyer/Adjust/Branch, and no IDFA/AppTrackingTransparency. US cloud (`https://us.i.posthog.com`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `apps/expo/package.json`; `apps/expo/src/config/posthog.ts`; `apps/expo/.env`                                                                                                                                                             |
| PostHog config          | `captureAppLifecycleEvents: true`; autocapture `captureTouches: true` / `captureScreens: false`, `propsToCapture: ["testID"]`. Manual `screen()` on every navigation. `identify()` is called only when a user exists — which never happens (no sign-in), so events stay tied to the random install ID.                                                                                                                                                                                                                                                                                                                                                                                  | `apps/expo/src/app/_layout.tsx`                                                                                                                                                                                                           |
| Identifiers             | PostHog's randomly generated, persistent per-install **`distinct_id`** (a Device ID), plus automatic device/app properties: device type/model/manufacturer, OS + version, app name/version/build, locale, time zone, and emulator status. PostHog Cloud derives approximate **city-level location from the request IP** by default. **No advertising identifier.** Events tied to this ID are linked to the installation/device under Apple's App Privacy definition, even though they are not tied to a name or email.                                                                                                                                                                 | PostHog RN defaults; `expo-device`, `expo-application`, `expo-localization`                                                                                                                                                               |
| Event content           | Events include what you read and search: `article_viewed` sends `content_title`/`content_id`, and `content_searched` sends the **raw query text**. `onboarding_complete` sends selected government vectors, sectors, and instant/evening alert choices. Saves, filters, ballot interactions, and feedback events are also recorded.                                                                                                                                                                                                                                                                                                                                                     | `apps/expo/src/app/article-detail.tsx`; `(tabs)/index.tsx`; `components/onboarding/OnboardingFlow.tsx`                                                                                                                                    |
| Election address        | **Typed by the user, or resolved from a one-shot device location fix.** `AddressAutocomplete` offers "Use my location": `expo-location` asks for foreground permission once, takes a single fix, and hands the coordinate to the OS geocoder for a street address — no background tracking, no watch loop. The voter can always type instead, and the confirmed address is stored on-device in the iOS Keychain via `expo-secure-store`. Keychain data may survive uninstall/reinstall; clearing the address in Settings removes the local saved value. Only the confirmed address text is sent to the backend. Failed geocoding asks for manual entry; it does not submit coordinates. | `apps/expo/src/hooks/useDeviceAddress.ts`; `apps/expo/src/components/AddressAutocomplete.tsx`; `apps/expo/src/utils/address.ts`; `apps/expo/src/utils/client-storage.ts`; `app.config.base.json` (foreground-only `expo-location` plugin) |
| Address → third parties | **No third party receives address text to autocomplete it any more** — the Google Places path is deleted, and the device fix is passed to the OS geocoder, which may send coordinates to Apple or another device geocoding provider under its own privacy terms. A confirmed address is forwarded to **Democracy Works** for ballot lookup and the **Google Civic Information API** for district lookup. **Open States does not receive the street address**; the backend uses public Open States state-level data after Google resolves the relevant divisions. The `voter_address_set` analytics event sends only `{ is_update }`, **not** the address.                               | `packages/api/src/lib/civic.ts`, `lib/elected-officials.ts`; `(tabs)/elections.tsx`                                                                                                                                                       |
| Address retention       | Server caches lookup **results** in `CivicApiCache` keyed by **SHA-256 of the normalized address** (not the raw address). Address-based freshness windows: voter info 24h and divisions 30d. Cached responses can contain the submitted address (Democracy Works) or normalized address components. Expired rows are excluded from cache reads, not automatically deleted; clearing the device address does not remove server caches. The cache is not joined to an app account or the PostHog installation ID, but a physical address is inherently identifying and is treated as linked under Apple's App Privacy definition.                                                         | `packages/api/src/lib/civic.ts` (`hashAddress`, `getCached`/`setCache`, `CACHE_TTL`)                                                                                                                                                      |
| Feedback                | The production Feedback tab opens **Google Forms** for bug/feature feedback and the user's mail client for content issues or direct email. Prefilled details can include the message, category, app version/build, platform, and OS version. Email feedback also exposes the sender address and standard email headers. The otherwise hidden Settings feedback route can submit the same core fields through the backend and **Resend**.                                                                                                                                                                                                                                                | `apps/expo/src/app/(tabs)/feedback.tsx`; `apps/expo/src/utils/feedback-form.ts`; `apps/expo/src/app/settings/feedback.tsx`; `packages/api/src/router/feedback.ts`                                                                         |
| Website mailing list    | `billion-news.app` collects an email via `/api/waitlist`, stored as a **Resend contact** in the General updates segment/topic with a confirmation email. Website also runs PostHog (`posthog-js`). This is a **website** flow — not part of the iOS app's data collection.                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/nextjs/src/app/_components/waitlist-form.tsx`; `apps/nextjs/src/app/api/waitlist/route.ts`                                                                                                                                          |
| Error diagnostics       | No dedicated crash SDK. PostHog automatic exception capture is disabled in the production project, and session replay is not enabled. One handled failure to open an original-source URL is sent with `captureException`. Lifecycle events record install/update/open/active/background state, not launch time, hang rate, energy use, or other performance measurements.                                                                                                                                                                                                                                                                                                               | `apps/expo/src/app/article-detail.tsx`; production PostHog remote config verified 2026-07-24                                                                                                                                              |
| Data sold               | No. No data brokers, no advertising, no cross-app tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                                                         |

### Processors (sub-processors)

- **PostHog** (US) — product analytics + diagnostics (app and website).
- **Resend** — transactional/marketing email: feedback delivery + mailing-list confirmation and audience management.
- **Google Forms** — guided bug and feature feedback.
- **Democracy Works** — confirmed address → ballot lookup.
- **Google Civic Information API** — confirmed address → district lookup. No address text is sent for autocomplete.
- **Operating-system geocoding service** — optional current coordinates → draft street address. The service may send coordinates to Apple or another device geocoding provider; this is not a guarantee of on-device processing. Billion does not send raw coordinates to its backend or analytics or persist them.
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

Historical reachability checks from 2026-07-24 (recheck before release):

- `https://billion-news.app/privacy` → 200, "Privacy Policy" ✓ (route live)
- `https://billion-news.app/terms` → 200, "Terms of Service" ✓ (route live)
- `https://billion-news.app/support` → public support contact and FAQ
- In-app (**production**): `Feedback tab → Terms and Privacy Policy` → `settings/terms` ✓
- In-app (dev only): `Settings → Privacy → Read full Privacy Policy`, and
  `Settings → About Billion → Privacy policy / Terms of service`

> **Historical July 2026 navigation finding:** The Settings tab was hidden in release builds (`(tabs)/_layout.tsx` sets
> `href: __DEV__ ? undefined : null`, and `TabBar.tsx` skips it when `!__DEV__`). Settings was
> the only route into the legal copy, so before the Feedback-tab link above, Terms and Privacy
> were unreachable in production. Keep a legal entry point on a tab that ships, or this
> acceptance criterion silently regresses.

> **Release step:** Deploy the revised website policy before submitting the native-location
> build to App Review. Recheck that the public privacy page shows “Last updated October 18,
> 2026” and matches the label. Source changes do not publish the policy or update App Store
> Connect; neither external action was performed as part of the October 18 disclosure fix.

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

| Apple data type                         | Purpose           | Linked | Tracking | Why (source)                                                                                                                                |
| --------------------------------------- | ----------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contact Info → Email Address**        | App Functionality | Yes    | No       | A user who chooses an email feedback path sends us their sender address. See optional-disclosure note below.                                |
| **Contact Info → Physical Address**     | App Functionality | Yes    | No       | Confirmed addresses are used for civic lookup; cached responses may retain the submitted address or normalized components.                  |
| **Location → Precise Location**         | App Functionality | Yes    | No       | A confirmed street address derived from a current location fix can reveal precise location and be retained in lookup responses.             |
| **Location → Coarse Location**          | Analytics         | Yes    | No       | PostHog derives approximate city-level location from IP and stores it with the installation ID.                                             |
| **User Content → Customer Support**     | App Functionality | Yes    | No       | Feedback messages go through Google Forms, email, or the backend/Resend path; email feedback links the message to the sender.               |
| **Search History**                      | Analytics         | Yes    | No       | `content_searched` sends the raw query text to PostHog with the installation ID.                                                            |
| **Identifiers → Device ID**             | Analytics         | Yes    | No       | PostHog's persistent random install `distinct_id` (not IDFA).                                                                               |
| **Usage Data → Product Interaction**    | Analytics         | Yes    | No       | Screens, article opens, taps, filters, onboarding selections, ballot interactions, and feedback events are stored with the installation ID. |
| **Diagnostics → Other Diagnostic Data** | App Functionality | Yes    | No       | A handled source-opening error and its context are sent to PostHog with the installation ID.                                                |

**Explicitly NOT collected by the iOS app:** Name, Phone Number, User ID; Payment, Financial, Purchases, Credit info; Health & Fitness; Contacts; Browsing History;
Audio; Photos/Videos; Sensitive Info (including political affiliation — viewing civic content
does not establish the user's political opinion); Advertising Data / IDFA; Crash Data; and
Performance Data.

### Location classification (reviewed 2026-10-18)

Declare **Precise Location**, **App Functionality**, **Linked: Yes**, **Tracking: No**.
This supersedes the earlier #414 assessment that classified only Physical Address.
The retained derived location matters independently of the raw-coordinate path.
This is a conservative application of [Apple's App Privacy definitions](https://developer.apple.com/app-store/app-privacy-details/):
precision describes the information, not just its coordinate encoding. Although raw GPS
coordinates are only passed to the OS geocoder and never sent to Billion's servers or
analytics, a confirmed street address derived from that fix can itself reveal a precise
current location. Lookup responses retain that address beyond the immediate request.
Apple's guidance excludes collection by Apple frameworks themselves; the retained derived
address is the basis for this classification, not the permission prompt alone.

The checked-in manifest, website policy, and in-app English, Spanish, and Chinese copy
now reflect this assessment. The App Store Connect questionnaire and deployed public policy
remain release steps (§2 and §5); this document does not assert they have been updated.

### Disclosure notes

1. **Physical Address.** Declare it. Although the raw address is used to service the civic
   feature and the cache key is a one-way hash, cached response data may contain the submitted address or normalized
   address components. The 24-hour/30-day freshness windows do not enforce deletion. Because the address itself can identify a person or
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

`apps/expo/app.config.base.json` declares the same nine collected-data types listed in §3.
Expo writes those declarations into `apps/expo/ios/billion/PrivacyInfo.xcprivacy` during
prebuild. After `just build ios`, confirm:

- `NSPrivacyTracking = false`, `NSPrivacyTrackingDomains` empty (PostHog is first-party
  analytics, not tracking).
- Required-Reason API declarations are present for what the SDKs use, e.g. **UserDefaults**
  (`CA92.1`, via AsyncStorage), and any **File Timestamp / System Boot Time / Disk Space** reasons
  pulled in by Expo/PostHog.
- Collected-data types in the manifest match §3.

---

## 5. App Store Connect release checklist (requires Apple credentials)

Complete these external updates before submitting the native-location build:

1. **App Privacy → Privacy Policy URL:** set `https://billion-news.app/privacy`.
2. **App Information → Support URL:** set `https://billion-news.app/support`. (Optional
   Marketing URL: `https://billion-news.app`.)
3. **App Privacy → Data Collection:** answer "Yes", then enter exactly the nine types in §3
   with the listed purposes; for each set _Linked to You = Yes_ and _Used to Track You = No_.
   If deliberately relying on Apple's optional support-data exception, omit Email Address and
   Customer Support together and record the decision in §3.
4. **App Privacy → confirm** the label preview includes **Precise Location** under data linked to you for app functionality and shows **no** "Data Used to Track You" section.
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
- **Contact address — temporary fallback.** The public-facing contact is
  `thatxliner@gmail.com` across the legal copy, the in-app privacy screen, the Feedback tab,
  and the `FEEDBACK_TO_EMAIL` default while the organization inbox is unavailable.
- **No terms acceptance gate.** First-launch onboarding now exists, but it does not mention or
  link the Terms or Privacy Policy. Add an explicit notice before accounts, purchases, or EU
  availability if affirmative acceptance is required.
