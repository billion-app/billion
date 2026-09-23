"use client";

import { cn } from "@acme/ui";

import { toggleSaved, useIsSaved } from "~/lib/reader-state";
import { Icon } from "./icon";

/**
 * Save for later. Local to this browser — there is no account to save to
 * yet — which is why the label never says "sync" or implies it follows you.
 */
export function SaveButton({
  id,
  type,
  title,
  variant = "icon",
  className,
}: {
  id: string;
  type: string;
  title: string;
  variant?: "icon" | "pill";
  className?: string;
}) {
  const saved = useIsSaved(id);
  const label = saved ? "Remove from saved" : "Save to read later";

  return (
    <button
      type="button"
      onClick={() => toggleSaved(id, { type, title })}
      aria-pressed={saved}
      aria-label={variant === "icon" ? label : undefined}
      title={variant === "icon" ? label : undefined}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 transition-colors",
        variant === "icon"
          ? "text-quiet hover:text-ink-night -m-1 rounded-md p-1"
          : "border-card-border hover:bg-slate rounded-full border px-4 py-[8px] font-sans text-[13px] font-semibold",
        saved && "text-ink-night",
        className,
      )}
    >
      <Icon
        name={saved ? "bookmarkFill" : "bookmark"}
        size={variant === "icon" ? 18 : 15}
      />
      {variant === "pill" ? (saved ? "Saved" : "Save") : null}
    </button>
  );
}
