import type { Metadata } from "next";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Billion",
};

const LAST_UPDATED = "October 18, 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Billion does not require an account, and the app does not ask for your name or email address to read summaries or view your ballot. During onboarding, the app asks which governments and topics you want to follow and whether you prefer instant or evening alerts. It stores those answers on your device. If an authenticated session already exists, the app also stores topic and content-type selections with that account. If you join the mailing list in the app or on our website, we collect the email address you submit. In the app, if you enter a registered address to load your local ballot and representatives, the address you confirm is sent to our servers for lookup, as described in Section 4. If you send feedback, we may receive your message, the category you choose, basic technical details such as app version and build, platform, and operating-system version, and when you contact us by email, your email address and standard email headers. When you use the app or website, our analytics automatically collect usage events such as screens viewed, articles opened, searches you run, and onboarding selections, plus handled error diagnostics and technical details such as device model, operating system and version, app version, language, and time zone. These events are associated with a randomly generated, persistent installation identifier. If you choose “Use my location,” the app accesses your device location with your permission to suggest an address, as described in Section 4. We do not send device coordinates to Billion or our analytics provider, and we do not use advertising identifiers.",
  },
  {
    title: "2. Mailing List",
    body: "When you join our mailing list in the app or on our website, we collect your email address to send feature releases and occasional civic updates about Billion. Mailing list addresses are stored with our email provider, and we send a confirmation email. You can unsubscribe at any time using the link in our emails or by emailing thatxliner@gmail.com.",
  },
  {
    title: "3. How We Use Your Information",
    body: "We use the information we collect to operate, maintain, and improve Billion; remember your setup choices and show relevant connection labels; understand how readers use onboarding; look up the ballot and representatives for an address you enter; respond to your feedback; send waitlist and service-related communications; keep our services secure; and comply with legal obligations. We do not sell your personal information, and we do not use it to serve you advertising.",
  },
  {
    title: "4. Address and Location",
    body: "You can type your registered voting address or choose “Use my location.” With your permission, the app takes one foreground location fix, which may be precise, and uses the operating system’s geocoder to suggest a street address. The geocoder may send coordinates to the platform provider’s servers under its privacy policy. Billion does not receive or store those device coordinates, send them to analytics, or track your location in the background. Review or edit the suggested address and confirm it before lookup; if location or geocoding fails, you can type instead. We do not send address text for autocomplete. Only the address you confirm is sent through our servers to Democracy Works for ballot lookup and the Google Civic Information API for district lookup. Open States supplies public representative data without receiving your street address. When you save an address, it is stored in secure storage in the native app or local browser storage on the web. Lookup results are cached under a one-way address hash; cached responses may include normalized address components and stop being reused after at most thirty days. This expiry does not delete the stored records; see Section 7. We do not join the address to an app account or analytics installation identifier, or use it for advertising or cross-app tracking. Apple’s App Privacy label treats a physical address as “Data Linked to You” because it can identify a person or household. You can change or clear your saved address in the app and revoke location permission in your device settings.",
  },
  {
    title: "5. Analytics and Diagnostics",
    body: "We use PostHog to understand how Billion is used and to diagnose handled application errors. When onboarding finishes, the analytics event includes the government categories and topics you selected and your instant or evening alert choices. The app does not automatically send crash reports or performance measurements such as hang rate or energy use. App analytics are associated with a randomly generated, persistent installation identifier, which links events from the same app installation or device but is not your name, email address, or an advertising identifier. Because searches and usage events are associated with that identifier, Apple's App Privacy label describes Search History, Device ID, Usage Data, and related diagnostics as \"Data Linked to You.\" PostHog may infer an approximate, city-level location from the request IP address. We do not use this information to track you across other companies' apps or websites. Analytics data is processed by PostHog in the United States.",
  },
  {
    title: "6. Data Sharing",
    body: "We share information only with service providers that help us operate Billion, and only as needed to run the service: PostHog for analytics and handled-error diagnostics; Resend for waitlist and some feedback email delivery; Google Forms for guided feedback; Democracy Works for address-based ballot lookups; and the Google Civic Information API for district lookups. If you use device location, the operating system’s geocoder processes coordinates as described in Section 4. Open States supplies public representative data without receiving your street address. We require these providers to protect information they process for us and not use it for their own marketing. We may also disclose information if we are required to by law.",
  },
  {
    title: "7. Data Retention",
    body: "Billion does not currently offer a usable account sign-in flow in the app. Your onboarding choices remain on your device until you uninstall the app or the app resets its versioned onboarding record. If an authenticated session already exists, topic and content-type selections may also remain in the account's server record. Mailing list email addresses are retained until you unsubscribe or ask us to delete them. Feedback is retained in Google Forms or email so that we can act on it. Your saved registered address remains on your device until you change or clear it. On iOS, secure storage can survive uninstalling and reinstalling the app; clear the address in the app before uninstalling if you want to remove it. On the web, you can also clear the site’s local storage. Server lookup caches use a hashed address key and may contain normalized address components. Cached results stop being reused after at most thirty days, but expired records can remain stored until they are replaced or deleted. We do not currently run scheduled deletion of expired lookup records. Clearing an address on your device does not delete server records; you can request deletion using the contact below. Analytics and handled-error diagnostic data are retained by our analytics provider according to its retention settings.",
  },
  {
    title: "8. Your Choices",
    body: "You can control your information in several ways. You can edit or clear your saved address in the app at any time. Clear your saved address before uninstalling; iOS secure storage may persist after reinstall. Uninstalling stops further app analytics collection from that installation. To remove web preferences, clear the site’s local storage. You can unsubscribe from mailing list emails at any time. You may also email thatxliner@gmail.com to request access to, or deletion of, information we hold about you, such as your waitlist email address, feedback you sent, or preferences attached to an authenticated account, and we will honor applicable requests.",
  },
  {
    title: "9. Security",
    body: "We use commercially reasonable measures to protect your information, including using secure storage for saved addresses in the native app (local browser storage on the web) and encrypting data in transit. No method of transmission or storage is completely secure, however, and we cannot guarantee absolute security.",
  },
  {
    title: "10. Children's Privacy",
    body: "Our services are not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we learn that we have collected such information, we will delete it promptly.",
  },
  {
    title: "11. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. When we do, we will revise the 'Last updated' date shown above, and where we have your contact information — for example, if you joined our waitlist — we may notify you by email.",
  },
  {
    title: "12. Contact",
    body: "Questions about this Privacy Policy or your data? Email us at thatxliner@gmail.com.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      crossLinkHref="/terms"
      crossLinkLabel="Terms of Service"
    />
  );
}
