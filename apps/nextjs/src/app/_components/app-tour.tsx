"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";

import { AnimatedSection, CountUp, EASE_OUT_QUART } from "./animations";

/* ── See it in the app ────────────────────────────────────────────────────
   One block per area of the app, not one giant demo trying to cover
   everything — and not the same phone screenshots already shown in the
   hero. Each block is its own small interactive widget, built for the web
   rather than a shrunk-down phone mockup, illustrating the real mechanic
   from that part of the app (apps/expo) with example content rather than
   live data. Each one is a genuinely different artifact — a docket list,
   a candidate face-off, a card deck — not the same card reskinned three
   times. */

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M7 21h10" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1.5 font-sans text-[12px] font-medium whitespace-nowrap transition-colors duration-150"
      style={{
        borderColor: active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
        backgroundColor: active ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? "#EAF0FF" : "#8A8FA0",
      }}
    >
      {children}
    </button>
  );
}

/* ── Browse — a docket list ────────────────────────────────────────────── */

const browseFilters = ["All", "Bills", "Executive", "Courts"] as const;

const browseExamples = [
  {
    id: "bill",
    filter: "Bills",
    type: "BILL",
    color: "#4A7CFF",
    title:
      'To redesignate the Congressional Budget Office as the "China Budget Office".',
    snippet:
      'CBO redesignated to "China Budget Office" to focus on trade relations and export controls.',
    source: "Congress.gov",
  },
  {
    id: "order",
    filter: "Executive",
    type: "ORDER",
    color: "#6366F1",
    title: "E.O. 14192 — Agency Reporting Standards",
    snippet: "Standardizes how agencies report compliance data to the public.",
    source: "White House",
  },
  {
    id: "case",
    filter: "Courts",
    type: "CASE",
    color: "#0891B2",
    title: "Doe v. State Board",
    snippet: "Rules on the board's authority to set eligibility requirements.",
    source: "Federal Courts",
  },
] as const;

