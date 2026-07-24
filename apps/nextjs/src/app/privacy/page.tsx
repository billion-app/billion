import type { Metadata } from "next";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Billion",
};

const LAST_UPDATED = "July 23, 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Billion does not require an account, and the app does not ask for your name or email address to read summaries or view your ballot. What we collect depends on how you use Billion. On our website, if you join the waitlist we collect the email address you submit. In the app, if you enter a registered address to load your local ballot and representatives, that address is stored on your device and sent to our servers only to perform the lookup, as described in Section 4. If you send feedback, we receive your message, the category you choose, and basic technical details such as app version and build, platform, and operating-system version. When you use the app or website, our analytics automatically collect usage events (such as screens viewed, articles opened, and searches you run), crash and error diagnostics, and technical details like device model, operating system and version, app version, language, time zone, and network type, together with a randomly generated installation identifier. We do not collect your precise device location, and we do not use advertising identifiers.",
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
    body: "Billion does not access your device's GPS or precise location. To show your local ballot and representatives, you type in a registered address. That address is stored on your device using the operating system's secure storage, and it is sent to our servers only when a lookup runs. To fulfill the lookup, we forward the address to trusted civic-data providers — the Google Civic Information API, Google Places for address autocomplete, and Open States. We cache lookup results on our servers using a one-way hashed key derived from the address rather than the address itself, and those cached results expire automatically. This processing is not linked to any account and is never used for advertising or cross-app tracking. You can change or clear your saved address in the app at any time.",
  },
  {
    title: "5. Analytics and Diagnostics",
    body: "We use PostHog to understand how Billion is used and to diagnose crashes and errors. Because the app has no accounts, this analytics data is associated with a randomly generated installation identifier rather than your real-world identity, and PostHog may infer an approximate, city-level location from your IP address. We do not use advertising identifiers, and we do not track you across other companies' apps or websites. Analytics data is processed by PostHog in the United States.",
  },
  {
    title: "6. Data Sharing",
    body: "We share information only with service providers that help us operate Billion, and only as needed to run the service: PostHog for analytics and diagnostics; Resend for waitlist and feedback email delivery; and civic-data providers for address lookups (the Google Civic Information API, Google Places, and Open States). We require these providers to protect your information and not use it for their own marketing. We may also disclose information if we are required to by law.",
  },
  {
    title: "7. Data Retention",
    body: "Because Billion has no user accounts, we do not build a personal profile about you. Waitlist email addresses are retained until you unsubscribe or ask us to delete them. Feedback you send is retained in our email so that we can act on it. Your registered address remains on your device until you change it, clear it, or uninstall the app; the hashed-key lookup caches on our servers expire automatically, within about thirty days. Analytics and diagnostic data are retained by our analytics provider according to its retention settings.",
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
