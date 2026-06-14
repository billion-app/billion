"use client";

import {
  AnimatedCard,
  StaggerContainer,
  StaggerItem,
} from "./animations";

const gold = "#c4a35a";

function Badge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-[6px] px-[10px] text-[11px] font-medium text-white uppercase font-sans"
      style={{ backgroundColor: color, letterSpacing: "0.08em" }}
    >
      {type}
    </span>
  );
}

function WorkflowPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-medium text-white font-sans"
      style={{
        borderColor: `${color}66`,
        backgroundColor: `${color}18`,
      }}
    >
      {label}
    </span>
  );
}

export function WorkflowHero() {
  return (
    <StaggerContainer
      staggerDelay={0.1}
      className="mt-10 mb-7 grid grid-cols-1 gap-[14px] md:grid-cols-[1.5fr_1fr_1fr]"
    >
      {/* Bradbury */}
      <StaggerItem variant="scaleIn">
        <AnimatedCard
          accent
          className="rounded-[14px] p-7 bg-card border border-border text-left"
          style={{ borderTopWidth: 2, borderTopColor: gold }}
        >
          <Badge type="Bradbury" color={gold} />
          <h3 className="mt-[14px] mb-[10px] text-[1.25rem] leading-[1.3] font-bold text-white font-editorial">
            Every summary should start a deeper read.
          </h3>
          <p className="m-0 text-[15px] leading-[1.6] text-muted-foreground font-sans">
            Billion keeps the short version useful, but never treats it as the
            destination. The product path should move people from curiosity to
            source material.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <WorkflowPill label="Discover" color="#4a7cff" />
            <span className="text-[13px] text-white/25 font-sans">-&gt;</span>
            <WorkflowPill label="Understand" color="#0891b2" />
            <span className="text-[13px] text-white/25 font-sans">-&gt;</span>
            <WorkflowPill label="Compare" color="#6366f1" />
            <span className="text-[13px] text-white/25 font-sans">-&gt;</span>
            <WorkflowPill label="Verify" color={gold} />
          </div>
          <p
            className="mt-4 mb-0 text-[12px] font-medium font-sans"
            style={{ color: gold, opacity: 0.85 }}
          >
            The summary is a doorway, not the room.
          </p>
        </AnimatedCard>
      </StaggerItem>

      {/* Compare */}
      <StaggerItem variant="scaleIn">
        <AnimatedCard
          className="rounded-[14px] p-7 bg-card border border-border text-left"
          style={{ borderTopWidth: 2, borderTopColor: "#6366f1" }}
        >
          <Badge type="Compare" color="#6366f1" />
          <h3 className="mt-[14px] mb-[10px] text-[1.25rem] leading-[1.3] font-bold text-white font-editorial">
            Show disagreement clearly.
          </h3>
          <p className="m-0 text-[15px] leading-[1.6] text-muted-foreground font-sans">
            Put competing readings beside each other with transparent labels
            instead of compressing them into a false middle.
          </p>
        </AnimatedCard>
      </StaggerItem>

      {/* Verify */}
      <StaggerItem variant="scaleIn">
        <AnimatedCard
          className="rounded-[14px] p-7 bg-card border border-border text-left"
          style={{ borderTopWidth: 2, borderTopColor: "#0891b2" }}
        >
          <Badge type="Verify" color="#0891b2" />
          <h3 className="mt-[14px] mb-[10px] text-[1.25rem] leading-[1.3] font-bold text-white font-editorial">
            Keep the source one tap away.
          </h3>
          <p className="m-0 text-[15px] leading-[1.6] text-muted-foreground font-sans">
            Every generated brief should lead back to the bill text, filing,
            decision, voter guide, or official publication it came from.
          </p>
        </AnimatedCard>
      </StaggerItem>
    </StaggerContainer>
  );
}
