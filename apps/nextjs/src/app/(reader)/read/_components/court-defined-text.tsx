"use client";

import { useState } from "react";

import { Icon } from "../../_components/icon";

export interface CourtTerm {
  term: string;
  plain: string;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Legal terms stay in the sentence and disclose their case-specific meaning. */
export function CourtDefinedText({
  text,
  terms,
  accent,
  className,
}: {
  text: string;
  terms: readonly CourtTerm[];
  accent: string;
  className: string;
}) {
  const [openTerm, setOpenTerm] = useState<CourtTerm | null>(null);
  const usableTerms = terms
    .filter((term) => term.term.trim())
    .sort((left, right) => right.term.length - left.term.length);
  const byName = new Map(
    usableTerms.map((term) => [term.term.toLocaleLowerCase(), term]),
  );
  const pattern = usableTerms.length
    ? new RegExp(
        `\\b(${usableTerms.map((term) => escapePattern(term.term)).join("|")})\\b`,
        "gi",
      )
    : null;
  const parts = pattern ? text.split(pattern) : [text];

  return (
    <div>
      <p className={className}>
        {parts.map((part, index) => {
          const term = byName.get(part.toLocaleLowerCase());
          if (!term) return part;
          const expanded = openTerm?.term === term.term;
          return (
            <button
              key={`${term.term}-${index}`}
              type="button"
              onClick={() => setOpenTerm(expanded ? null : term)}
              aria-expanded={expanded}
              aria-label={`Define ${term.term}`}
              className="cursor-pointer border-0 bg-transparent p-0 font-semibold underline decoration-1 underline-offset-[3px] [font:inherit]"
              style={{ color: accent }}
            >
              {part}
            </button>
          );
        })}
      </p>
      {openTerm ? (
        <div
          role="status"
          className="mt-2 rounded-[10px] border p-3"
          style={{
            backgroundColor: `${accent}12`,
            borderColor: `${accent}55`,
          }}
          data-testid="court-term-definition"
        >
          <p
            className="mb-1 flex items-center gap-[6px] font-sans text-[12px] font-semibold"
            style={{ color: accent }}
          >
            <Icon name="book" size={13} />
            {openTerm.term}
          </p>
          <p className="font-sans text-[13px] leading-[19px] text-white/[0.8]">
            {openTerm.plain}
          </p>
        </div>
      ) : null}
    </div>
  );
}
