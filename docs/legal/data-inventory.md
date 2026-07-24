# Billion — Verified Data Inventory & App Store Privacy Answers

**Scope:** Summer 2026 read-only release (iOS app `app.billion-news.billion`, ASC app ID
`6761675243`) and the marketing/legal website `billion-news.app`.

**Review owner:** thatxliner (project owner, `thatxliner@gmail.com`)
**Reviewed:** 2026-07-23 against the release candidate on `main`
**Legal effective date ("Last updated"):** July 23, 2026

This is the single source of truth that the legal copy (`/terms`, `/privacy`, in-app
`settings/terms`) and the App Store Connect privacy answers are derived from. If any of
the behavior below changes, update this file first, then the copy and the ASC answers so
all three stay in agreement.

---

## 1. How the release actually behaves (verified in code)

| Area                    | Finding                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Accounts                | **No account and no sign-in exist in the app.** There is no login / Discord / sign-up / waitlist screen anywhere in `apps/expo`; the only matches are inside the legal copy. `better-auth` (Discord OAuth) is wired server-side but never reachable from the app UI. Core use (feed, articles, ballot, feedback) needs no account. | `apps/expo/src/app/**` (no auth screens); `packages/auth/src/index.ts`; `packages/api/src/router/auth.ts`                     |
| Analytics SDK           | **PostHog is the only analytics/telemetry SDK.** No Sentry, Firebase, Segment, Amplitude, ad SDKs, Facebook SDK, AppsFlyer/Adjust/Branch, and no IDFA/AppTrackingTransparency. US cloud (`https://us.i.posthog.com`).                                                                                                              | `apps/expo/package.json`; `apps/expo/src/config/posthog.ts`; `apps/expo/.env`                                                 |
| PostHog config          | `captureAppLifecycleEvents: true`; autocapture `captureTouches: true` / `captureScreens: false`, `propsToCapture: ["testID"]`. Manual `screen()` on every navigation. `identify()` is called only when a user exists — which never happens (no sign-in), so events stay tied to the random install ID.                             | `apps/expo/src/app/_layout.tsx`                                                                                               |
| Identifiers             | PostHog's randomly generated per-install **`distinct_id`** (a Device ID), plus automatic device/app properties: device model, OS + version, app version/build, locale, time zone, network type. PostHog Cloud derives approximate **city-level location from the request IP** by default. **No advertising identifier.**           | PostHog RN defaults; `expo-device`, `expo-application`, `expo-localization`, `expo-network`                                   |
| Event content           | Events include what you read and search: `article_viewed` sends `content_title`/`content_id`; `content_searched` sends the **raw query text**; plus saves, filters, ballot interactions, feedback events. So reading/search activity **does** leave the device.                                                                    | `apps/expo/src/app/article-detail.tsx`, `(tabs)/index.tsx`, `(tabs)/elections.tsx`                                            |
| Election address        | **Typed by the user — the app never reads GPS.** No `expo-location`, no `NSLocation*` usage strings. Stored on-device in the iOS Keychain via `expo-secure-store`. Sent to the backend only for a lookup.                                                                                                                          | `apps/expo/src/hooks/useUserAddress.ts`; `apps/expo/src/utils/client-storage.ts`; `app.config.base.json` (no location plugin) |
| Address → third parties | On lookup the address is forwarded to **Google Civic Information API**, **Google Places** (autocomplete), and **Open States** (representatives). The `voter_address_set` analytics event sends only `{ is_update }`, **not** the address.                                                                                          | `packages/api/src/lib/civic.ts`, `lib/places.ts`, `lib/elected-officials.ts`; `(tabs)/elections.tsx`                          |
| Address retention       | Server caches lookup **results** in `CivicApiCache` keyed by **SHA-256 of the normalized address** (not the raw address). TTLs: voter info 24h, divisions 30d, elections 7d. The cached response body may contain normalized address components. Not linked to any account.                                                        | `packages/api/src/lib/civic.ts` (`hashAddress`, `getCache`/`setCache`, `CACHE_TTL`)                                           |
| Feedback                | Sent via **Resend** email to `FEEDBACK_TO_EMAIL` (default `thatxliner@gmail.com`). Payload: message, category, app version/build, platform, OS version — plus `userId`/`userEmail` **only if a session exists** (never, in this release).                                                                                          | `packages/api/src/router/feedback.ts`; `apps/expo/src/app/settings/feedback.tsx`                                              |
| Website waitlist        | `billion-news.app` collects an email via `/api/waitlist`, stored as a **Resend contact/audience** with a confirmation email. Website also runs PostHog (`posthog-js`). This is a **website** flow — not part of the iOS app's data collection.                                                                                     | `apps/nextjs/src/app/_components/waitlist-form.tsx`; `apps/nextjs/src/app/api/waitlist/route.ts`                              |
| Crash reporting         | No dedicated crash SDK; exceptions go to PostHog via `captureException`.                                                                                                                                                                                                                                                           | `apps/expo/src/app/article-detail.tsx`                                                                                        |
| Data sold               | No. No data brokers, no advertising, no cross-app tracking.                                                                                                                                                                                                                                                                        | —                                                                                                                             |

