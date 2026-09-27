"use client";

import { useEffect, useState } from "react";

import { cn } from "@acme/ui";

import type { ReaderSection } from "~/lib/reader-sections";
import { GOTO_SECTION_EVENT } from "~/lib/reader-sections";

/**
 * "On this page" — the brief's sections, one click away, in the wide-screen
 * rail. The brief is long by design (every block stands alone), and on a
 * desktop the Dual-Lens and further reading otherwise sit several screens
 * down.
 *
 * Links go through the reader rather than plain anchors, because the
 * sections only exist in the explainer view: from the original text, a click
 * has to switch back before it can scroll.
 */
export function OnThisPage({
  sections,
  accent,
}: {
  sections: ReaderSection[];
  accent: string;
}) {
  const active = useActiveSection(sections);

  return (
    <nav aria-label="On this page">
      <p className="text-quiet mb-3 font-sans text-[10px] font-bold tracking-[0.21em] uppercase">
        On this page
      </p>
      <ol className="border-hair-2 m-0 flex list-none flex-col border-l p-0">
        {sections.map((section) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  window.dispatchEvent(
                    new CustomEvent(GOTO_SECTION_EVENT, { detail: section.id }),
                  );
                }}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-[6px] pl-4 font-sans text-[13.5px] leading-[18px] no-underline transition-colors",
                  isActive
                    ? "text-ink-night font-semibold"
                    : "text-quiet hover:text-ink-night border-transparent",
                )}
                style={isActive ? { borderLeftColor: accent } : undefined}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The last section whose heading has scrolled past the top of the viewport. */
function useActiveSection(sections: ReaderSection[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top < 140) current = section.id;
      }
      // At the very bottom, the last section is the one being read even if
      // its heading never reaches the top.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      const last = sections.at(-1);
      if (atBottom && last && document.getElementById(last.id)) {
        current = last.id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener(GOTO_SECTION_EVENT, schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(GOTO_SECTION_EVENT, schedule);
    };
  }, [sections]);

  return active;
}
