import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { WaitlistForm } from "../_components/waitlist-form";

export const metadata: Metadata = {
  title: "Email updates — Billion",
  description:
    "Subscribe for Billion product releases, Android availability, and civic updates.",
};

export default function SubscribePage() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col">
      <nav
        className="mx-auto flex w-full items-center justify-between px-6 py-5"
        style={{ maxWidth: 1120 }}
      >
        <Link
          href="/"
          className="flex items-center gap-3 text-inherit no-underline"
        >
          <Image
            src="/billion-logo.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-[8px]"
            priority
          />
          <span className="font-display text-[22px] font-bold tracking-[-0.02em]">
            Billion
          </span>
        </Link>
        <Link
          href="/"
          className="text-muted-foreground hover:text-accent font-sans text-[14px] font-medium no-underline transition-colors"
        >
          Back to the website
        </Link>
      </nav>

      <section className="flex flex-1 items-center px-6 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-[720px] text-center">
          <span className="tracking-label text-muted-foreground mb-3 block font-sans text-[12px] font-medium uppercase">
            Billion email updates
          </span>
          <h1
            className="text-foreground mb-5 leading-[1.12] font-bold tracking-[-0.025em]"
            style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)" }}
          >
            Keep up with what we&apos;re building.
          </h1>
          <p className="text-muted-foreground mx-auto mb-10 max-w-[48ch] font-sans text-[18px] leading-[1.7]">
            Get product releases, Android availability, and occasional civic
            updates from Billion. No spam. Unsubscribe anytime.
          </p>

          <div className="border-border rounded-3xl border bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-8">
            <WaitlistForm
              size="large"
              buttonText="Subscribe"
              placeholder="Enter your email"
              formLocation="subscribe_page"
            />
          </div>

          <p className="text-muted-foreground/80 mx-auto mt-6 max-w-[52ch] font-sans text-[12px] leading-[1.6]">
            By subscribing, you agree to receive email from Billion. Read our{" "}
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-accent underline underline-offset-4"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </section>

      <footer
        className="border-border mx-auto flex w-full flex-wrap items-center justify-between gap-4 border-t px-6 py-7 font-sans text-[13px]"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-muted-foreground">&copy; 2026 Billion</span>
        <div className="flex gap-5">
          <Link
            href="/support"
            className="text-muted-foreground hover:text-accent no-underline transition-colors"
          >
            Support
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-accent no-underline transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-accent no-underline transition-colors"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}
