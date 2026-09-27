"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@acme/ui";

import { GOTO_SECTION_EVENT } from "~/lib/reader-sections";
import { findQuote } from "~/lib/source-match";
import { Icon } from "../../_components/icon";

export interface BriefQuote {
  text: string;
  locator?: string;
  documentId?: string;
}

type Mode = "explainer" | "source";

const ViewSourceContext = createContext<(quote: BriefQuote) => void>(
  () => undefined,
);

/**
 * The part of the reader that has state: which view is showing, whether the
 * provenance note is open, and which quoted passage to find in the source.
 *
 * The explainer itself is rendered on the server and handed in as a slot,
 * so the brief costs no client JavaScript beyond this toggle.
 *
 * The toggle ships in the first reader on purpose: a page that showed the
 * brief with no way to the source would present AI analysis as the record.
 */
export function ReaderBody({
  accent,
  hasBrief,
  explainer,
  timeline,
  original,
  sourceUrl,
  isFederalRegister,
  isCourtCase,
}: {
  accent: string;
  hasBrief: boolean;
  explainer: ReactNode;
  timeline: ReactNode;
  original: string;
  sourceUrl?: string;
  isFederalRegister: boolean;
  isCourtCase: boolean;
}) {
  const [mode, setMode] = useState<Mode>("explainer");
  const [highlight, setHighlight] = useState<BriefQuote | null>(null);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const changeMode = (next: Mode) => {
    setHighlight(null);
    setMode(next);
  };

  const viewSource = (quote: BriefQuote) => {
    setHighlight(quote);
    setMode("source");
  };

  // "On this page" asks for a section by id. Sections live in the explainer,
  // so from the original text switch back first and scroll once it renders.
  const pendingSection = useRef<string | null>(null);
  useEffect(() => {
    const onGoto = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (mode === "source") {
        pendingSection.current = id;
        setHighlight(null);
        setMode("explainer");
      } else {
        scrollToSection(id);
      }
    };
    window.addEventListener(GOTO_SECTION_EVENT, onGoto);
    return () => window.removeEventListener(GOTO_SECTION_EVENT, onGoto);
  }, [mode]);
  useEffect(() => {
    if (mode !== "explainer" || !pendingSection.current) return;
    scrollToSection(pendingSection.current);
    pendingSection.current = null;
  }, [mode]);

  return (
    <ViewSourceContext.Provider value={viewSource}>
      <div ref={top} className="scroll-mt-20">
        <Segmented
          value={mode}
          onChange={changeMode}
          options={[
            {
              id: "explainer",
              label:
                isCourtCase && hasBrief
                  ? "Case brief"
                  : hasBrief
                    ? "The brief"
                    : "Plain explainer",
              icon: "sparkle",
            },
            {
              id: "source",
              label: isCourtCase ? "Court record" : "Original text",
              icon: "doc",
            },
          ]}
        />
      </div>

      {mode === "explainer" ? (
        <>
          <div className="border-hair-1 mt-[18px] mb-[22px] rounded-[12px] border bg-[rgba(255,255,255,0.02)] px-[14px] py-3">
            <button
              type="button"
              onClick={() => setProvenanceOpen((v) => !v)}
              aria-expanded={provenanceOpen}
              className="flex w-full cursor-pointer items-center gap-[10px] text-left"
            >
              <span style={{ color: accent }}>
                <Icon name="sparkle" size={17} />
              </span>
              <span className="flex-1 font-sans text-[13px] font-semibold text-white/[0.88]">
                Written by Billion AI · Always check the source
              </span>
              <span
                className="font-sans text-[12px] font-semibold"
                style={{ color: accent }}
              >
                {provenanceOpen ? "Hide" : "Details"}
              </span>
              <span style={{ color: accent }}>
                <Icon
                  name="chevD"
                  size={14}
                  className={cn(
                    "transition-transform",
                    provenanceOpen && "rotate-180",
                  )}
                />
              </span>
            </button>
            {provenanceOpen ? (
              <p className="text-quiet mt-2 pl-[27px] font-sans text-[13px] leading-[19px]">
                Created from the official text.{" "}
                {hasBrief
                  ? "Quoted passages are checked against that source; everything else is AI analysis."
                  : "The plain-language explanation is AI analysis."}{" "}
                Use Original text or the linked official site to verify details.
              </p>
            ) : null}
          </div>
          <div data-testid="article-content">{explainer}</div>
        </>
      ) : (
        <div className="mt-[18px]">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary-blue mb-[18px] flex h-12 w-full items-center justify-center gap-2 rounded-[14px] font-sans text-[15px] font-semibold text-white no-underline hover:brightness-110"
            >
              {isFederalRegister
                ? "View Federal Register record"
                : isCourtCase
                  ? "Open official court record"
                  : "View on Original Site"}
              <Icon name="external" size={16} />
            </a>
          ) : null}
          <SourcePanel
            text={original}
            quote={highlight}
            accent={accent}
            onClear={() => setHighlight(null)}
            title={isCourtCase ? "Court record" : "Original text"}
          />
        </div>
      )}

      <div className="mt-8">{timeline}</div>

      {mode === "explainer" ? (
        <section className="border-rule mt-10 border-t pt-8 text-center md:text-left">
          <h2 className="font-display text-[26px] leading-[31px] font-bold tracking-[-0.02em]">
            Don&apos;t take our word for it.
          </h2>
          <p className="text-quiet mx-auto mt-2 mb-5 max-w-[460px] font-sans text-[15px] leading-[22px] md:mx-0">
            {isCourtCase
              ? "Read the full court record and verify the explanation against the official source."
              : "Read the full, unedited text and track every action on the official record."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary-blue flex h-12 items-center justify-center gap-2 rounded-[14px] px-6 font-sans text-[15px] font-semibold text-white no-underline hover:brightness-110"
              >
                {isCourtCase ? "Open the court record" : "Open the source"}{" "}
                <Icon name="external" size={16} />
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                changeMode("source");
                top.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="border-card-border text-ink-night hover:bg-slate flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border px-6 font-sans text-[15px] font-semibold"
            >
              {isCourtCase
                ? "Read the court record here"
                : "Read the original text here"}
            </button>
          </div>
        </section>
      ) : null}
    </ViewSourceContext.Provider>
  );
}

