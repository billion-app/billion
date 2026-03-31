import Link from "next/link";
import { WaitlistForm } from "./_components/waitlist-form";

// ── Color constants matching the Svelte design ──────────────────────────────
const C = {
  deepNavy: "#0e1530",
  slate: "#272d3c",
  bill: "#4a7cff",
  executive: "#6366f1",
  case: "#0891b2",
  general: "#8a8fa0",
  border: "rgba(255,255,255,0.08)",
  borderFocus: "rgba(255,255,255,0.3)",
  success: "#10b981",
  error: "#ef4444",
};

// ── Badge ────────────────────────────────────────────────────────────────────
function Badge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-[10px] text-[11px] font-medium tracking-[0.06em] uppercase text-white"
      style={{ backgroundColor: color, height: 24 }}
    >
      {type}
    </span>
  );
}

// ── Hero content cards ───────────────────────────────────────────────────────
const HERO_CARDS = [
  {
    type: "BILL",
    color: C.bill,
    title: "H.R. 4312: National Housing Stabilization Act",
    preview: "What changed in committee, who supports it, and what it means for your state.",
    meta: "Congress.gov · Passed Committee",
    time: "2h ago",
    opacity: 1,
  },
  {
    type: "CASE",
    color: C.case,
    title: "U.S. v. Westfield Utilities",
    preview: "Majority and dissent logic, plain language, side by side.",
    meta: "U.S. Court of Appeals, 9th Circuit",
    time: "5h ago",
    opacity: 1,
  },
  {
    type: "ORDER",
    color: C.executive,
    title: "E.O. 14192: Department of Government Efficiency",
    preview: "What it authorizes, which agencies are affected, and open legal challenges.",
    meta: "",
    time: "8h ago",
    opacity: 0.7,
  },
];

