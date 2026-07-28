import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Billion",
  description:
    "Get help with the Billion app, find answers to common questions, or contact the Billion support team.",
};

const FAQS = [
  {
    question: "Where does Billion get its information?",
    answer:
      "Billion uses public sources such as Congress.gov, the Federal Register, court records, and state and local government sources. Articles link to the original source so you can verify the details.",
  },
  {
    question: "How should I use Billion's AI explanations?",
    answer:
      "Treat them as a starting point. AI-generated summaries can simplify nuance or contain errors, so check the linked official source before relying on important information.",
  },
  {
    question: "How do I update my election address?",
    answer:
      "Open the Elections tab in the app and select the address control to enter or replace your registered address. Billion does not use your device's GPS.",
  },
  {
    question: "How do I report a problem or suggest an improvement?",
    answer:
      "Open the Feedback tab in the app, choose the category that best fits, and send us the details. You can also email the support address below.",
  },
];

export default function SupportPage() {
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
          href="/privacy"
          className="text-muted-foreground hover:text-accent font-sans text-[15px] font-medium no-underline transition-colors duration-200"
        >
          Privacy Policy
        </Link>
      </nav>

      <article
        className="mx-auto px-6 py-12 md:py-16"
        style={{ maxWidth: 760 }}
      >
        <span className="tracking-label text-muted-foreground mb-2 block font-sans text-[12px] font-medium uppercase">
          App support
        </span>
        <h1
          className="text-foreground mb-4 leading-[1.15] font-bold tracking-[-0.02em]"
          style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)" }}
        >
          How can we help?
        </h1>
        <p className="text-muted-foreground mb-12 max-w-[60ch] font-sans text-[17px] leading-[1.7]">
          Find quick answers below. If something is not working, send us the
          steps you took, what you expected, and your app version when possible.
        </p>

        <section aria-labelledby="contact-heading" className="mb-14">
          <div className="border-border rounded-2xl border bg-white/[0.03] p-6 md:p-8">
            <h2
              id="contact-heading"
              className="text-foreground mb-2 text-[22px] font-bold"
            >
              Contact support
            </h2>
            <p className="text-muted-foreground mb-5 font-sans text-[15px] leading-[1.65]">
              We read every support request and will respond as soon as we can.
            </p>
            <a
              href="mailto:billionnewsapp@gmail.com?subject=Billion%20app%20support"
              className="bg-accent text-accent-foreground inline-flex min-h-11 items-center rounded-full px-5 py-2.5 font-sans text-[14px] font-semibold no-underline transition-opacity hover:opacity-90"
            >
              Email billionnewsapp@gmail.com
            </a>
          </div>
        </section>

        <section aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className="text-foreground mb-6 text-[26px] font-bold"
          >
            Frequently asked questions
          </h2>
          <div className="flex flex-col gap-3">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group border-border rounded-xl border bg-white/[0.02] px-5 py-4"
              >
                <summary className="text-foreground cursor-pointer font-sans text-[15px] font-semibold">
                  {faq.question}
                </summary>
                <p className="text-muted-foreground mb-0 pt-3 font-sans text-[15px] leading-[1.65]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </article>

      <footer
        className="border-border mx-auto flex flex-wrap items-center justify-between gap-4 border-t px-6 py-8"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-muted-foreground font-display text-[18px] font-bold">
          Billion
        </span>
        <div className="flex flex-wrap items-center gap-5 font-sans text-[13px]">
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-accent no-underline transition-colors duration-200"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-accent no-underline transition-colors duration-200"
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
