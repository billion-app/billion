"use client";

import type { MotionValue } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import posthog from "posthog-js";

import {
  AnimatedSection,
  EASE_OUT_QUART,
  StaggerContainer,
  StaggerItem,
} from "./_components/animations";
import { AppTour } from "./_components/app-tour";
import { HeroExperience } from "./_components/hero-experience";
import {
  AndroidIcon,
  AppleIcon,
  GithubIcon,
  InstagramIcon,
} from "./_components/icons";
import { WaitlistForm } from "./_components/waitlist-form";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/billion-news/id6761675243";

const platforms = [
  {
    Icon: AppleIcon,
    name: "iOS",
    status: "Live on App Store",
  },
  {
    Icon: AndroidIcon,
    name: "Android",
    status: "Coming soon",
  },
];

// Footer-only, not the platforms section — GitHub and Instagram are
// nice-to-follow, not the point of "built where you already are", and a
// footer is where visitors expect to find them anyway.
const socialLinks = [
  {
    Icon: GithubIcon,
    name: "GitHub",
    href: "https://github.com/billion-app/billion",
  },
  {
    Icon: InstagramIcon,
    name: "Instagram",
    href: "https://www.instagram.com/billion.news/?hl=en",
  },
];

function Divider() {
  return <hr className="divider-hairline" />;
}

// Underline that draws itself in on scroll — plain CSS bar + scaleX/originX,
// same technique used by the source-merge tree lines in app-tour.tsx.
function UnderlineWord({
  children,
  progress,
}: {
  children: string;
  progress: MotionValue<number>;
}) {
  return (
    <span className="relative inline-block leading-none">
      {children}
      <motion.span
        aria-hidden="true"
        className="bg-foreground absolute bottom-[-3px] left-0 h-px w-full"
        style={{ scaleX: progress, originX: 0 }}
      />
    </span>
  );
}