function HeroCard({ card }: { card: (typeof HERO_CARDS)[number] }) {
  return (
    <div
      className="rounded-[14px] p-5"
      style={{
        backgroundColor: C.slate,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${card.color}`,
        opacity: card.opacity,
      }}
    >
      <div className="mb-[10px] flex items-center justify-between">
        <Badge type={card.type} color={card.color} />
        <span className="text-[12px]" style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}>
          {card.time}
        </span>
      </div>
      <h3
        className="mb-2 text-[1.1rem] font-normal leading-[1.35] text-white"
        style={{ fontFamily: "var(--font-inria-serif), 'Times New Roman', serif" }}
      >
        {card.title}
      </h3>
      <p className="mb-[10px] text-[14px] leading-[1.5]" style={{ color: C.general }}>
        {card.preview}
      </p>
      {card.meta && (
        <p className="m-0 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
          {card.meta}
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: C.deepNavy, color: "#fff" }}>

      {/* ── NAV ────────────────────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between px-6 py-5"
        style={{ maxWidth: 1120, margin: "0 auto" }}
      >
        <span
          className="text-[22px] font-bold tracking-[-0.02em] text-white"
          style={{ fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
        >
          Billion
        </span>
        <Link
          href="#waitlist"
          className="text-[15px] font-medium transition-colors duration-150 hover:text-white"
          style={{ color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-albert-sans)", textDecoration: "none" }}
        >
          Get Early Access
        </Link>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-10 px-6 pb-[4.5rem] pt-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pb-20 md:pt-14"
        style={{ maxWidth: 1120, animation: "fadeUp 0.6s cubic-bezier(0.25,0.1,0.25,1) both" }}
      >
        {/* Left — text */}
        <div style={{ maxWidth: 580 }}>
          <p
            className="mb-[14px] text-[12px] font-medium uppercase tracking-[0.1em]"
            style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}
          >
            AI Civic Intelligence
          </p>
          <h1
            className="mb-6 font-bold leading-[1.15] tracking-[-0.02em] text-white"
            style={{
              fontFamily: "var(--font-ibm-plex-serif), Georgia, serif",
              fontSize: "clamp(2.2rem, 5vw, 3.75rem)",
            }}
          >
            Know what government is doing before it changes your life.
          </h1>
          <p
            className="mb-7 text-[18px] leading-[1.6]"
            style={{ color: C.general, maxWidth: "52ch", fontFamily: "var(--font-albert-sans)" }}
          >
            Bills, court cases, and executive actions — explained clearly, linked to the source.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="#waitlist"
              className="inline-flex h-[52px] cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-none bg-white px-7 text-[16px] font-medium text-black transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{ fontFamily: "var(--font-albert-sans)", textDecoration: "none" }}
            >
              Get Early Access
            </Link>
            <Link
              href="#approach"
              className="inline-flex h-[52px] items-center justify-center px-1 text-[16px] font-medium transition-colors duration-150 hover:text-white"
              style={{ color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-albert-sans)", textDecoration: "none" }}
            >
              See How It Works
            </Link>
          </div>
        </div>

        {/* Right — cards */}
        <div
          className="relative flex max-h-[480px] flex-col gap-3 overflow-hidden"
          style={{ animation: "fadeUp 0.6s cubic-bezier(0.25,0.1,0.25,1) 0.15s both" }}
          aria-label="Billion content preview"
        >
          {HERO_CARDS.map((card) => (
            <HeroCard key={card.title} card={card} />
          ))}
          {/* fade mask */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[100px]"
            style={{ background: `linear-gradient(to top, ${C.deepNavy}, transparent)` }}
            aria-hidden="true"
          />
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────────── */}
      <section
        className="mx-auto grid grid-cols-1 gap-8 px-6 py-14 md:grid-cols-2 md:items-start md:gap-16 md:py-[4.5rem]"
        style={{ maxWidth: 1120, borderTop: `1px solid ${C.border}` }}
      >
        <div>
          <p
            className="mb-[14px] text-[12px] font-medium uppercase tracking-[0.1em]"
            style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}
          >
            The Problem
          </p>
          <h2
            className="m-0 font-normal leading-[1.18] tracking-[-0.01em] text-white"
            style={{
              fontFamily: "var(--font-ibm-plex-serif), Georgia, serif",
              fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
            }}
          >
            Public information exists.<br />Public understanding doesn't.
          </h2>
        </div>
        <p
          className="m-0 pt-1 text-[18px] leading-[1.65] md:pt-2"
          style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-albert-sans)" }}
        >
          Most people hear about policy through headlines, not source material. Billion closes that gap.
        </p>
      </section>

      {/* ── APPROACH ───────────────────────────────────────────────── */}
      <section
        id="approach"
        className="mx-auto px-6 py-14 md:py-[4.5rem]"
        style={{ maxWidth: 1120, borderTop: `1px solid ${C.border}` }}
      >
        <h2
          className="m-0 text-center font-normal leading-[1.18] tracking-[-0.01em] text-white"
          style={{
            fontFamily: "var(--font-ibm-plex-serif), Georgia, serif",
            fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
          }}
        >
          One civic feed.<br />Three source systems.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-[14px] md:grid-cols-[1.5fr_1fr_1fr]">
          {/* Bill */}
          <div
            className="rounded-[14px] p-7"
            style={{
              backgroundColor: C.slate,
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.bill}`,
            }}
          >
            <Badge type="BILL" color={C.bill} />
            <h3
              className="mb-[10px] mt-[14px] text-[1.25rem] font-bold leading-[1.3] text-white"
              style={{ fontFamily: "var(--font-inria-serif), 'Times New Roman', serif" }}
            >
              Congressional Legislation
            </h3>
            <p className="m-0 text-[15px] leading-[1.6]" style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}>
              Tracks sponsorship, status, and text changes. Explainers generate when source content changes — not on a schedule.
            </p>
            <p
              className="mb-0 mt-4 text-[12px] font-medium"
              style={{ color: C.bill, opacity: 0.85, fontFamily: "var(--font-albert-sans)" }}
            >
              4,392 bills tracked in the current Congress
            </p>
          </div>

          {/* Order */}
          <div
            className="rounded-[14px] p-7"
            style={{
              backgroundColor: C.slate,
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.executive}`,
            }}
          >
            <Badge type="ORDER" color={C.executive} />
            <h3
              className="mb-[10px] mt-[14px] text-[1.25rem] font-bold leading-[1.3] text-white"
              style={{ fontFamily: "var(--font-inria-serif), 'Times New Roman', serif" }}
            >
              Executive Actions
            </h3>
            <p className="m-0 text-[15px] leading-[1.6]" style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}>
              Orders, memoranda, and proclamations pulled directly from official White House publications.
            </p>
          </div>

          {/* Case */}
          <div
            className="rounded-[14px] p-7"
            style={{
              backgroundColor: C.slate,
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.case}`,
            }}
          >
            <Badge type="CASE" color={C.case} />
            <h3
              className="mb-[10px] mt-[14px] text-[1.25rem] font-bold leading-[1.3] text-white"
              style={{ fontFamily: "var(--font-inria-serif), 'Times New Roman', serif" }}
            >
              Federal Court Cases
            </h3>
            <p className="m-0 text-[15px] leading-[1.6]" style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}>
              Filings and decisions surfaced with plain-language analysis and timeline context.
            </p>
          </div>
        </div>
      </section>

      {/* ── DUAL LENS ──────────────────────────────────────────────── */}
      <section
        className="mx-auto px-6 py-14 md:py-[4.5rem]"
        style={{ maxWidth: 1120, borderTop: `1px solid ${C.border}` }}
      >
        <h2
          className="m-0 text-center font-normal leading-[1.18] tracking-[-0.01em] text-white"
          style={{
            fontFamily: "var(--font-ibm-plex-serif), Georgia, serif",
            fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
          }}
        >
          Two readings.<br />Every topic.
        </h2>
        <p
          className="mx-auto mb-0 mt-[14px] text-center text-[18px] leading-[1.6]"
          style={{ color: C.general, maxWidth: "52ch", fontFamily: "var(--font-albert-sans)" }}
        >
          Billion surfaces analysis from across the political spectrum — side by side, transparently labeled, never merged into a false middle.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-[14px] md:grid-cols-2">
          {/* Institutional Lens */}
          <div
            className="relative rounded-[14px] p-8"
            style={{
              backgroundColor: C.slate,
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.executive}`,
            }}
          >
            <p
              className="m-0 mb-[18px] text-[11px] font-medium uppercase tracking-[0.1em]"
              style={{ color: C.executive, fontFamily: "var(--font-albert-sans)" }}
            >
              Institutional Lens
            </p>
            <blockquote
              className="m-0 mb-4 border-none p-0 text-[1.15rem] font-normal leading-[1.45] text-white"
              style={{ fontFamily: "var(--font-inria-serif), 'Times New Roman', serif" }}
            >
              "Expanding federal housing mandates risks crowding out private investment and local zoning authority."
            </blockquote>
            <p className="mb-5 m-0 text-[15px] leading-[1.6]" style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}>
              Frames policy around institutional stability, federalism, and legal precedent established by prior congresses.
            </p>
            <p className="m-0 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-albert-sans)" }}>
              Re: H.R. 4312 · Institute for Housing Policy Research
            </p>
          </div>

          {/* Impact Lens */}
          <div
            className="relative rounded-[14px] p-8"
            style={{
              backgroundColor: "rgba(74,124,255,0.05)",
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.bill}`,
            }}
          >
            <p
              className="m-0 mb-[18px] text-[11px] font-medium uppercase tracking-[0.1em]"
              style={{ color: C.bill, fontFamily: "var(--font-albert-sans)" }}
            >
              Impact Lens
            </p>
            <blockquote
              className="m-0 mb-4 border-none p-0 text-[1.15rem] font-normal leading-[1.45] text-white"
              style={{ fontFamily: "var(--font-inria-serif), 'Times New Roman', serif" }}
            >
              "40 million Americans lack stable housing — federal intervention is the only mechanism at scale."
            </blockquote>
            <p className="mb-5 m-0 text-[15px] leading-[1.6]" style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}>
              Frames policy around impact on households, local economies, and the civil liberties of renters and low-income communities.
            </p>
            <p className="m-0 text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-albert-sans)" }}>
              Re: H.R. 4312 · National Housing Justice Coalition
            </p>
          </div>
        </div>
      </section>

      {/* ── BRADBURY ───────────────────────────────────────────────── */}
      <section
        className="mx-auto px-6 py-14 text-center md:py-[4.5rem]"
        style={{ maxWidth: 1120, borderTop: `1px solid ${C.border}` }}
      >
        <h2
          className="mx-auto mb-5 font-normal leading-[1.2] tracking-[-0.01em] text-white"
          style={{
            fontFamily: "var(--font-ibm-plex-serif), Georgia, serif",
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            maxWidth: "18ch",
          }}
        >
          Every summary should lead to{" "}
          <em className="italic">deeper reading.</em>
        </h2>
        <p
          className="mx-auto mb-7 text-[18px] leading-[1.7]"
          style={{ color: C.general, maxWidth: "48ch", fontFamily: "var(--font-albert-sans)" }}
        >
          We are not a summarization engine.<br /><br />
          Every piece of content Billion produces functions as an invitation — to the bill text, the filing, the full decision. If you finish reading and feel like you've got the gist, we've failed.
        </p>
        <Link
          href="#waitlist"
          className="inline-flex h-[52px] cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-none bg-white px-7 text-[16px] font-medium text-black transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]"
          style={{ fontFamily: "var(--font-albert-sans)", textDecoration: "none" }}
        >
          Explore the source
        </Link>
      </section>

      {/* ── WAITLIST ───────────────────────────────────────────────── */}
      <section
        id="waitlist"
        className="mx-auto px-6 py-14 text-center md:py-[4.5rem]"
        style={{ maxWidth: 1120, borderTop: `1px solid ${C.border}` }}
      >
        <p
          className="mb-[14px] text-center text-[12px] font-medium uppercase tracking-[0.1em]"
          style={{ color: C.general, fontFamily: "var(--font-albert-sans)" }}
        >
          Early Access
        </p>
        <h2
          className="mb-4 font-bold leading-[1.2] tracking-[-0.02em] text-white"
          style={{
            fontFamily: "var(--font-ibm-plex-serif), Georgia, serif",
            fontSize: "clamp(2rem, 4vw, 3.2rem)",
          }}
        >
          Be first when Billion opens.
        </h2>
        <p
          className="mx-auto mb-7 text-[18px] leading-[1.6]"
          style={{ color: C.general, maxWidth: "44ch", fontFamily: "var(--font-albert-sans)" }}
        >
          Early access, updates, and pilot invites.
        </p>
        <WaitlistForm size="large" />
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer
        className="mx-auto flex items-center justify-between px-6 py-8"
        style={{ maxWidth: 1120, borderTop: `1px solid ${C.border}` }}
      >
        <span
          className="text-[18px] font-bold"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-ibm-plex-serif), Georgia, serif" }}
        >
          Billion
        </span>
        <p className="m-0 text-[13px]" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-albert-sans)" }}>
          © 2026 Billion. All rights reserved.
        </p>
      </footer>

    </main>
  );
}
