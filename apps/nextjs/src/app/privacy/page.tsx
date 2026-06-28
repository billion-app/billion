import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Billion",
};

const LAST_UPDATED = "April 5, 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "We collect information you provide directly, including your email address when you join our waitlist or create an account, and any preferences or profile information you submit. We also collect information automatically when you use our services, such as usage data, device type, and app interactions.",
  },
  {
    title: "2. Waitlist and Landing Page",
    body: "When you sign up for our waitlist, we collect your email address to notify you when the App becomes available and to send updates about Billion. You can unsubscribe at any time by emailing thatxliner@gmail.com.",
  },
  {
    title: "3. How We Use Your Information",
    body: "We use collected information to operate and improve our services, personalize your experience, send service-related and waitlist communications, and comply with legal obligations. We do not sell your personal information.",
  },
  {
    title: "4. Data Sharing",
    body: "We may share your information with service providers who assist us in operating our services (e.g. hosting, analytics, email delivery). We require all third parties to respect the security of your data and not use it for their own marketing purposes.",
  },
  {
    title: "5. Your Choices",
    body: "You can control certain data uses — including analytics and personalized content — through Privacy Settings in the app. You may request access to or deletion of your personal data at any time by emailing thatxliner@gmail.com.",
  },
  {
    title: "6. Data Retention",
    body: "We retain your information for as long as your account is active or as needed to provide our services. Waitlist email addresses are retained until you unsubscribe or request deletion.",
  },
  {
    title: "7. Security",
    body: "We implement commercially reasonable security measures to protect your data. No internet transmission or electronic storage is 100% secure.",
  },
  {
    title: "8. Children's Privacy",
    body: "Our services are not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware we have done so, we will delete it promptly.",
  },
  {
    title: "9. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of material changes via in-app notice or email.",
  },
  {
    title: "10. Contact",
    body: "Questions about this Privacy Policy or your data? Email us at thatxliner@gmail.com.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <nav
        className="mx-auto flex items-center justify-between px-6 py-5"
        style={{ maxWidth: 1120 }}
      >
        <Link
          href="/"
          className="text-foreground font-display text-[22px] font-bold tracking-[-0.02em] no-underline"
        >
          Billion
        </Link>
        <Link
          href="/terms"
          className="text-muted-foreground hover:text-gold font-sans text-[15px] font-medium no-underline transition-colors duration-200"
        >
          Terms of Service
        </Link>
      </nav>

      <article
        className="mx-auto px-6 py-12 md:py-16"
        style={{ maxWidth: 720 }}
      >
        <p className="tracking-label text-muted-foreground mb-2 font-sans text-[12px] font-medium uppercase">
          Last updated {LAST_UPDATED}
        </p>
        <h1
          className="text-foreground font-display mb-10 leading-[1.15] font-bold tracking-[-0.02em]"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          Privacy Policy
        </h1>

        <div className="flex flex-col gap-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-foreground mb-2 font-sans text-[15px] font-semibold">
                {s.title}
              </h2>
              <p className="text-muted-foreground m-0 font-sans text-[16px] leading-[1.7]">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </article>

      <footer
        className="border-border mx-auto flex items-center justify-between border-t px-6 py-8"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-muted-foreground font-display text-[18px] font-bold">
          Billion
        </span>
        <div className="flex items-center gap-5 font-sans text-[13px]">
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-gold no-underline transition-colors duration-200"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-gold no-underline transition-colors duration-200"
          >
            Privacy
          </Link>
          <span className="text-muted-foreground/70">
            &copy; 2026 Billion. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