// The three record types underline themselves in on scroll, one at a time —
// each range starts exactly where the previous one ends, so there's no
// overlap. "summaries" and "verifiable sources" are plain text, same color
// as the rest of the sentence; underlining every emphasis word here would
// be too much motion for one sentence.
function HeroSubheading() {
  const { scrollY } = useScroll();

  const billsUnderline = useTransform(scrollY, [0, 80], [0, 1]);
  const ordersUnderline = useTransform(scrollY, [80, 160], [0, 1]);
  const rulingsUnderline = useTransform(scrollY, [160, 240], [0, 1]);

  return (
    <p
      className="text-muted-foreground mx-auto mb-7 font-sans text-[17px] leading-[1.6] lg:mx-0"
      style={{ maxWidth: "40ch" }}
    >
      Browse summaries of{" "}
      <UnderlineWord progress={billsUnderline}>bills</UnderlineWord>,{" "}
      <UnderlineWord progress={ordersUnderline}>executive orders</UnderlineWord>
      , and{" "}
      <UnderlineWord progress={rulingsUnderline}>court rulings</UnderlineWord> —
      all linked to verifiable sources.
    </p>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      {/* ── NAV ──────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, filter: "blur(8px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
        className="mx-auto flex items-center justify-between px-6 py-5"
        style={{ maxWidth: 1120 }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/billion-logo.png"
            alt="Billion"
            width={32}
            height={32}
            className="h-8 w-8 rounded-[8px]"
            priority
          />
          <span className="text-foreground font-display text-[22px] font-bold tracking-[-0.02em]">
            Billion
          </span>
        </div>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            posthog.capture("app_store_download_clicked", { location: "nav" })
          }
          className="text-muted-foreground hover:text-accent font-sans text-[15px] font-medium no-underline transition-colors duration-200"
        >
          Download for iOS
        </a>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-10 px-6 pt-12 pb-12 md:pt-14 md:pb-16 lg:grid-cols-[minmax(0,0.72fr)_minmax(440px,1.28fr)] lg:items-center"
        style={{ maxWidth: 1180 }}
      >
        {/* Left — text */}
        <StaggerContainer
          staggerDelay={0.09}
          className="mx-auto max-w-[580px] text-center lg:mx-0 lg:text-left"
        >
          <StaggerItem
            variant="focusIn"
            className="tracking-label text-muted-foreground mb-[14px] font-sans text-[12px] font-medium uppercase"
          >
            The Civic Information App
          </StaggerItem>
          <StaggerItem variant="focusIn">
            <h1
              className="text-foreground font-display mb-6 leading-[1.15] font-bold tracking-[-0.02em]"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.75rem)" }}
            >
              See what government is doing before it affects you.
            </h1>
          </StaggerItem>
          <StaggerItem variant="focusIn">
            <HeroSubheading />
          </StaggerItem>
          <StaggerItem variant="focusIn" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  posthog.capture("app_store_download_clicked", {
                    location: "hero",
                  })
                }
                className="inline-flex shrink-0 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
              >
                <img
                  src="/apple-download.svg"
                  alt="Download on the App Store"
                  className="h-[44px] w-[148px] shrink-0 object-contain sm:h-[48px] sm:w-[161px]"
                />
              </a>

              <div
                onClick={() =>
                  posthog.capture("android_coming_soon_clicked", {
                    location: "hero",
                  })
                }
                className="flex h-[44px] items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 font-sans text-[13px] font-medium text-muted-foreground sm:h-[48px] cursor-default"
              >
                <AndroidIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Coming Soon to Android</span>
              </div>
            </div>

            <Link
              href="#app-tour"
              className="text-muted-foreground hover:text-accent inline-flex h-[36px] items-center justify-center px-1 font-sans text-[15px] font-medium no-underline transition-colors duration-200"
            >
              See it in the app ↓
            </Link>
          </StaggerItem>
        </StaggerContainer>

        <HeroExperience />
      </section>

      <AppTour id="app-tour" />

      <Divider />

      {/* ── MISSION ───────────────────────────────────────────────── */}
      <AnimatedSection
        variant="settle"
        className="mx-auto px-6 py-10 text-center md:py-14"
        style={{ maxWidth: 1120 }}
      >
        <h2
          className="text-foreground font-display mx-auto mb-5 max-w-[18ch] leading-[1.2] font-normal tracking-[-0.01em]"
          style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
        >
          Our mission is helping people{" "}
          <em className="text-accent italic">
            understand the world around them.
          </em>
        </h2>
        <p className="text-muted-foreground mx-auto mb-0 max-w-[46ch] font-sans text-[18px] leading-[1.6]">
          Most people find out what their government did only after it&apos;s
          already changed their lives. Billion exists to increase people&apos;s
          civic understanding and draw attention to prevalent societal issues.
        </p>
      </AnimatedSection>

      <Divider />

      {/* ── DOWNLOAD & WAITLIST ────────────────────────────────────── */}
      <AnimatedSection
        variant="fadeUp"
        className="mx-auto px-6 py-10 text-center md:py-14"
        style={{ maxWidth: 1120 }}
        id="waitlist"
      >
        <p className="tracking-label text-muted-foreground mb-[14px] text-center font-sans text-[12px] font-medium uppercase">
          Available Now on iOS
        </p>
        <h2
          className="text-foreground font-display mb-4 leading-[1.2] font-bold tracking-[-0.02em]"
          style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
        >
          Download Billion today.
        </h2>
        <p className="text-muted-foreground mx-auto mb-8 max-w-[44ch] font-sans text-[18px] leading-[1.6]">
          Get source-grounded civic intelligence directly on your iPhone. Android app coming soon.
        </p>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              posthog.capture("app_store_download_clicked", {
                location: "download_section",
              })
            }
            className="inline-flex shrink-0 transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
          >
            <img
              src="/apple-download.svg"
              alt="Download on the App Store"
              className="h-[48px] w-[161px] shrink-0 object-contain sm:h-[54px] sm:w-[181px]"
            />
          </a>

          <div
            onClick={() =>
              posthog.capture("android_coming_soon_clicked", {
                location: "download_section",
              })
            }
            className="flex h-[48px] items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-5 font-sans text-[14px] font-medium text-muted-foreground sm:h-[54px] cursor-default"
          >
            <AndroidIcon className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>Coming Soon to Android</span>
          </div>
        </div>

        <div className="mx-auto max-w-md border-t border-white/10 pt-8">
          <h3 className="text-foreground mb-2 font-sans text-[15px] font-semibold">
            Stay in the loop
          </h3>
          <p className="text-muted-foreground mb-4 font-sans text-[14px]">
            Join our mailing list for feature releases, Android availability, and civic updates.
          </p>
          <WaitlistForm size="large" buttonText="Subscribe" placeholder="Enter your email" />
        </div>
      </AnimatedSection>

      <Divider />

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <AnimatedSection
        as="footer"
        variant="fadeIn"
        className="mx-auto flex flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-muted-foreground font-display text-[18px] font-bold">
          Billion
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-sans text-[13px] sm:justify-end">
          <div className="flex items-center gap-3">
            {socialLinks.map(({ Icon, name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="text-muted-foreground hover:text-accent transition-colors duration-200"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <Link
            href="/support"
            className="text-muted-foreground hover:text-accent no-underline transition-colors duration-200"
          >
            Support
          </Link>
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
      </AnimatedSection>
    </main>
  );
}
