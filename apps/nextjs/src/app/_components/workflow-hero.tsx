"use client";

import { StaggerContainer, StaggerItem } from "./animations";

const gold = "#c4a35a";
const steps = [
  {
    label: "Discover",
    detail: "Catch source-record changes as bills, orders, and rulings move.",
    color: "#4a7cff",
  },
  {
    label: "Understand",
    detail: "See status, stakes, and timeline without losing the source.",
    color: "#0891b2",
  },
  {
    label: "Compare",
    detail: "Read competing interpretations side by side, clearly labeled.",
    color: "#6366f1",
  },
  {
    label: "Verify",
    detail: "Open the bill, order, filing, or opinion behind the brief.",
    color: gold,
  },
];

function Badge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-[6px] px-[10px] font-sans text-[11px] font-medium text-white uppercase"
      style={{ backgroundColor: color, letterSpacing: "0.08em" }}
    >
      {type}
    </span>
  );
}

export function WorkflowHero() {
  return (
    <StaggerContainer
      staggerDelay={0.1}
      className="mx-auto mt-8 mb-7 grid max-w-[900px] grid-cols-1 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.03] md:grid-cols-4"
    >
      {steps.map((step, index) => (
        <StaggerItem
          key={step.label}
          variant="fadeUp"
          className="group relative border-b border-white/[0.07] p-4 text-left transition-colors duration-200 last:border-b-0 hover:bg-white/[0.035] md:border-r md:border-b-0 md:last:border-r-0"
        >
          <span
            className="absolute top-0 right-4 left-4 h-[2px] rounded-full"
            style={{ backgroundColor: step.color }}
            aria-hidden="true"
          />
          <div className="flex gap-3">
            <Badge type={`0${index + 1}`} color={step.color} />
            <div>
              <h3 className="text-foreground font-editorial m-0 text-[1.08rem] leading-[1.15] font-bold">
                {step.label}
              </h3>
              <p className="text-muted-foreground mt-2 mb-0 font-sans text-[13px] leading-[1.5]">
                {step.detail}
              </p>
            </div>
          </div>
          {index < steps.length - 1 && (
            <span
              className="absolute top-1/2 right-[-5px] z-10 hidden h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-t border-r border-white/12 bg-[#070c1c] md:block"
              aria-hidden="true"
            />
          )}
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
