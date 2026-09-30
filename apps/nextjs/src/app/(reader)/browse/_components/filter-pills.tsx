"use client";

import { cn } from "@acme/ui";

import type { TypeFilter } from "~/lib/browse-params";
import { FILTERS } from "~/lib/browse-params";

/**
 * The phone's filter pills: paper when selected, a hairline outline when not.
 * A horizontal scroller on narrow screens; a vertical list in the desktop rail.
 */
export function FilterPills({
  value,
  onChange,
  layout,
}: {
  value: TypeFilter;
  onChange: (next: TypeFilter) => void;
  layout: "scroll" | "rail";
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Record type"
      className={cn(
        layout === "scroll"
          ? "no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          : "flex flex-col gap-1",
      )}
    >
      {FILTERS.map((filter) => {
        const active = filter.id === value;
        return (
          <button
            key={filter.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              "shrink-0 cursor-pointer font-sans text-[13.5px] font-semibold whitespace-nowrap transition-colors",
              layout === "scroll"
                ? cn(
                    "rounded-full border px-[15px] py-[8px]",
                    active
                      ? "bg-paper border-paper text-ink-paper"
                      : "border-rule text-quiet hover:text-ink-night",
                  )
                : cn(
                    "rounded-[10px] px-3 py-[9px] text-left",
                    active
                      ? "bg-paper text-ink-paper"
                      : "text-quiet hover:bg-slate hover:text-ink-night",
                  ),
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
