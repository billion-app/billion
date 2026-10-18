import type { Metadata } from "next";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Billion",
};

const LAST_UPDATED = "October 18, 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Billion does not require an account, and the app does not ask for your name or email address to read summaries or view your ballot. During onboarding, the app asks which governments and topics you want to follow and whether you prefer instant or evening alerts. It stores those answers on your device. If an authenticated session already exists, the app also stores topic and content-type selections with that account. If you join the mailing list in the app or on our website, we collect the email address you submit. In the app, if you enter a registered address to load your local ballot and representatives, the confirmed address is sent to our servers for lookup. You can type it or optionally fill it using your current location, as described in Section 4. If you send feedback, we may receive your message, the category you choose, basic technical details such as app version and build, platform, and operating-system version, and when you contact us by email, your email address and standard email headers. When you use the app or website, our analytics automatically collect usage events such as screens viewed, articles opened, searches you run, and onboarding selections, plus handled error diagnostics and technical details such as device model, operating system and version, app version, language, and time zone. These events are associated with a randomly generated, persistent installation identifier. We do not use advertising identifiers.",
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
    body: "You can type your registered voting address or choose “Use my location.” If you grant foreground location permission, Billion requests one current location fix, which may be precise, and asks the operating system’s geocoding service to turn it into an address. That service may send coordinates to Apple or another device geocoding provider under its own privacy terms. Billion does not send the raw coordinates to its servers or analytics, save them, or track your location in the background. The filled address is a draft: confirm or correct it before saving, because your current location may differ from your registered voting address. Typing does not send address text for autocomplete. The confirmed address is stored in secure storage on your mobile device. When you run a civic lookup, it goes through our servers to Democracy Works for ballot information or Google Civic Information API for district information. Open States supplies public representative data without receiving your street address. Server caches use a one-way hash as the key, but cached responses can contain the submitted address or normalized address components. We do not join the address to an app account or analytics identifier or use it for advertising or cross-app tracking. An address derived from your current location can reveal your precise location, so our Apple privacy disclosures include Physical Address and Precise Location as linked data used for app functionality.",
  },
  {
    title: "5. Analytics and Diagnostics",
    body: "We use PostHog to understand how Billion is used and to diagnose handled application errors. When onboarding finishes, the analytics event includes the government categories and topics you selected and your instant or evening alert choices. The app does not automatically send crash reports or performance measurements such as hang rate or energy use. App analytics are associated with a randomly generated, persistent installation identifier, which links events from the same app installation or device but is not your name, email address, or an advertising identifier. Because searches and usage events are associated with that identifier, Apple's App Privacy label describes Search History, Device ID, Usage Data, and related diagnostics as \"Data Linked to You.\" PostHog may infer an approximate, city-level location from the request IP address. We do not use this information to track you across other companies' apps or websites. Analytics data is processed by PostHog in the United States.",
  },
  {
    title: "6. Data Sharing",
    body: "We share information only with service providers that help us operate Billion, and only as needed to run the service: PostHog for analytics and handled-error diagnostics; Resend for waitlist and some feedback email delivery; Google Forms for guided feedback; Democracy Works for address-based ballot lookups; and Google Civic Information API for district lookups. Optional location-based address filling also uses the operating system’s geocoding service, as described in Section 4. Open States supplies public representative data without receiving your street address. We require these providers to protect information they process for us and not use it for their own marketing. We may also disclose information if we are required to by law.",
  },
  {
    title: "7. Data Retention",
    body: "Billion does not currently offer a usable account sign-in flow in the app. Your onboarding choices remain on your device until you uninstall the app or the app resets its versioned onboarding record. If an authenticated session already exists, topic and content-type selections may also remain in the account's server record. Mailing list email addresses are retained until you unsubscribe or ask us to delete them. Feedback is retained in Google Forms or email so that we can act on it. Your saved address remains on your device until you change or clear it. On iOS, secure storage may survive uninstalling and reinstalling the app. Server lookup caches can retain the submitted address or normalized address components. Cached ballot results stop being reused after 24 hours and district results after 30 days; expiry does not automatically delete stored responses. Clearing your address on the device does not delete server caches. Analytics and handled-error diagnostic data are retained by our analytics provider according to its retention settings.",
  },
  {
    title: "8. Your Choices",
    body: "You can control your information in several ways. You can edit or clear your saved address in Settings → Location at any time. You can type an address without granting location permission, and revoke permission in your device settings. Clear the saved address before uninstalling if you want to remove it from iOS secure storage. Uninstalling stops further analytics collection from that installation. You can unsubscribe from mailing list emails at any time. You may also email thatxliner@gmail.com to request access to, or deletion of, information we hold about you, such as your waitlist email address, feedback you sent, or preferences attached to an authenticated account, and we will honor applicable requests.",
  },
  {
    title: "9. Security",
    body: "We use commercially reasonable measures to protect your information, including storing your address in your device's secure storage and encrypting data in transit. No method of transmission or storage is completely secure, however, and we cannot guarantee absolute security.",
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
