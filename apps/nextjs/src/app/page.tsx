"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import {
  AnimatedSection,
  CountUp,
  StaggerContainer,
  StaggerItem,
} from "./_components/animations";
import { HeroExperience } from "./_components/hero-experience";
import { useIntroDone } from "./_components/intro-context";
import { WaitlistForm } from "./_components/waitlist-form";
import { WorkflowHero } from "./_components/workflow-hero";

/* ── Gold accent tokens (not yet in Tailwind theme) ────────────────────── */
const gold = "#c4a35a";
const goldGlow = "rgba(196,163,90,0.15)";
const dividerGold = "rgba(196,163,90,0.3)";

const sourceSystems = [
  {
    type: "BILL",
    color: "#4a7cff",
    title: "Bills",
    signal: "Status, sponsors, amendments",
    source: "Congress.gov",
    count: 4392,
  },
  {
    type: "ORDER",
    color: "#6366f1",
    title: "Orders",
    signal: "Authority, agencies, challenges",
    source: "White House",
  },
  {
    type: "CASE",
    color: "#0891b2",
    title: "Cases",
    signal: "Filings, rulings, timelines",
    source: "Federal courts",
  },
];

const lensCards = [
  {
    label: "Institutional",
    color: "#6366f1",
    line: "Agency authority, court posture, and precedent risk.",
  },
  {
    label: "Impact",
    color: "#4a7cff",
    line: "People affected, local pressure, and implementation risk.",
  },
];

const problemPairs = [
  { before: "Headline", after: "Source" },
  { before: "Opinion", after: "Brief" },
  { before: "Guesswork", after: "Context" },
];

/* ── Badge ─────────────────────────────────────────────────────────────── */
function Badge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-[6px] px-[10px] text-[11px] font-medium text-white uppercase"
      style={{ backgroundColor: color, letterSpacing: "0.08em" }}
    >
      {type}
    </span>
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