// Real Browse is search + filter + a scrolling list of results, not one
// card that swaps — so this shows all three examples at once, always
// mounted, and filtering just dims the rows that don't match (a persistent
// opacity animation, not mount/unmount) rather than swapping content.
function BrowseDemo() {
  const [filter, setFilter] = useState<(typeof browseFilters)[number]>("All");

  return (
    <div className="bg-card w-full max-w-[420px] rounded-[14px] border border-white/10 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <SearchIcon className="h-4 w-4 shrink-0 text-white/35" />
        <span className="font-sans text-[13px] text-white/35">
          Search bills, cases, orders…
        </span>
      </div>

      <div role="group" aria-label="Filter by type" className="mb-1 flex gap-2">
        {browseFilters.map((f) => (
          <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Pill>
        ))}
      </div>

      <div className="divide-y divide-white/[0.07]">
        {browseExamples.map((ex) => {
          const dimmed = filter !== "All" && filter !== ex.filter;
          return (
            <motion.div
              key={ex.id}
              animate={{ opacity: dimmed ? 0.22 : 1 }}
              transition={{ duration: 0.25, ease: EASE_OUT_QUART }}
              className="flex items-start gap-3 py-3 first:pt-3 last:pb-0"
            >
              <span
                className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-[5px] px-2 text-[9.5px] font-medium text-white uppercase"
                style={{ backgroundColor: ex.color, letterSpacing: "0.06em" }}
              >
                {ex.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-editorial text-foreground line-clamp-2 text-[13.5px] leading-[1.3] font-bold">
                  {ex.title}
                </p>
                <p className="text-muted-foreground mt-1 line-clamp-1 font-sans text-[12px] leading-[1.4]">
                  {ex.snippet}
                </p>
                <span className="mt-1 flex items-center gap-1.5 font-sans text-[10.5px] font-semibold text-white/50 uppercase">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: ex.color }}
                  />
                  {ex.source}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Elections — candidate face-off + measure card ───────────────────────
   No ballot paper, no box — a candidate comparison and a measure card
   instead. Fully static content (no click, no scroll-scrubbing): each
   panel and its check/X verdict fade in once as the section scrolls into
   view, the same one-shot reveal every block on this page already uses.
   The address matches the one shown in the real elections.png screenshot
   in the hero. */

function CandidateSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="20" r="13" fill="currentColor" />
      <path
        d="M32 38c-14.36 0-26 10.088-26 22.53V62h52v-1.47C58 48.088 46.36 38 32 38Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface Candidate {
  id: string;
  name: string;
  party: string;
  partyColor: string;
  brief: string;
  verdict: "check" | "x";
}

// Party colors deliberately avoid red/blue partisan coding, matching the
// real app (apps/expo/src/app/contest-detail.tsx: `partyColor`) — a muted
// blue for Democratic, a neutral grey for Republican, never red.
const candidates: [Candidate, Candidate] = [
  {
    id: "alvarez",
    name: "J. Alvarez",
    party: "Democratic · Incumbent",
    partyColor: "#7BA0FF",
    brief:
      "Serving since 2019. Focused on infrastructure funding and veterans' services.",
    verdict: "check",
  },
  {
    id: "chen",
    name: "R. Chen",
    party: "Republican",
    partyColor: "#C9CDDA",
    brief: "Small business owner running on tax reform and local hiring.",
    verdict: "x",
  },
];

function CandidatePanel({
  candidate,
  delay,
}: {
  candidate: Candidate;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: EASE_OUT_QUART, delay }}
      className="flex w-[132px] flex-col items-center text-center"
    >
      <div className="relative mb-3 h-14 w-14 shrink-0">
        <CandidateSilhouette className="h-14 w-14 text-white/15" />
        <motion.span
          initial={{ opacity: 0, scale: 0.4 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{
            duration: 0.35,
            ease: EASE_OUT_QUART,
            delay: delay + 0.35,
          }}
          className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full"
          style={
            candidate.verdict === "check"
              ? { backgroundColor: "#FFFFFF" }
              : {
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                }
          }
        >
          {candidate.verdict === "check" ? (
            <CheckIcon className="h-3.5 w-3.5 text-[#0E1530]" />
          ) : (
            <XIcon className="h-3 w-3 text-white/45" />
          )}
        </motion.span>
      </div>
      <p className="font-editorial text-foreground text-[14px] font-bold">
        {candidate.name}
      </p>
      <p
        className="mb-2 font-sans text-[11px]"
        style={{ color: candidate.partyColor }}
      >
        {candidate.party}
      </p>
      <p className="font-sans text-[11.5px] leading-[1.45] text-white/65">
        {candidate.brief}
      </p>
    </motion.div>
  );
}

function StanceRow({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "yes" | "no";
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: tone === "yes" ? "#10B981" : "#EF4444" }}
      />
      <p className="font-sans text-[12px] leading-[1.5] text-white/75">
        <span className="text-foreground font-semibold">{label}</span> {text}
      </p>
    </div>
  );
}

// Mirrors the real app's own measure stance rows (apps/expo/src/app/(tabs)/
// elections.tsx MeasureCard: green "A YES vote means" / red "A NO vote
// means") — success/error tokens already defined in this project's
// DESIGN.md, not invented colors.
function MeasureCard() {
  return (
    <div className="bg-card w-full max-w-[360px] rounded-[14px] border border-white/10 p-4 sm:p-5">
      <p className="font-editorial text-foreground mb-3 text-[13px] font-bold">
        Prop 12 — Water Infrastructure Bond
      </p>
      <div className="flex flex-col gap-2.5">
        <StanceRow
          label="A yes vote allows"
          text="the state to borrow money to repair unsafe pipes and expand water storage to save more water for droughts."
          tone="yes"
        />
        <StanceRow
          label="A no vote means"
          text="the state will not borrow money for these specific projects, with repairs continuing at the current, slower pace."
          tone="no"
        />
      </div>
    </div>
  );
}

function ElectionsDemo() {
  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-8 rounded-[14px] border border-white/10 px-6 py-7">
      <div className="flex flex-col items-center gap-2.5">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-sans text-[10.5px] font-semibold tracking-[0.05em] text-white/50 uppercase">
          Example ballot
        </span>
        <div className="flex items-center gap-1.5">
          <PinIcon className="h-3 w-3 shrink-0 text-white/35" />
          <span className="font-sans text-[11px] text-white/45">
            1414 K Street, Sacramento, CA
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col items-center">
        <span className="mb-4 font-sans text-[11px] font-semibold text-white/40">
          U.S. Representative, District 17
        </span>
        <div className="flex justify-center gap-8">
          <CandidatePanel candidate={candidates[0]} delay={0} />
          <CandidatePanel candidate={candidates[1]} delay={0.12} />
        </div>
      </div>

      <MeasureCard />
    </div>
  );
}

