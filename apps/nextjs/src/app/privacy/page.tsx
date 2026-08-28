import type { Metadata } from "next";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Billion",
};

const LAST_UPDATED = "July 24, 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Billion does not require an account, and the app does not ask for your name or email address to read summaries or view your ballot. What we collect depends on how you use Billion. On our website, if you join the waitlist we collect the email address you submit. In the app, if you enter a registered address to load your local ballot and representatives, address text is sent to our servers for autocomplete and lookup, as described in Section 4. If you send feedback, we may receive your message, the category you choose, basic technical details such as app version and build, platform, and operating-system version, and—when you contact us by email—your email address and standard email headers. When you use the app or website, our analytics automatically collect usage events (such as screens viewed, articles opened, and searches you run), handled error diagnostics, and technical details such as device model, operating system and version, app version, language, and time zone. These events are associated with a randomly generated, persistent installation identifier. We do not collect your precise device location, and we do not use advertising identifiers.",
  },
  {
    title: "2. Waitlist and Landing Page",
    body: "When you sign up for our waitlist on our website, we collect your email address to notify you when the App becomes available and to send occasional updates about Billion. Waitlist addresses are stored with our email provider, and we send a confirmation email. You can unsubscribe at any time using the link in our emails or by emailing billionnewsapp@gmail.com.",
  },
  {
    title: "3. How We Use Your Information",
    body: "We use the information we collect to operate, maintain, and improve Billion; to look up the ballot and representatives for an address you enter; to respond to your feedback; to send waitlist and service-related communications; to keep our services secure; and to comply with legal obligations. We do not sell your personal information, and we do not use it to serve you advertising.",
  },
  {
    title: "4. Address and Location",
    body: "Billion does not access your device's GPS or precise location. To show your local ballot and representatives, you type in a registered address. The selected address is stored on your device using the operating system's secure storage. As you type, address text is sent through our servers to Google Places for autocomplete; when a ballot or representative lookup runs, the address is sent through our servers to the Google Civic Information API. Open States supplies public representative data, but we do not send it your street address. We cache lookup results under a one-way hash of the address rather than storing the address as the cache key. Cached responses may contain normalized address components and expire automatically, within about thirty days. We do not join the address to an app account or to the analytics installation identifier, and we never use it for advertising or cross-app tracking. Apple's App Privacy label calls a physical address \"Data Linked to You\" because an address can identify a person or household, even though Billion does not join it to the analytics identifier. You can change or clear your saved address in the app at any time.",
  },
  {
    title: "5. Analytics and Diagnostics",
    body: "We use PostHog to understand how Billion is used and to diagnose handled application errors. The app does not automatically send crash reports or performance measurements such as hang rate or energy use. App analytics are associated with a randomly generated, persistent installation identifier, which links events from the same app installation or device but is not your name, email address, or an advertising identifier. Because searches and usage events are associated with that identifier, Apple's App Privacy label describes Search History, Device ID, Usage Data, and related diagnostics as \"Data Linked to You.\" PostHog may infer an approximate, city-level location from the request IP address. We do not use this information to track you across other companies' apps or websites. Analytics data is processed by PostHog in the United States.",
  },
  {
    title: "6. Data Sharing",
    body: "We share information only with service providers that help us operate Billion, and only as needed to run the service: PostHog for analytics and handled-error diagnostics; Resend for waitlist and some feedback email delivery; Google Forms for guided feedback; Google Places for address autocomplete; and the Google Civic Information API for address-based ballot and district lookups. Open States supplies public representative data without receiving your street address. We require these providers to protect information they process for us and not use it for their own marketing. We may also disclose information if we are required to by law.",
  },
  {
    title: "7. Data Retention",
    body: "Because Billion has no app user accounts, we do not build an account-based profile about app users. Waitlist email addresses are retained until you unsubscribe or ask us to delete them. Feedback is retained in Google Forms or email so that we can act on it. Your selected registered address remains on your device until you change it, clear it, or uninstall the app; server lookup caches use a hashed address key, may contain normalized address components, and expire automatically within about thirty days. Analytics and handled-error diagnostic data are retained by our analytics provider according to its retention settings.",
  },
  {
    title: "8. Your Choices",
    body: "You can control your information in several ways. You can edit or clear your saved address in the app at any time, and uninstalling the app removes it from your device. Uninstalling the app also stops any further analytics collection from it. You can unsubscribe from waitlist emails at any time. You may also email billionnewsapp@gmail.com to request access to, or deletion of, the information we hold about you — such as your waitlist email address or feedback you have sent — and we will honor applicable requests.",
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
    body: "Questions about this Privacy Policy or your data? Email us at billionnewsapp@gmail.com.",
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
