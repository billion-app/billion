"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@acme/ui";

import type { Scope } from "~/lib/jurisdictions";
import { JURISDICTIONS, SCOPES } from "~/lib/jurisdictions";
import { Icon } from "../../_components/icon";

/**
 * Which government you are browsing. On the phone this is a gold row that
 * opens a sheet; on the web it is the same gold name opening a menu, and in
 * the desktop rail the choices are simply listed.
 */
export function ScopeBar({
  value,
  onChange,
  layout,
}: {
  value: Scope;
  onChange: (next: Scope) => void;
  layout: "menu" | "rail";
}) {
  if (layout === "rail") {
    return (
      <div
        role="radiogroup"
        aria-label="Jurisdiction"
        className="flex flex-col gap-1"
      >
        {SCOPES.map((scope) => {
          const item = JURISDICTIONS[scope];
          const active = scope === value;
          return (
            <button
              key={scope}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(scope)}
              className={cn(
                "flex cursor-pointer items-start gap-[10px] rounded-[10px] px-3 py-[9px] text-left transition-colors",
                active ? "bg-[rgba(212,175,55,0.12)]" : "hover:bg-slate",
              )}
            >
              <Icon
                name={scope === "federal" ? "globe" : "pin"}
                size={15}
                className={cn(
                  "mt-[2px] shrink-0",
                  active ? "text-spark" : "text-quiet",
                )}
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block font-sans text-[14px] font-semibold",
                    active ? "text-spark" : "text-ink-night",
                  )}
                >
                  {item.name}
                </span>
                <span className="text-quiet block font-sans text-[11.5px] leading-[15px]">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }
  return <ScopeMenu value={value} onChange={onChange} />;
}

function ScopeMenu({
  value,
  onChange,
}: {
  value: Scope;
  onChange: (next: Scope) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = JURISDICTIONS[value];
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Jurisdiction: ${item.body}. Change jurisdiction`}
        className="flex cursor-pointer items-center gap-[6px] py-1"
      >
        <span className="gold-foil font-sans text-[13px] font-bold tracking-[0.14em] uppercase">
          {item.name}
        </span>
        <Icon name="chevD" size={13} className="text-quiet" />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Jurisdiction"
          className="bg-slate border-menu-border absolute top-full left-0 z-40 mt-2 w-[290px] rounded-[14px] border p-[6px] shadow-[0_8px_18px_rgba(14,21,48,0.4)]"
        >
          {SCOPES.map((scope) => {
            const option = JURISDICTIONS[scope];
            const active = scope === value;
            return (
              <li key={scope} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(scope);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-[10px] rounded-[10px] px-3 py-[10px] text-left",
                    active ? "bg-[rgba(212,175,55,0.14)]" : "hover:bg-surface",
                  )}
                >
                  <Icon
                    name={scope === "federal" ? "globe" : "pin"}
                    size={15}
                    className={cn(
                      "mt-[2px]",
                      active ? "text-spark" : "text-quiet",
                    )}
                  />
                  <span>
                    <span className="text-ink-night block font-sans text-[14px] font-semibold">
                      {option.name}
                    </span>
                    <span className="text-quiet block font-sans text-[12px]">
                      {option.description}
                    </span>
                  </span>
                  {active ? (
                    <Icon
                      name="check"
                      size={15}
                      className="text-spark mt-[2px] ml-auto"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
