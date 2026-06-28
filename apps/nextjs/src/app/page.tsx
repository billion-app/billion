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

const rawSourceLines = [
  "SEC. 204. AUTHORIZATION EXTENSION.",
  "Subsection (b)(2) is amended by striking fiscal year 2026",
  "and inserting fiscal year 2028, subject to the reporting",
  "requirements described under paragraph (4). The Secretary",
  "shall submit quarterly implementation data to the committee",
  "of jurisdiction not later than 30 days after each quarter.",
  "No funds may be obligated until the certification required",
  "under subsection (d) has been transmitted to Congress.",
  "Local agencies receiving assistance shall publish notice",
  "of material changes, appeals, waivers, and compliance dates.",
  "This section shall take effect 90 days after enactment",
  "unless superseded by subsequent appropriations language.",
];

const liftedFragments = [
  {
    text: "18-month extension",
    className: "top-[38%] left-[8%]",
    x: 170,
    y: 24,
    delay: 0.68,
  },
  {
    text: "quarterly reporting",
    className: "top-[50%] left-[12%]",
    x: 158,
    y: 34,
    delay: 0.92,
  },
  {
    text: "official source",
    className: "top-[66%] left-[7%]",
    x: 190,
    y: 68,
    delay: 1.16,
  },
];

const solutionFeatures = [
  {
    label: "Translate",
    detail:
      "Turn bills, orders, and filings into concise explanations with the legal terms unpacked.",
  },
  {
    label: "Orient",
    detail:
      "Show the timeline, decision point, and institutional context around each source.",
  },
  {
    label: "Anchor",
    detail:
      "Keep every brief tied to the official record, so readers can inspect the claim.",
  },
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

function ProblemComparison() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.45 }}
      variants={{
        hidden: { opacity: 0, x: 24 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.52, ease: "easeOut" },
        },
      }}
      className="relative min-h-[430px] overflow-hidden rounded-[18px] border border-white/10 bg-[#060b19] p-4 sm:min-h-[380px] sm:p-5"
      data-testid="problem-comparison"
    >
      <motion.div
        aria-hidden="true"
        variants={{
          hidden: { opacity: 0.36, filter: "blur(0px)" },
          visible: {
            opacity: 0.24,
            filter: reducedMotion ? "blur(0px)" : "blur(0.8px)",
            transition: { delay: 0.14, duration: 1.6, ease: "easeOut" },
          },
        }}
        className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,rgba(74,124,255,0.08),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]"
      >
        <div className="absolute top-4 right-5 left-5 flex items-center justify-between border-b border-white/10 pb-3 font-sans text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">
          <span>Raw source</span>
          <span>42 pages</span>
        </div>
        <div
          className="absolute inset-x-5 top-14 bottom-5 overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, black 14%, black 82%, transparent 100%)",
            maskImage:
              "linear-gradient(180deg, transparent 0%, black 14%, black 82%, transparent 100%)",
          }}
        >
          <motion.div
            className="flex flex-col gap-2 font-mono text-[10px] leading-[1.45] text-white/70"
            variants={{
              hidden: { y: 0 },
              visible: {
                y: reducedMotion ? 0 : [0, -172],
                transition: {
                  duration: 15,
                  repeat: Infinity,
                  ease: "linear",
                },
              },
            }}
          >
            {[...rawSourceLines, ...rawSourceLines].map((line, index) => (
              <span
                key={`${line}-${index}`}
                className="block border-b border-white/[0.045] pb-1"
              >
                {line}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {!reducedMotion &&
        liftedFragments.map((fragment) => (
          <motion.span
            key={fragment.text}
            aria-hidden="true"
            className={`absolute z-20 rounded-full border border-white/20 bg-[#d5b45f] px-3 py-1.5 font-sans text-[12px] leading-none font-bold whitespace-nowrap text-[#050b16] shadow-[0_10px_28px_rgba(196,163,90,0.3)] ring-1 ring-[rgba(255,255,255,0.12)] sm:px-3.5 sm:text-[13px] ${fragment.className}`}
            variants={{
              hidden: { opacity: 0, scale: 0.96, x: 0, y: 0 },
              visible: {
                opacity: [0, 1, 1, 0],
                scale: [0.96, 1, 1, 0.9],
                x: [0, fragment.x * 0.42, fragment.x],
                y: [0, fragment.y * 0.35, fragment.y],
                transition: {
                  duration: 3.2,
                  delay: fragment.delay,
                  ease: [0.16, 1, 0.3, 1],
                  times: [0, 0.22, 0.76, 1],
                },
              },
            }}
          >
            {fragment.text}
          </motion.span>
        ))}

      <div className="relative z-10 flex min-h-[398px] items-end sm:min-h-[348px] sm:items-center sm:justify-end">
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 18, scale: 0.98 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { delay: 0.32, duration: 0.6, ease: "easeOut" },
            },
          }}
          className="w-full overflow-hidden rounded-[18px] border border-white/12 bg-[#10182f]/95 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-md sm:max-w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <span className="font-sans text-[12px] font-semibold tracking-[0.1em] text-[#c4a35a] uppercase">
              Billion
            </span>
            <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-1 font-sans text-[11px] font-semibold text-white/46">
              <span className="rounded-full bg-white px-2.5 py-1 text-[#080d18]">
                Brief
              </span>
              <span className="px-2.5 py-1">Context</span>
              <span className="px-2.5 py-1">Source</span>
            </div>
          </div>

          <div className="space-y-3.5 p-4">
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { delay: 0.54, duration: 0.42 },
                },
              }}
              className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Badge type="Bill" color="#4a7cff" />
                <span className="font-sans text-[12px] font-medium text-white/46">
                  Committee update
                </span>
              </div>
              <h3 className="text-foreground font-editorial m-0 text-[1.35rem] leading-[1.12] font-bold">
                Funding extended, with new reporting rules.
              </h3>
              <p className="text-muted-foreground mt-2 mb-0 font-sans text-[13px] leading-[1.45]">
                The bill gives the program{" "}
                <span className="rounded-[5px] bg-[rgba(196,163,90,0.12)] px-1 text-white/82">
                  18 more months
                </span>{" "}
                and requires{" "}
                <span className="rounded-[5px] bg-[rgba(196,163,90,0.12)] px-1 text-white/82">
                  quarterly oversight reports
                </span>{" "}
                before funds move.
              </p>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { delay: 0.68, duration: 0.42 },
                },
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <div className="rounded-[12px] border border-[rgba(99,102,241,0.24)] bg-[rgba(99,102,241,0.08)] p-3">
                <p className="mb-1 font-sans text-[10px] font-semibold tracking-[0.12em] text-[#8b8dfd] uppercase">
                  Context
                </p>
                <p className="m-0 font-sans text-[12px] leading-[1.35] text-white/74">
                  Moves next to the floor calendar.
                </p>
              </div>
              <div className="rounded-[12px] border border-[rgba(8,145,178,0.22)] bg-[rgba(8,145,178,0.075)] p-3">
                <p className="mb-1 font-sans text-[10px] font-semibold tracking-[0.12em] text-[#2bb7d3] uppercase">
                  Both sides
                </p>
                <p className="m-0 font-sans text-[12px] leading-[1.35] text-white/74">
                  Supporters cite continuity. Critics want tighter audits.
                </p>
              </div>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { delay: 0.82, duration: 0.42 },
                },
              }}
              className="rounded-[12px] border border-[rgba(196,163,90,0.2)] bg-[rgba(196,163,90,0.055)] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-sans text-[10px] font-semibold tracking-[0.12em] text-[#c4a35a] uppercase">
                  Source
                </span>
                <span className="font-sans text-[11px] text-white/44">
                  Congress.gov
                </span>
              </div>
              <p className="m-0 font-mono text-[11px] leading-[1.45] text-white/62">
                &quot;...amended by striking fiscal year 2026 and{" "}
                <span className="rounded-[4px] bg-[rgba(196,163,90,0.12)] px-1 text-white/78">
                  inserting fiscal year 2028
                </span>
                ...&quot;
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function SolutionPanel() {
  return (
    <StaggerContainer
      staggerDelay={0.08}
      className="overflow-hidden rounded-[18px] border border-[rgba(196,163,90,0.18)] bg-[rgba(196,163,90,0.035)]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <span className="font-sans text-[12px] font-semibold tracking-[0.1em] text-[#c4a35a] uppercase">
          Billion
        </span>
        <span className="font-sans text-[12px] font-semibold tracking-[0.08em] text-white/45 uppercase">
          Readable source layer
        </span>
      </div>
      {solutionFeatures.map((feature, index) => (
        <StaggerItem
          key={feature.label}
          variant="fadeUp"
          className="grid gap-4 border-b border-white/[0.07] px-5 py-4 last:border-b-0 sm:grid-cols-[42px_1fr] sm:items-start"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(196,163,90,0.28)] bg-[rgba(196,163,90,0.08)] font-sans text-[12px] font-semibold text-[#c4a35a]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-foreground font-editorial m-0 text-[1.2rem] leading-[1.15] font-bold">
              {feature.label}
            </h3>
            <p className="text-muted-foreground mt-1.5 mb-0 font-sans text-[14px] leading-[1.5]">
              {feature.detail}
            </p>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
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
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-14 md:grid-cols-[1.18fr_0.82fr] md:items-center md:gap-14 md:py-[4.5rem]"
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
            The source is public.
            <br />
            It still isn&apos;t readable.
          </h2>

          <p className="text-muted-foreground mt-4 mb-0 max-w-[32ch] font-sans text-[16px] leading-[1.6]">
            Bills, orders, and court filings are technically online. They arrive
            as dense legal text, procedural status, and missing context that
            most people do not have time or training to decode.
          </p>
        </AnimatedSection>
        <div className="md:order-1">
          <ProblemComparison />
        </div>
      </section>

      <GoldDivider />

      {/* ── SOLUTION ──────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[0.95fr_1.05fr] md:items-center md:gap-16 md:py-14"
        style={{ maxWidth: 1120 }}
      >
        <AnimatedSection variant="slideInLeft">
          <p className="tracking-label text-muted-foreground mb-[14px] font-sans text-[12px] font-medium uppercase">
            The Solution: <span className="text-[#c4a35a]">Billion</span>
          </p>
          <h2
            className="text-foreground font-display m-0 leading-[1.18] font-normal tracking-[-0.01em]"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            Make the public record readable.
          </h2>
          <p className="text-muted-foreground mt-4 mb-0 max-w-[34ch] font-sans text-[16px] leading-[1.6]">
            Billion reads from official civic records, explains what changed,
            and keeps the source close enough to check.
          </p>
        </AnimatedSection>
        <AnimatedSection variant="slideInRight">
          <SolutionPanel />
        </AnimatedSection>
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