/** "View source" on a change card: jump to the quoted passage in the original text. */
export function ViewSourceButton({
  quote,
  accent,
}: {
  quote: BriefQuote;
  accent: string;
}) {
  const viewSource = useContext(ViewSourceContext);
  return (
    <button
      type="button"
      onClick={() => viewSource(quote)}
      aria-label={`View source${quote.locator ? ` at ${quote.locator}` : ""}`}
      className="inline-flex cursor-pointer items-center gap-[6px] rounded-full px-[13px] py-[7px] font-sans text-[12.5px] font-semibold text-white hover:brightness-110"
      style={{ backgroundColor: accent }}
    >
      View source <Icon name="arrowRight" size={13} />
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
  options: { id: Mode; label: string; icon: "sparkle" | "doc" }[];
}) {
  return (
    <div
      role="tablist"
      aria-label="Reading mode"
      className="bg-slate border-card-border flex gap-1 rounded-[14px] border p-1"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex h-[38px] flex-1 cursor-pointer items-center justify-center gap-[6px] rounded-[10px] font-sans text-[13.5px] font-semibold transition-colors",
              active
                ? "bg-primary-blue text-white"
                : "text-quiet hover:text-ink-night",
            )}
          >
            <Icon name={option.icon} size={15} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  window.history.replaceState(null, "", `#${id}`);
}

function SourcePanel({
  text,
  quote,
  accent,
  onClear,
  title,
}: {
  text: string;
  quote: BriefQuote | null;
  accent: string;
  onClear: () => void;
  title: string;
}) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (quote)
      target.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [quote]);

  // A bill can run to megabytes; find the passage once per quote, not per render.
  const location = useMemo(
    () => (quote ? findQuote(text, quote.text, quote.documentId) : null),
    [text, quote],
  );

  return (
    <div className="bg-slate border-hair-1 rounded-[16px] border p-4 md:p-6">
      <div className="border-hair-1 mb-4 flex items-center gap-3 border-b pb-4">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: `${accent}28`, color: accent }}
        >
          <Icon name="doc" size={15} />
        </span>
        <div>
          <p className="font-sans text-[14px] font-bold">{title}</p>
          <p className="text-quiet font-sans text-[12px]">
            {quote
              ? quote.locator
                ? `Highlighted passage · ${quote.locator}`
                : "Highlighted passage"
              : "Verbatim, as published by the official source"}
          </p>
        </div>
        {quote ? (
          <button
            type="button"
            onClick={onClear}
            className="text-quiet hover:text-ink-night border-card-border ml-auto inline-flex shrink-0 cursor-pointer items-center gap-[6px] rounded-full border px-3 py-[6px] font-sans text-[12px] font-semibold"
          >
            <Icon name="close" size={13} />
            Clear highlight
          </button>
        ) : null}
      </div>
      <div className="font-mono text-[13px] leading-[21px] [overflow-wrap:anywhere] whitespace-pre-wrap text-white/[0.78]">
        {location ? (
          <>
            {location.before}
            <div
              ref={target}
              data-testid="source-highlight"
              className="my-3 rounded-[10px] border p-3 font-sans text-[14px] leading-[21px] whitespace-normal text-white"
              style={{ backgroundColor: `${accent}22`, borderColor: accent }}
            >
              <p
                className="mb-1 text-[10px] font-bold tracking-[0.12em]"
                style={{ color: accent }}
              >
                {location.found ? "MATCHING PASSAGE" : "CITED PASSAGE"}
              </p>
              {location.match}
            </div>
            {location.after}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
}