/* ── Feed (Dual-Lens folded in) — a paged card deck ──────────────────────── */

interface Topic {
  id: string;
  title: string;
  summary: string;
  balance: number; // 0–100 position on the spectrum track, visual only
  left: { stance: string; points: string[] };
  right: { stance: string; points: string[] };
}

const topics: [Topic, ...Topic[]] = [
  {
    id: "hr4021",
    title: "H.R. 4021 — Authorization Extension",
    summary:
      "Extends an expiring program's authorization to prevent a funding gap.",
    balance: 64,
    left: {
      stance: "Supporters argue",
      points: ["Closes a funding gap before the deadline"],
    },
    right: {
      stance: "Critics counter",
      points: ["An extension, not a permanent fix"],
    },
  },
  {
    id: "eo14192",
    title: "E.O. 14192 — Agency Reporting",
    summary: "Standardizes how agencies report compliance data to the public.",
    balance: 48,
    left: {
      stance: "Supporters argue",
      points: ["Standardizes reporting across agencies"],
    },
    right: {
      stance: "Critics counter",
      points: ["Adds compliance cost for smaller agencies"],
    },
  },
  {
    id: "doe-v-board",
    title: "Doe v. State Board",
    summary: "Rules on the board's authority to set eligibility requirements.",
    balance: 33,
    left: {
      stance: "Supporters argue",
      points: ["Upholds the board's original authority"],
    },
    right: {
      stance: "Critics counter",
      points: ["Narrows protections set by a prior ruling"],
    },
  },
];