### Processors (sub-processors)

- **PostHog** (US) — product analytics + diagnostics (app and website).
- **Resend** — transactional/marketing email: feedback delivery + waitlist confirmation & audience.
- **Google Civic Information API**, **Google Places** — address → ballot / autocomplete.
- **Open States** (Plural Policy) — address → current representatives.

---

## 2. Production URLs for App Store Connect

Canonical domain is **`billion-news.app`** — it is the Next.js `metadataBase` in production
and the production API host (`https://www.billion-news.app`). Both legal pages are **live over
HTTPS** and match the repo (verified 2026-07-23).

> ⚠️ `billion.app` is **not ours** — it redirects to a GoDaddy "for sale" parked page. Do not
> use it anywhere. The old in-app "Visit billion.app" link and some scraper `User-Agent`
> strings still reference it (see §6).

| App Store Connect field           | Value                              |
| --------------------------------- | ---------------------------------- |
| **Privacy Policy URL** (required) | `https://billion-news.app/privacy` |
| **Support URL** (required)        | `https://billion-news.app`         |
| Marketing URL (optional)          | `https://billion-news.app`         |

Reachability (acceptance criterion — "reachable over public HTTPS"):

- `https://billion-news.app/privacy` → 200, "Privacy Policy" ✓ (route live)
- `https://billion-news.app/terms` → 200, "Terms of Service" ✓ (route live)
- In-app (**production**): `Feedback tab → Terms and Privacy Policy` → `settings/terms` ✓
- In-app (dev only): `Settings → Privacy → Read full Privacy Policy`, and
  `Settings → About Billion → Privacy policy / Terms of service`

> ⚠️ **The Settings tab is hidden in release builds** (`(tabs)/_layout.tsx` sets
> `href: __DEV__ ? undefined : null`, and `TabBar.tsx` skips it when `!__DEV__`). Settings was
> the only route into the legal copy, so before the Feedback-tab link above, Terms and Privacy
> were unreachable in production. Keep a legal entry point on a tab that ships, or this
> acceptance criterion silently regresses.

> ⚠️ **Redeploy required.** As of 2026-07-23 the live pages still serve the previous copy
> ("Last updated April 5, 2026"). The revised text in this repo goes live only after
> `apps/nextjs` is redeployed to `billion-news.app`. Redeploy **before** submitting to App
> Review so the ASC privacy-policy URL matches the label. The in-app copy ships with the new
> binary. Re-verify both pages show "Last updated July 23, 2026" after deploy.

> These two URL fields are entered in App Store Connect's UI (see §5). They are **not** stored
> in the repo today. If you adopt the `eas metadata` workflow, the template in §5 codifies them.

---

## 3. App Store "App Privacy" answers (iOS app)

Derived entirely from §1. **"Data collected? → Yes."** For **every** type below:
**Linked to the user's identity? → No** (the app has no account) and **Used for tracking? →
No** (no IDFA, no data broker sharing, no cross-app/website tracking). The app therefore does
**not** require App Tracking Transparency.

