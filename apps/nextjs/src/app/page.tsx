"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { WaitlistForm } from "./_components/waitlist-form";
import { useIntroDone } from "./_components/intro-context";
import {
  AnimatedSection,
  AnimatedCard,
  StaggerContainer,
  StaggerItem,
  CountUp,
} from "./_components/animations";

/* ── Gold accent tokens (not yet in Tailwind theme) ────────────────────── */
const gold = "#c4a35a";
const goldBorder = "rgba(196,163,90,0.25)";
const goldGlow = "rgba(196,163,90,0.15)";
const dividerGold = "rgba(196,163,90,0.3)";

/* ── Badge ─────────────────────────────────────────────────────────────── */
function Badge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-[10px] text-[11px] font-medium text-white uppercase h-6"
      style={{ backgroundColor: color, letterSpacing: "0.08em" }}
    >
      {type}
    </span>
  );
}

/* ── Hero content cards data ───────────────────────────────────────────── */
const HERO_CARDS = [
  {
    type: "BILL",
    color: "#4a7cff",
    title: "H.R. 4312: National Housing Stabilization Act",
    preview:
      "What changed in committee, who supports it, and what it means for your state.",
    meta: "Congress.gov · Passed Committee",
    time: "2h ago",
    opacity: 1,
  },
  {
    type: "CASE",
    color: "#0891b2",
    title: "U.S. v. Westfield Utilities",
    preview: "Majority and dissent logic, plain language, side by side.",
    meta: "U.S. Court of Appeals, 9th Circuit",
    time: "5h ago",
    opacity: 1,
  },
  {
    type: "ORDER",
    color: "#6366f1",
    title: "E.O. 14192: Department of Government Efficiency",
    preview:
      "What it authorizes, which agencies are affected, and open legal challenges.",
    meta: "",
    time: "8h ago",
    opacity: 0.7,
  },
];

function HeroCard({ card }: { card: (typeof HERO_CARDS)[number] }) {
  return (
    <motion.div
      className="rounded-[14px] p-5 bg-card border border-border"
      style={{ borderLeftWidth: 3, borderLeftColor: card.color, opacity: card.opacity }}
      whileHover={{ y: -2, borderColor: goldBorder, transition: { duration: 0.2 } }}
    >
      <div className="mb-[10px] flex items-center justify-between">
        <Badge type={card.type} color={card.color} />
        <span className="text-[12px] text-muted-foreground font-sans">
          {card.time}
        </span>
      </div>
      <h3 className="mb-2 text-[1.1rem] leading-[1.35] font-normal text-white font-editorial">
        {card.title}
      </h3>
      <p className="mb-[10px] text-[14px] leading-[1.5] text-muted-foreground">
        {card.preview}
      </p>
      {card.meta && (
        <p className="m-0 text-[12px] font-medium text-white/25">
          {card.meta}
        </p>
      )}
    </motion.div>
  );
}