function SpectrumGauge({ balance }: { balance: number }) {
  return (
    <div>
      <div className="relative h-1 rounded-full bg-white/10">
        <span
          className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25"
          style={{ left: "6%" }}
        />
        <span
          className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25"
          style={{ left: "94%" }}
        />
        <motion.span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_#272D3C]"
          animate={{ left: `${balance}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
        />
      </div>
      <div className="mt-2 flex justify-between font-sans text-[8.5px] font-semibold tracking-[0.1em] text-white/40 uppercase">
        <span>Progressive</span>
        <span>Center</span>
        <span>Conservative</span>
      </div>
    </div>
  );
}

// Real Feed is a paginated FlatList — one full-bleed card at a time, not a
// filter grid — so this fans two dimmed "ghost" cards behind the front one
// and pages between topics with a thin Stories-style progress bar instead
// of Browse's pill row.
function FeedDemo() {
  const [active, setActive] = useState<Topic>(topics[0]);

  const advance = () => {
    const idx = topics.findIndex((t) => t.id === active.id);
    setActive(topics[(idx + 1) % topics.length] ?? topics[0]);
  };

  return (
    <div className="relative w-full max-w-[380px] pt-3">
      <div
        aria-hidden="true"
        className="bg-card absolute inset-0 rounded-[16px] border border-white/8"
        style={{
          transform: "rotate(-9deg) translateX(-22px) translateY(2px)",
          transformOrigin: "bottom center",
          opacity: 0.38,
        }}
      />
      <div
        aria-hidden="true"
        className="bg-card absolute inset-0 rounded-[16px] border border-white/10"
        style={{
          transform: "rotate(6deg) translateX(16px) translateY(1px)",
          transformOrigin: "bottom center",
          opacity: 0.62,
        }}
      />

      <div className="bg-card relative rounded-[16px] border border-white/10 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div
            role="group"
            aria-label="Choose an example to compare"
            className="flex flex-1 gap-1.5"
          >
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActive(topic)}
                aria-label={`Show ${topic.title}`}
                aria-pressed={topic.id === active.id}
                className="flex flex-1 items-center"
                style={{ minHeight: 44 }}
              >
                <span
                  className="block h-[3px] w-full rounded-full transition-colors duration-200"
                  style={{
                    backgroundColor:
                      topic.id === active.id
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.15)",
                  }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={advance}
            aria-label="Show next example"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/50 transition-colors duration-150 hover:text-white"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.05]">
            <ScaleIcon className="text-foreground h-4 w-4" />
          </div>
          <div>
            <div className="font-editorial text-foreground text-[14px] font-bold">
              Dual-Lens
            </div>
            <div className="text-muted-foreground font-sans text-[11px]">
              Both political viewpoints, side-by-side.
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="font-editorial text-foreground mb-1 text-[13px] font-bold">
            {active.title}
          </p>
          <p className="font-sans text-[12px] leading-[1.4] text-white/70">
            {active.summary}
          </p>
        </div>

        <div className="mb-5">
          <SpectrumGauge balance={active.balance} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE_OUT_QUART }}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          >
            <div className="rounded-[10px] border border-white/10 bg-white/[0.03] p-3">
              <span className="mb-1.5 block font-sans text-[9px] font-semibold tracking-[0.1em] text-white/45 uppercase">
                One view
              </span>
              <p className="font-editorial text-foreground mb-1.5 text-[13px] font-bold">
                {active.left.stance}
              </p>
              <p className="font-sans text-[12px] leading-[1.4] text-white/75">
                {active.left.points[0]}
              </p>
            </div>
            <div className="rounded-[10px] border border-white/10 bg-white/[0.03] p-3">
              <span className="mb-1.5 block font-sans text-[9px] font-semibold tracking-[0.1em] text-white/45 uppercase">
                Another view
              </span>
              <p className="font-editorial text-foreground mb-1.5 text-[13px] font-bold">
                {active.right.stance}
              </p>
              <p className="font-sans text-[12px] leading-[1.4] text-white/75">
                {active.right.points[0]}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Source-merge diagram ──────────────────────────────────────────────── */

const sourceSystems = [
  {
    type: "BILL",
    color: "#4A7CFF",
    title: "Bills",
    signal: "Status, sponsors, amendments",
    source: "Congress.gov",
    count: 4392,
  },
  {
    type: "CASE",
    color: "#0891B2",
    title: "Cases",
    signal: "Filings, rulings, timelines",
    source: "Federal courts",
  },
  {
    type: "ORDER",
    color: "#6366F1",
    title: "Orders",
    signal: "Authority, agencies, challenges",
    source: "White House",
  },
];

function SourceColumn({ system }: { system: (typeof sourceSystems)[number] }) {
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <h4
        className="font-editorial bg-card mb-1 inline-flex rounded-[6px] px-3 py-1 text-[16px] leading-[1.2] font-bold"
        style={{ color: system.color }}
      >
        {system.title}
      </h4>
      <p className="text-muted-foreground m-0 max-w-[24ch] font-sans text-[13px] leading-[1.45]">
        {typeof system.count === "number" ? (
          <>
            <span className="text-white/75">
              <CountUp to={system.count} duration={2} /> tracked
            </span>
            <br />
          </>
        ) : null}
        {system.signal}
      </p>
      <p
        className="mt-2.5 flex items-center gap-1.5 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase"
        style={{ color: system.color, opacity: 0.9 }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: system.color }}
        />
        {system.source}
      </p>
    </div>
  );
}

// The three pillars physically combine into "Your feed" — the columns
// themselves slide toward the center, shrink, and fade, rather than static
// connector lines growing between stationary cards (that read as an org
// chart, not a merge). No pin this time: the block stays in normal,
// static document flow the whole time — pinning it (sticky inside a taller
// wrapper) made it visibly jump from its natural position to the "stuck"
// one right as the pin engaged. Instead, the merge is driven by the
// block's own ordinary scroll position as it passes through the viewport
// (offset targets a window while it's already comfortably in view, not
// its full enter/exit transit), so nothing about its position ever
// changes — only the columns and "Your feed" animate.
//
// Fully reversible: every value here is either a continuous
// scrollYProgress-derived transform or a threshold check re-evaluated on
// every scroll event, so scrolling back up unwinds the same sequence
// instead of just re-running the entrance once.
//
// The combine motion itself is desktop-only (sm: and up, matching the
// grid's own sm:grid-cols-3): mobile gets the columns in normal flow with
// no slide/shrink — percentage-based x is relative to each column's own
// width, and once columns stack full-width on mobile that reads as an
// unwanted diagonal drift rather than a clean slide-together.
//
// "Your feed" is a one-time threshold trigger rather than a continuous
// scroll-linked opacity — driving opacity straight off scrollYProgress
// faded the label back out near the end of its tracked range even here,
// transform-based x/scale didn't have this problem. Flipping a boolean
// once sidesteps it entirely.
function SourceMergeDiagram() {
  const mergeRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: mergeRef,
    offset: ["center 0.45", "center 0.05"],
  });

  // Mostly ease-in on purpose, not the site's usual ease-out: the
  // shrink/slide starts slow (barely moving at first) and accelerates
  // through the middle, rather than a constant-speed slide. The last 15%
  // eases back out instead of continuing to accelerate all the way to the
  // end, so it lands as a soft settle rather than an abrupt full-speed
  // stop.
  const easeIn = (t: number) => {
    const accelerateUntil = 0.85;
    if (t <= accelerateUntil) return t ** 2.2;
    const tailProgress = (t - accelerateUntil) / (1 - accelerateUntil);
    const valueAtSeam = accelerateUntil ** 2.2;
    return valueAtSeam + (1 - valueAtSeam) * (1 - (1 - tailProgress) ** 2);
  };
  const billsX = useTransform(scrollYProgress, [0, 0.5], ["0%", "58%"], {
    ease: easeIn,
  });
  const ordersX = useTransform(scrollYProgress, [0, 0.5], ["0%", "-58%"], {
    ease: easeIn,
  });
  const columnsScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.35], {
    ease: easeIn,
  });

  const [columnsFaded, setColumnsFaded] = useState(false);
  const [feedRevealed, setFeedRevealed] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setColumnsFaded(latest >= 0.42);
    setFeedRevealed(latest >= 0.55);
  });

  return (
    <div ref={mergeRef} className="relative w-full py-6">
      {/* Mobile: plain stacked columns, no combine motion. */}
      <div className="grid w-full grid-cols-1 gap-6 sm:hidden">
        {sourceSystems.map((system) => (
          <SourceColumn key={system.type} system={system} />
        ))}
      </div>

      {/* Desktop: columns slide together, shrink, and fade into "Your feed". */}
      <div className="relative hidden w-full sm:block">
        <div className="grid grid-cols-3 gap-4">
          {sourceSystems.map((system, i) => (
            // Two layers on purpose: the outer div owns the one-time
            // "pop in" entrance (a back-ease overshoot, distinct from the
            // gentle fadeUp used everywhere else on the page, meant to
            // catch the eye), the inner div owns the continuous
            // scroll-linked merge motion. Splitting them keeps the two
            // animations from fighting over the same opacity/scale
            // properties — the entrance settles once and stays there, so
            // by the time the merge's fade-out kicks in later it's
            // animating from a clean, settled base.
            <motion.div
              key={system.type}
              initial={{ opacity: 0, scale: 0.7, y: 28 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.7,
                ease: [0.34, 1.56, 0.64, 1],
                delay: i * 0.15,
              }}
            >
              <motion.div
                style={{
                  x: i === 0 ? billsX : i === 2 ? ordersX : undefined,
                  scale: columnsScale,
                }}
                initial={false}
                animate={{ opacity: columnsFaded ? 0 : 1 }}
                transition={{ duration: 0.3, ease: EASE_OUT_QUART }}
              >
                <SourceColumn system={system} />
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={false}
          animate={{
            opacity: feedRevealed ? 1 : 0,
            scale: feedRevealed ? 1 : 0.9,
          }}
          transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span
            className="font-display text-accent text-center leading-[1.2] font-normal italic"
            style={{ fontSize: "clamp(2.1rem, 4.5vw, 3.1rem)" }}
          >
            Your feed
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Layout ────────────────────────────────────────────────────────────── */

function FeatureRow({
  heading,
  copy,
  visual,
  reverse = false,
}: {
  heading: string;
  copy: string;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
      <AnimatedSection
        variant={reverse ? "slideInRight" : "slideInLeft"}
        className={`text-center md:text-left ${reverse ? "md:order-2" : ""}`}
      >
        <h3
          className="font-display text-foreground mb-3 leading-[1.2] font-bold tracking-[-0.01em]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 1.9rem)" }}
        >
          {heading}
        </h3>
        <p className="text-muted-foreground mx-auto max-w-[42ch] font-sans text-[16px] leading-[1.6] md:mx-0">
          {copy}
        </p>
      </AnimatedSection>
      <AnimatedSection
        variant={reverse ? "slideInLeft" : "slideInRight"}
        className={`flex justify-center ${reverse ? "md:order-1" : ""}`}
      >
        {visual}
      </AnimatedSection>
    </div>
  );
}

export function AppTour({ id }: { id?: string }) {
  return (
    <section
      id={id}
      className="border-y border-white/[0.06] py-12 md:py-16"
      data-testid="app-tour-section"
    >
      <div className="mx-auto px-6" style={{ maxWidth: 1120 }}>
        <AnimatedSection
          variant="fadeUp"
          className="mx-auto mb-10 max-w-[54ch] text-center md:mb-12"
        >
          <h2
            className="text-foreground font-display m-0 leading-[1.18] font-normal tracking-[-0.01em]"
            style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
          >
            See it in the app.
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 mb-0 max-w-[46ch] font-sans text-[16px] leading-[1.6]">
            Browse everything. Track your ballot. Scroll briefs and view
            sources.
          </p>
        </AnimatedSection>

        <div className="flex flex-col gap-12 md:gap-16">
          <div className="flex flex-col gap-6">
            <FeatureRow
              heading="Browse every bill, order, and ruling."
              copy="Filter by category, search by keywords, or get an overview of what policies are trending in real-time."
              visual={<BrowseDemo />}
            />
            <SourceMergeDiagram />
          </div>
          <FeatureRow
            heading="Make informed decisions before you vote."
            copy="Enter your address to see every election and real time data. View candidates, financial impact, and see a breakdown of what each candidate supports."
            visual={<ElectionsDemo />}
            reverse
          />
          <FeatureRow
            heading="Public policy explained without bias."
            copy="Short civic news briefs, paired with a Dual-Lens view so you can see and understand both pros and cons of legislation."
            visual={<FeedDemo />}
          />
        </div>
      </div>
    </section>
  );
}