| Apple data type                       | Collected | Purpose                              | Why (source)                                                                                            |
| ------------------------------------- | --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Contact Info → Physical Address**   | Yes       | App Functionality                    | The registered address typed to load the local ballot (§1 "Election address"). See judgment call below. |
| **Location → Coarse Location**        | Yes       | Analytics                            | PostHog derives approximate city-level location from IP by default. See judgment call below.            |
| **Identifiers → Device ID**           | Yes       | Analytics                            | PostHog random install `distinct_id` (not IDFA).                                                        |
| **Usage Data → Product Interaction**  | Yes       | Analytics                            | Screens, article opens, saves, filters, ballot interactions, feedback events.                           |
| **Search History**                    | Yes       | Analytics                            | `content_searched` sends the raw query text to PostHog.                                                 |
| **Diagnostics → Crash Data**          | Yes       | Analytics                            | PostHog `captureException`.                                                                             |
| **Diagnostics → Performance Data**    | Yes       | Analytics                            | PostHog app-lifecycle / performance events.                                                             |
| **User Content → Other User Content** | Yes       | App Functionality (Customer Support) | Free-text feedback message + category, emailed via Resend.                                              |

**Explicitly NOT collected by the iOS app:** Name, Email Address, Phone Number (email is a
_website_ waitlist flow, not the app; feedback attaches an email only if signed in, which is
impossible here); Precise Location / GPS; Payment, Financial, Purchases, Credit info; Health &
Fitness; Contacts; Browsing History; Audio; Photos/Videos; Sensitive Info (incl. political
affiliation — viewing civic content does not record your views); Advertising Data / IDFA.

### Two judgment calls (need review-owner sign-off)

1. **Physical Address.** Argument for _not_ declaring: it's used only to service the ballot
   feature, forwarded transiently, and cached under a one-way hash. Argument for declaring: the
   result cache (with normalized components) persists up to ~30 days, which exceeds "time to
   service the request." **Recommendation: declare it** (App Functionality, not linked, not
   tracking) — over-declaring is the safe, honest choice for App Review.

2. **Coarse Location (IP).** The recommended answer above **matches current behavior** (PostHog
   geo-IP is on) and the policy's city-level disclosure, so copy + label + SDK agree with no
   code change. _Alternative if you want a cleaner label:_ disable IP/geo-IP in PostHog, then
   answer **Coarse Location: not collected** and delete the "city-level location" sentence from
   `/privacy` §5. Pick one; keep all three surfaces consistent either way.

_Optional data-minimization (not required for launch):_ stop sending the raw `content_searched`
query text (send only length/filter) to drop **Search History** from the label.

---

## 4. Apple Privacy Manifest & Required-Reason APIs (verify after `expo prebuild`)

The app is managed-workflow (no committed `ios/`), so `PrivacyInfo.xcprivacy` is generated at
prebuild by Expo and merged with PostHog's SDK manifest. After `just build ios`, confirm the
generated manifest:

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
2. **App Information → Support URL:** set `https://billion-news.app`. (Optional Marketing URL:
   same.)
3. **App Privacy → Data Collection:** answer "Yes", then enter exactly the eight types in §3
   with the listed purposes; for each set _Linked to You = No_ and _Used to Track You = No_.
   Resolve the two judgment calls in §3 first.
4. **App Privacy → confirm** the label preview shows **no** "Data Used to Track You" section.
5. Cross-check the published label against `https://billion-news.app/privacy` so they agree
   (acceptance criterion).

_Optional as-code path (only if you use `eas metadata`):_ create `apps/expo/store.config.json`
and `eas metadata:push`. Minimal shape:

```jsonc
{
  "configVersion": 0,
  "apple": {
    "info": {
      "en-US": { "privacyPolicyUrl": "https://billion-news.app/privacy" },
    },
    "advisory": {},
    "version": {
      "en-US": {
        "marketingUrl": "https://billion-news.app",
        "supportUrl": "https://billion-news.app",
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
- **Two different contact addresses.** The legal copy tells users to email
  `thatxliner@gmail.com`, but the production-visible Feedback tab uses
  `billionnewsapp@gmail.com` (`(tabs)/feedback.tsx`). Pick one for the public-facing
  privacy/support contact so the policy, the app, and the App Store Support URL agree.
- **No acceptance gate.** There is no onboarding or first-launch flow, so users never
  affirmatively accept the Terms. Not required by Apple for a no-account, read-only app, but a
  first-launch notice ("By continuing you agree to…") linking both documents would materially
  improve enforceability. Revisit before accounts, purchases, or EU availability.