/* ── Gold divider line ─────────────────────────────────────────────────── */
function GoldDivider() {
  return (
    <hr
      className="mx-auto my-0 h-px border-0"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${dividerGold} 50%, transparent 100%)`,
      }}
    />
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const introDone = useIntroDone();

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ── NAV ──────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={introDone ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center justify-between px-6 py-5 mx-auto"
        style={{ maxWidth: 1120 }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/billion-logo.png"
            alt="Billion"
            className="h-8 w-8"
          />
          <span className="text-[22px] font-bold tracking-[-0.02em] text-white font-display">
            Billion
          </span>
        </div>
        <Link
          href="#waitlist"
          className="text-[15px] font-medium transition-colors duration-200 text-white/60 hover:text-gold font-sans no-underline"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          Get Early Access
        </Link>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-10 px-6 pt-12 pb-[4.5rem] md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-14 md:pb-20"
        style={{ maxWidth: 1120 }}
      >
        {/* Left — text */}
        <AnimatedSection variant="fadeUp" className="max-w-[580px]">
          <p className="mb-[14px] text-[12px] font-medium tracking-label text-muted-foreground font-sans uppercase">
            AI Civic Intelligence
          </p>
          <h1
            className="mb-6 leading-[1.15] font-bold tracking-[-0.02em] text-white font-display"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.75rem)" }}
          >
            Know what government is doing before it changes your life.
          </h1>
          <p
            className="mb-7 text-[18px] leading-[1.6] text-muted-foreground font-sans"
            style={{ maxWidth: "52ch" }}
          >
            Bills, court cases, and executive actions — explained clearly,
            linked to the source.
          </p>
          <div className="flex flex-col gap-4">
            <WaitlistForm />
            <Link
              href="#approach"
              className="inline-flex h-[52px] items-center justify-center px-1 text-[16px] font-medium transition-colors duration-200 text-white/60 hover:text-gold font-sans no-underline"
            >
              See How It Works
            </Link>
          </div>
        </AnimatedSection>

        {/* Right — cards */}
        <div className="relative flex max-h-[480px] flex-col gap-3 overflow-hidden">
          <StaggerContainer staggerDelay={0.12}>
            {HERO_CARDS.map((card) => (
              <StaggerItem key={card.title}>
                <HeroCard card={card} />
              </StaggerItem>
            ))}
          </StaggerContainer>
          {/* fade mask */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[100px]"
            style={{
              background: `linear-gradient(to top, #0e1530, transparent)`,
            }}
            aria-hidden="true"
          />
        </div>
      </section>

      <GoldDivider />

      {/* ── PROBLEM ───────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-14 md:grid-cols-2 md:items-start md:gap-16 md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="slideInLeft">
          <p className="mb-[14px] text-[12px] font-medium tracking-label text-muted-foreground font-sans uppercase">
            The Problem
          </p>
          <h2
            className="m-0 leading-[1.18] font-normal tracking-[-0.01em] text-white font-display"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            Public information exists.
            <br />
            Public understanding doesn&apos;t.
          </h2>
        </AnimatedSection>
        <AnimatedSection variant="slideInRight">
          <p className="m-0 pt-1 text-[18px] leading-[1.65] md:pt-2 text-white/75 font-sans">
            Most people hear about policy through headlines, not source material.
            Billion closes that gap.
          </p>
        </AnimatedSection>
      </section>

      <GoldDivider />

      {/* ── APPROACH ──────────────────────────────────────────────── */}
      <section
        id="approach"
        className="mx-auto px-6 py-14 md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="fadeUp" className="text-center">
          <h2
            className="m-0 leading-[1.18] font-normal tracking-[-0.01em] text-white font-display"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            One civic feed.
            <br />
            Three source systems.
          </h2>
        </AnimatedSection>

        <StaggerContainer
          staggerDelay={0.1}
          className="mt-10 grid grid-cols-1 gap-[14px] md:grid-cols-[1.5fr_1fr_1fr]"
        >
          {/* Bill */}
          <StaggerItem variant="scaleIn">
            <AnimatedCard className="rounded-[14px] p-7 bg-card border border-border" style={{ borderTopWidth: 2, borderTopColor: "#4a7cff" }}>
              <Badge type="BILL" color="#4a7cff" />
              <h3 className="mt-[14px] mb-[10px] text-[1.25rem] leading-[1.3] font-bold text-white font-editorial">
                Congressional Legislation
              </h3>
              <p className="m-0 text-[15px] leading-[1.6] text-muted-foreground font-sans">
                Tracks sponsorship, status, and text changes. Explainers generate
                when source content changes — not on a schedule.
              </p>
              <p
                className="mt-4 mb-0 text-[12px] font-medium font-sans"
                style={{ color: "#4a7cff", opacity: 0.85 }}
              >
                <CountUp to={4392} duration={2} /> bills tracked in the current Congress
              </p>
            </AnimatedCard>
          </StaggerItem>

          {/* Order */}
          <StaggerItem variant="scaleIn">
            <AnimatedCard className="rounded-[14px] p-7 bg-card border border-border" style={{ borderTopWidth: 2, borderTopColor: "#6366f1" }}>
              <Badge type="ORDER" color="#6366f1" />
              <h3 className="mt-[14px] mb-[10px] text-[1.25rem] leading-[1.3] font-bold text-white font-editorial">
                Executive Actions
              </h3>
              <p className="m-0 text-[15px] leading-[1.6] text-muted-foreground font-sans">
                Orders, memoranda, and proclamations pulled directly from official
                White House publications.
              </p>
            </AnimatedCard>
          </StaggerItem>

          {/* Case */}
          <StaggerItem variant="scaleIn">
            <AnimatedCard className="rounded-[14px] p-7 bg-card border border-border" style={{ borderTopWidth: 2, borderTopColor: "#0891b2" }}>
              <Badge type="CASE" color="#0891b2" />
              <h3 className="mt-[14px] mb-[10px] text-[1.25rem] leading-[1.3] font-bold text-white font-editorial">
                Federal Court Cases
              </h3>
              <p className="m-0 text-[15px] leading-[1.6] text-muted-foreground font-sans">
                Filings and decisions surfaced with plain-language analysis and
                timeline context.
              </p>
            </AnimatedCard>
          </StaggerItem>
        </StaggerContainer>
      </section>

      <GoldDivider />

      {/* ── DUAL LENS ─────────────────────────────────────────────── */}
      <section
        className="mx-auto px-6 py-14 md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="fadeUp" className="text-center">
          <h2
            className="m-0 leading-[1.18] font-normal tracking-[-0.01em] text-white font-display"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            Two readings.
            <br />
            Every topic.
          </h2>
          <p className="mx-auto mt-[14px] mb-0 text-[18px] leading-[1.6] text-muted-foreground font-sans max-w-[52ch]">
            Billion surfaces analysis from across the political spectrum — side by
            side, transparently labeled, never merged into a false middle.
          </p>
        </AnimatedSection>

        <div className="mt-8 grid grid-cols-1 gap-[14px] md:grid-cols-2">
          {/* Institutional Lens */}
          <AnimatedSection variant="slideInLeft">
            <AnimatedCard
              accent
              className="relative rounded-[14px] p-8 bg-card border border-border"
              style={{ borderTopWidth: 2, borderTopColor: "#6366f1" }}
            >
              <p
                className="m-0 mb-[18px] text-[11px] font-medium tracking-label uppercase font-sans"
                style={{ color: "#6366f1" }}
              >
                Institutional Lens
              </p>
              <blockquote className="m-0 mb-4 border-none p-0 text-[1.15rem] leading-[1.45] font-normal text-white font-editorial">
                &ldquo;Expanding federal housing mandates risks crowding out private
                investment and local zoning authority.&rdquo;
              </blockquote>
              <p className="m-0 mb-5 text-[15px] leading-[1.6] text-muted-foreground font-sans">
                Frames policy around institutional stability, federalism, and
                legal precedent established by prior congresses.
              </p>
              <p className="m-0 text-[12px] font-medium text-white/25 font-sans">
                Re: H.R. 4312 &middot; Institute for Housing Policy Research
              </p>
            </AnimatedCard>
          </AnimatedSection>

          {/* Impact Lens */}
          <AnimatedSection variant="slideInRight">
            <AnimatedCard
              accent
              className="relative rounded-[14px] p-8 border border-border"
              style={{
                backgroundColor: "rgba(74,124,255,0.05)",
                borderTopWidth: 2,
                borderTopColor: "#4a7cff",
              }}
            >
              <p
                className="m-0 mb-[18px] text-[11px] font-medium tracking-label uppercase font-sans"
                style={{ color: "#4a7cff" }}
              >
                Impact Lens
              </p>
              <blockquote className="m-0 mb-4 border-none p-0 text-[1.15rem] leading-[1.45] font-normal text-white font-editorial">
                &ldquo;40 million Americans lack stable housing — federal intervention
                is the only mechanism at scale.&rdquo;
              </blockquote>
              <p className="m-0 mb-5 text-[15px] leading-[1.6] text-muted-foreground font-sans">
                Frames policy around impact on households, local economies, and
                the civil liberties of renters and low-income communities.
              </p>
              <p className="m-0 text-[12px] font-medium text-white/25 font-sans">
                Re: H.R. 4312 &middot; National Housing Justice Coalition
              </p>
            </AnimatedCard>
          </AnimatedSection>
        </div>
      </section>

      <GoldDivider />

      {/* ── BRADBURY ──────────────────────────────────────────────── */}
      <AnimatedSection
        variant="scaleIn"
        className="mx-auto px-6 py-14 text-center md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
      >
        <h2
          className="mx-auto mb-5 leading-[1.2] font-normal tracking-[-0.01em] text-white font-display max-w-[18ch]"
          style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
        >
          Every summary should lead to{" "}
          <em className="italic" style={{ color: gold }}>
            deeper reading.
          </em>
        </h2>
        <p className="mx-auto mb-7 text-[18px] leading-[1.7] text-muted-foreground font-sans max-w-[48ch]">
          We are not a summarization engine.
          <br />
          <br />
          Every piece of content Billion produces functions as an invitation —
          to the bill text, the filing, the full decision. If you finish reading
          and feel like you&apos;ve got the gist, we&apos;ve failed.
        </p>
        <Link
          href="#waitlist"
          className="inline-flex h-[52px] cursor-pointer items-center justify-center rounded-full border-none bg-white px-7 text-[16px] font-medium whitespace-nowrap text-black transition-all duration-200 hover:opacity-90 active:scale-[0.98] font-sans no-underline"
          style={{ boxShadow: `0 0 24px ${goldGlow}` }}
        >
          Explore the source
        </Link>
      </AnimatedSection>

      <GoldDivider />

      {/* ── WAITLIST ──────────────────────────────────────────────── */}
      <AnimatedSection
        variant="fadeUp"
        className="mx-auto px-6 py-14 text-center md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
        id="waitlist"
      >
        <p className="mb-[14px] text-center text-[12px] font-medium tracking-label text-muted-foreground font-sans uppercase">
          Early Access
        </p>
        <h2
          className="mb-4 leading-[1.2] font-bold tracking-[-0.02em] text-white font-display"
          style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
        >
          Be first when Billion opens.
        </h2>
        <p className="mx-auto mb-7 text-[18px] leading-[1.6] text-muted-foreground font-sans max-w-[44ch]">
          Early access, updates, and pilot invites.
        </p>
        <WaitlistForm size="large" />
      </AnimatedSection>

      <GoldDivider />

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer
        className="mx-auto flex items-center justify-between px-6 py-8"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-[18px] font-bold text-white/40 font-display">
          Billion
        </span>
        <div className="flex items-center gap-5 text-[13px] font-sans">
          <Link
            href="/terms"
            className="transition-colors duration-200 text-white/40 hover:text-gold no-underline"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="transition-colors duration-200 text-white/40 hover:text-gold no-underline"
          >
            Privacy
          </Link>
          <span className="text-white/25">
            &copy; 2026 Billion. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