function ProblemColumn({
  label,
  items,
  accent = false,
}: {
  label: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#101832] p-5">
      <p
        className="m-0 font-sans text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: accent ? gold : "#8f97ad" }}
      >
        {label}
      </p>
      <motion.div
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.11 } },
        }}
        className="mt-5 flex flex-col gap-2"
      >
        {items.map((item) => (
          <motion.span
            key={item}
            variants={{
              hidden: {
                opacity: 0,
                x: accent ? -8 : 8,
              },
              visible: {
                opacity: accent ? 1 : 0.66,
                x: 0,
                transition: { duration: 0.34, ease: "easeOut" },
              },
            }}
            className={
              accent
                ? "rounded-full border border-[rgba(196,163,90,0.26)] bg-[rgba(196,163,90,0.085)] px-3 py-2 font-sans text-[13px] font-semibold text-white"
                : "rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 font-sans text-[13px] font-semibold text-white/72"
            }
          >
            {item}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

function ProblemComparison() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, x: 24 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.52, ease: "easeOut" },
        },
      }}
      className="relative overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.035] p-5"
      data-testid="problem-comparison"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_54px_1fr] sm:items-stretch">
        <ProblemColumn
          label="Before"
          items={problemPairs.map((pair) => pair.before)}
        />

        <div className="hidden pt-[42px] pb-1 sm:flex sm:flex-col sm:gap-2">
          {problemPairs.map((pair, index) => (
            <div
              key={`${pair.before}-${pair.after}`}
              className="relative h-[38px] w-[54px]"
              aria-hidden="true"
            >
              <motion.span
                variants={{
                  hidden: { scaleX: 0, opacity: 0 },
                  visible: {
                    scaleX: 1,
                    opacity: 1,
                    transition: {
                      delay: 0.18 + index * 0.12,
                      duration: 0.5,
                      ease: "easeOut",
                    },
                  },
                }}
                className="absolute top-1/2 left-0 h-px w-full origin-left bg-gradient-to-r from-white/10 via-[rgba(196,163,90,0.55)] to-[rgba(196,163,90,0.95)]"
              />
              {!reducedMotion && (
                <motion.span
                  className="absolute top-1/2 left-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#c4a35a] shadow-[0_0_16px_rgba(196,163,90,0.7)]"
                  animate={{
                    x: [0, 48],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    repeatDelay: 1.3,
                    delay: 0.5 + index * 0.18,
                    ease: "easeInOut",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div
          className="relative flex h-12 justify-center sm:hidden"
          aria-hidden="true"
        >
          <motion.span
            variants={{
              hidden: { opacity: 0, scaleY: 0 },
              visible: {
                opacity: 1,
                scaleY: 1,
                transition: { delay: 0.24, duration: 0.42, ease: "easeOut" },
              },
            }}
            className="absolute top-1/2 left-1/2 h-10 w-px origin-top -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-white/10 via-[rgba(196,163,90,0.5)] to-[rgba(196,163,90,0.95)]"
          />
          {!reducedMotion && (
            <motion.span
              className="absolute top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#c4a35a] shadow-[0_0_16px_rgba(196,163,90,0.72)]"
              animate={{
                y: [0, 34],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatDelay: 1.1,
                delay: 0.55,
                ease: "easeInOut",
              }}
            />
          )}
        </div>

        <ProblemColumn
          label="Billion"
          items={problemPairs.map((pair) => pair.after)}
          accent
        />
      </div>
    </motion.div>
  );
}

function SourceSystemsList() {
  return (
    <StaggerContainer
      staggerDelay={0.08}
      className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.03]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <span className="font-sans text-[12px] font-semibold tracking-[0.1em] text-white/72 uppercase">
          Source map
        </span>
        <span className="font-sans text-[12px] font-semibold tracking-[0.08em] text-white/45 uppercase">
          Official records
        </span>
      </div>
      {sourceSystems.map((system) => (
        <StaggerItem
          key={system.type}
          variant="fadeUp"
          className="group grid gap-4 border-b border-white/[0.07] px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.035] sm:grid-cols-[88px_1fr_auto] sm:items-center"
        >
          <Badge type={system.type} color={system.color} />
          <div>
            <h3 className="text-foreground font-editorial m-0 text-[1.25rem] leading-[1.15] font-bold">
              {system.title}
            </h3>
            <p className="text-muted-foreground mt-1 mb-0 font-sans text-[14px] leading-[1.45]">
              {typeof system.count === "number" ? (
                <>
                  <span className="text-white/72">
                    <CountUp to={system.count} duration={2} /> tracked
                  </span>
                  {" · "}
                </>
              ) : null}
              {system.signal}
            </p>
          </div>
          <p
            className="m-0 flex items-center gap-2 font-sans text-[12px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase"
            style={{ color: system.color, opacity: 0.92 }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: system.color }}
            />
            {system.source}
          </p>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

function LensList() {
  return (
    <StaggerContainer
      staggerDelay={0.08}
      className="overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.03]"
    >
      <div className="flex flex-col gap-2 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-sans text-[12px] font-semibold tracking-[0.1em] text-white/72 uppercase">
          Source text
        </span>
        <span className="font-sans text-[13px] text-white/45">
          one record, multiple readings
        </span>
      </div>
      {lensCards.map((lens) => (
        <StaggerItem
          key={lens.label}
          variant="fadeUp"
          className="group relative grid gap-3 border-b border-white/[0.07] px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.035] sm:grid-cols-[150px_1fr] sm:items-center"
        >
          <div>
            <Badge type={lens.label} color={lens.color} />
          </div>
          <p className="text-foreground font-editorial m-0 text-[1.15rem] leading-[1.25] font-normal">
            {lens.line}
          </p>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const introDone = useIntroDone();

  return (
    <main className="bg-background text-foreground min-h-screen">
      {/* ── NAV ──────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={introDone ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto flex items-center justify-between px-6 py-5"
        style={{ maxWidth: 1120 }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/billion-logo.png"
            alt="Billion"
            className="h-8 w-8 rounded-2xl"
          />
          <span className="text-foreground font-display text-[22px] font-bold tracking-[-0.02em]">
            Billion
          </span>
        </div>
        <Link
          href="#waitlist"
          className="text-muted-foreground hover:text-gold font-sans text-[15px] font-medium no-underline transition-colors duration-200"
        >
          Get Early Access
        </Link>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-10 px-6 pt-12 pb-[4.5rem] md:pt-14 md:pb-20 lg:grid-cols-[minmax(0,0.72fr)_minmax(440px,1.28fr)] lg:items-center"
        style={{ maxWidth: 1180 }}
      >
        {/* Left — text */}
        <AnimatedSection
          variant="fadeUp"
          className="mx-auto max-w-[580px] text-center lg:mx-0 lg:text-left"
        >
          <p className="tracking-label text-muted-foreground mb-[14px] font-sans text-[12px] font-medium uppercase">
            AI Civic Intelligence
          </p>
          <h1
            className="text-foreground font-display mb-6 leading-[1.15] font-bold tracking-[-0.02em]"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.75rem)" }}
          >
            Government moves. Know why.
          </h1>
          <p
            className="text-muted-foreground mx-auto mb-7 font-sans text-[18px] leading-[1.6] lg:mx-0"
            style={{ maxWidth: "38ch" }}
          >
            Everything you need to know as a voter, explained from the source.
          </p>
          <div className="flex flex-col gap-4">
            <WaitlistForm />
            <Link
              href="#approach"
              className="text-muted-foreground hover:text-gold inline-flex h-[52px] items-center justify-center px-1 font-sans text-[16px] font-medium no-underline transition-colors duration-200"
            >
              See How It Works
            </Link>
          </div>
        </AnimatedSection>

        <HeroExperience />
      </section>

      <GoldDivider />

      {/* ── PROBLEM ───────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-14 md:grid-cols-[0.95fr_1.05fr] md:items-center md:gap-16 md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="slideInRight" className="md:order-2">
          <p className="tracking-label text-muted-foreground mb-[14px] font-sans text-[12px] font-medium uppercase">
            The Problem
          </p>
          <h2
            className="text-foreground font-display m-0 leading-[1.18] font-normal tracking-[-0.01em]"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            The record is public.
            <br />
            The path is not.
          </h2>

          <p className="text-muted-foreground mt-4 mb-0 max-w-[32ch] font-sans text-[16px] leading-[1.6]">
            {/*A well-informed people is fundamental to democracy.*/}
            However, not only are existing formats extremely boring, they are
            also oftentimes overcomplicated in legal language designed to be
            inaccessible for the average citizen.
          </p>
        </AnimatedSection>
        <div className="md:order-1">
          <ProblemComparison />
        </div>
      </section>

      <GoldDivider />

      {/* ── APPROACH ──────────────────────────────────────────────── */}
      <section
        id="approach"
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[0.82fr_1.18fr] md:items-center md:gap-16 md:py-14"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="slideInLeft">
          <h2
            className="text-foreground font-display m-0 leading-[1.18] font-normal tracking-[-0.01em]"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            <span className="block md:whitespace-nowrap">
              Track the moving parts.
            </span>
            <span className="block md:whitespace-nowrap">Skip the noise.</span>
          </h2>
          <p className="text-muted-foreground mt-4 mb-0 max-w-[32ch] font-sans text-[16px] leading-[1.6]">
            Billion watches the official record, then turns changes into
            source-linked signals.
          </p>
        </AnimatedSection>
        <AnimatedSection variant="slideInRight">
          <SourceSystemsList />
        </AnimatedSection>
      </section>

      <GoldDivider />

      {/* ── DUAL LENS ─────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[0.82fr_1.18fr] md:items-center md:gap-16 md:py-14"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="slideInRight" className="md:order-2">
          <h2
            className="text-foreground font-display m-0 leading-[1.18] font-normal tracking-[-0.01em]"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            Disagreement,
            <br />
            labeled.
          </h2>
          <p className="text-muted-foreground mt-4 mb-0 max-w-[32ch] font-sans text-[16px] leading-[1.6]">
            Same source. Different stakes.
          </p>
        </AnimatedSection>
        <AnimatedSection variant="slideInLeft" className="md:order-1">
          <LensList />
        </AnimatedSection>
      </section>

      <GoldDivider />

      {/* ── BRADBURY ──────────────────────────────────────────────── */}
      <AnimatedSection
        variant="scaleIn"
        className="mx-auto px-6 py-14 text-center md:py-[4.5rem]"
        style={{ maxWidth: 1120 }}
      >
        <h2
          className="text-foreground font-display mx-auto mb-5 max-w-[18ch] leading-[1.2] font-normal tracking-[-0.01em]"
          style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
        >
          Everything points to{" "}
          <em className="italic" style={{ color: gold }}>
            deeper reading.
          </em>
        </h2>
        <p className="text-muted-foreground mx-auto mb-7 font-sans text-[18px] leading-[1.6]">
          We're not a summarization engine. Instead, we encourage individual
          critical thinking and independent research.
        </p>
        <WorkflowHero />
        <Link
          href="#waitlist"
          className="bg-primary text-primary-foreground inline-flex h-[52px] cursor-pointer items-center justify-center rounded-full border-none px-7 font-sans text-[16px] font-medium whitespace-nowrap no-underline transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
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
        <p className="tracking-label text-muted-foreground mb-[14px] text-center font-sans text-[12px] font-medium uppercase">
          Early Access
        </p>
        <h2
          className="text-foreground font-display mb-4 leading-[1.2] font-bold tracking-[-0.02em]"
          style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
        >
          Be first when Billion opens.
        </h2>
        <p className="text-muted-foreground mx-auto mb-7 max-w-[44ch] font-sans text-[18px] leading-[1.6]">
          Early access, updates, and pilot invites.
        </p>
        <WaitlistForm size="large" />
      </AnimatedSection>

      <GoldDivider />

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer
        className="mx-auto flex flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-muted-foreground font-display text-[18px] font-bold">
          Billion
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-sans text-[13px] sm:justify-end">
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
