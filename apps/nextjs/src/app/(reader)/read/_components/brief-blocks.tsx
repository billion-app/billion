import type { ReactNode } from "react";

import type { BillBriefRecord } from "@acme/validators";
import { outcomeColors } from "@acme/ui/digest-tokens";

import type { IconName } from "../../_components/icon";
import { Icon } from "../../_components/icon";
import { Emphasis } from "./emphasis";
import { Markdown } from "./markdown";
import { ViewSourceButton } from "./reader-body";

/**
 * The brief, as blocks — the web counterpart of the phone's `BillBrief`
 * (`apps/expo/src/components/ui/BillBrief.tsx`), in the same order and with
 * the same copy, so a reader can stop after any block and still have
 * learned something true.
 *
 * Rendered on the server. Disclosure uses <details>, which needs no
 * JavaScript; only "View source" is interactive, because it has to switch
 * the reader into the original text.
 *
 * Fields are read defensively: a brief stored by an older pipeline version
 * may lack the later blocks, and must still render what it has.
 */
export type Brief = Omit<BillBriefRecord, "summary" | "reading"> & {
  summary?: string;
  reading?: BillBriefRecord["reading"];
};

const CHANGE_KIND_LABEL: Record<string, string> = {
  creates: "CREATES",
  repeals: "REPEALS",
  expands: "EXPANDS",
  restricts: "RESTRICTS",
  requires: "REQUIRES",
  waives: "WAIVES",
  funds: "FUNDS",
  transfers: "TRANSFERS",
};

/** Outcome colour is a navigation aid, not a verdict, and never the only signal. */
const UNCLEAR = {
  icon: "help",
  label: "Unclear",
  color: outcomeColors.unclear,
} as const;

const DIRECTION: Record<
  string,
  { icon: IconName; label: string; color: string }
> = {
  gains: { icon: "arrowUp", label: "Gains", color: outcomeColors.gains },
  loses: { icon: "arrowDown", label: "Loses", color: outcomeColors.loses },
  mixed: { icon: "minus", label: "Mixed", color: outcomeColors.mixed },
  unclear: { icon: "help", label: "Unclear", color: outcomeColors.unclear },
};

export function BriefBlocks({
  brief,
  accent,
  dualLens,
}: {
  brief: Brief;
  accent: string;
  dualLens?: ReactNode;
}) {
  const reading = brief.reading ?? [];
  return (
    <div className="flex flex-col gap-6" data-testid="bill-brief">
      <Hook brief={brief} accent={accent} />
      {brief.whyNotBefore ? (
        <WhyNotBefore context={brief.whyNotBefore} accent={accent} />
      ) : null}
      {/* On wide screens the glossary moves to the right rail. */}
      <div className="xl:hidden">
        <Terms terms={brief.terms} accent={accent} />
      </div>

      <BlockTitle>What would change</BlockTitle>
      <Changes brief={brief} accent={accent} />

      <BlockTitle>Who it lands on</BlockTitle>
      <Affected affected={brief.affected} />

      <Unknowns unknowns={brief.unknowns} accent={accent} />

      {dualLens ? (
        <>
          <BlockTitle>How people make the case</BlockTitle>
          {dualLens}
        </>
      ) : null}

      {brief.deepDive || reading.length > 0 ? (
        <>
          <BlockTitle>Keep reading</BlockTitle>
          <FurtherReading
            deepDive={brief.deepDive}
            reading={reading}
            accent={accent}
          />
        </>
      ) : null}
    </div>
  );
}

function BlockTitle({ children }: { children: string }) {
  return (
    <h2 className="font-editorial -mb-2 text-[20px] font-bold text-white md:text-[21px]">
      {children}
    </h2>
  );
}

function Chevron() {
  return (
    <Icon
      name="chevD"
      size={14}
      className="shrink-0 transition-transform group-open:rotate-180"
    />
  );
}

/* ---------- the short version ---------- */
function Hook({ brief, accent }: { brief: Brief; accent: string }) {
  const short = brief.summary ?? brief.hook;
  const hasExtended = short !== brief.hook;
  return (
    <section
      className="bg-slate border-hair-1 flex flex-col gap-[13px] rounded-[14px] border border-l-[3px] p-4 md:p-5"
      style={{ borderLeftColor: accent }}
      data-testid="brief-summary"
    >
      <div className="flex items-center gap-[9px]">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: `${accent}28`, color: accent }}
        >
          <Icon name="sparkle" size={16} />
        </span>
        <h2 className="font-editorial flex-1 text-[17px] font-bold text-white">
          The short version
        </h2>
        <span
          className="rounded-full border px-2 py-[3px] font-sans text-[9px] font-semibold tracking-[0.09em]"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          {brief.legalStatus === "enacted" ? "LAW" : "PROPOSAL"}
        </span>
      </div>
      <p className="font-sans text-[15.5px] leading-[24px] text-white md:text-[16.5px] md:leading-[26px]">
        <Emphasis text={short} />
      </p>
      {hasExtended ? (
        <details className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-[6px] font-sans text-[12.5px] font-semibold"
            style={{ color: accent }}
          >
            <span className="group-open:hidden">Read extended version</span>
            <span className="hidden group-open:inline">
              Hide extended version
            </span>
            <Chevron />
          </summary>
          <div
            className="border-hair-1 mt-3 flex flex-col gap-[7px] border-t pt-[13px]"
            data-testid="brief-hook"
          >
            <p className="text-quiet font-sans text-[9.5px] font-semibold tracking-[0.1em]">
              EXTENDED VERSION
            </p>
            <p className="font-sans text-[14.5px] leading-[22px] text-white/[0.78]">
              <Emphasis text={brief.hook} />
            </p>
          </div>
        </details>
      ) : null}
    </section>
  );
}

/* ---------- why not before ---------- */
function WhyNotBefore({
  context,
  accent,
}: {
  context: NonNullable<Brief["whyNotBefore"]>;
  accent: string;
}) {
  const sources = [
    ...new Map(
      context.points.flatMap((point) => point.citations).map((c) => [c.url, c]),
    ).values(),
  ];
  const number = new Map(
    sources.map((source, index) => [source.url, index + 1]),
  );
  return (
    <details
      className="group bg-slate border-hair-1 rounded-[14px] border p-4"
      data-testid="brief-why-not-before"
    >
      <summary className="flex cursor-pointer list-none items-center gap-[10px]">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: `${accent}28`, color: accent }}
        >
          <Icon name="clock" size={15} />
        </span>
        <span className="font-editorial flex-1 text-[16px] font-bold">
          Why wasn&apos;t this implemented before?
        </span>
        <span style={{ color: accent }}>
          <Chevron />
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <p className="font-sans text-[14.5px] leading-[22px] text-white/[0.84]">
          <Emphasis text={context.summary} />
        </p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {context.points.map((point, index) => (
            <li key={index} className="flex gap-3">
              <span
                className="shrink-0 font-sans text-[13px] font-bold tabular-nums"
                style={{ color: accent }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-sans text-[14px] leading-[21px] text-white/[0.8]">
                <Emphasis text={point.text} />{" "}
                {point.citations.map((c) => (
                  <a
                    key={c.url}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold no-underline hover:underline"
                    style={{ color: accent }}
                  >
                    [{number.get(c.url)}]
                  </a>
                ))}
              </p>
            </li>
          ))}
        </ol>
        <div className="border-hair-1 border-t pt-3">
          <p className="text-quiet mb-2 font-sans text-[11px] font-bold tracking-[0.1em] uppercase">
            Sources
          </p>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {sources.map((source, index) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/source flex items-start gap-2 no-underline"
                >
                  <span
                    className="font-sans text-[12px] font-bold"
                    style={{ color: accent }}
                  >
                    [{index + 1}]
                  </span>
                  <span className="flex-1">
                    <span className="text-ink-night block font-sans text-[13.5px] group-hover/source:underline">
                      {source.title}
                    </span>
                    <span className="text-quiet block font-sans text-[12px]">
                      {source.publisher}
                    </span>
                  </span>
                  <Icon name="external" size={13} className="text-quiet mt-1" />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </details>
  );
}

/* ---------- key terms ---------- */
export function Terms({
  terms,
  accent,
}: {
  terms: Brief["terms"];
  accent: string;
}) {
  if (terms.length === 0) return null;
  return (
    <section data-testid="brief-key-terms">
      <div className="mb-3 flex items-center gap-[10px]">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: `${accent}28`, color: accent }}
        >
          <Icon name="book" size={15} />
        </span>
        <div>
          <h2 className="font-editorial text-[16px] font-bold">Key terms</h2>
          <p className="text-quiet font-sans text-[12px]">
            Know these before you read further
          </p>
        </div>
      </div>
      <dl className="m-0 flex flex-col gap-3">
        {terms.map((term, index) => {
          const color = index % 2 === 0 ? accent : "#A99EFF";
          return (
            <div
              key={index}
              className="border-l-2 pl-3"
              style={{ borderLeftColor: index % 2 === 0 ? accent : "#8B7CFF" }}
            >
              <dt
                className="font-sans text-[13.5px] font-bold"
                style={{ color }}
              >
                {term.term}
              </dt>
              <dd className="m-0 font-sans text-[13.5px] leading-[20px] text-white/[0.78]">
                <Emphasis text={term.plain} />
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/* ---------- what would change ---------- */
function Changes({ brief, accent }: { brief: Brief; accent: string }) {
  const { changes } = brief;
  return (
    // The phone swipes through these one at a time; a desktop has room to
    // show two side by side, which makes them easier to compare.
    <div className="grid gap-3 md:grid-cols-2" data-testid="brief-changes">
      {changes.map((change, index) => (
        <article
          key={index}
          className="bg-slate border-hair-1 flex flex-col rounded-[16px] border p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className="rounded-[6px] border px-[7px] py-[3px] font-sans text-[9.5px] font-bold tracking-[0.1em]"
              style={{ borderColor: accent, color: accent }}
            >
              {CHANGE_KIND_LABEL[change.kind] ?? change.kind.toUpperCase()}
            </span>
            <span className="text-quiet font-sans text-[11px] font-semibold tabular-nums">
              {index + 1}/{changes.length}
            </span>
          </div>
          <h3 className="mb-3 font-sans text-[16.5px] leading-[22px] font-semibold">
            {change.title}
          </h3>
          {"imageUri" in change && typeof change.imageUri === "string" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={change.imageUri}
              alt={`Photograph illustrating: ${change.title}`}
              loading="lazy"
              className="bg-surface mb-3 h-[150px] w-full rounded-[12px] object-cover"
            />
          ) : null}
          <div className="rounded-[12px] bg-[rgba(255,255,255,0.03)] p-3">
            <p className="text-quiet mb-1 font-sans text-[9.5px] font-bold tracking-[0.12em]">
              NOW
            </p>
            <p className="font-sans text-[14px] leading-[20px] text-white/[0.72]">
              <Emphasis text={change.before} />
            </p>
          </div>
          <div
            className="flex items-center gap-2 py-2 pl-3"
            style={{ color: accent }}
          >
            <Icon name="arrowDown" size={13} />
            <span className="font-sans text-[9.5px] font-bold tracking-[0.12em]">
              THE PROPOSAL CHANGES THIS
            </span>
          </div>
          <div
            className="rounded-[12px] border p-3"
            style={{
              borderColor: `${accent}66`,
              backgroundColor: `${accent}18`,
            }}
          >
            <p className="text-quiet mb-1 font-sans text-[9.5px] font-bold tracking-[0.12em]">
              UNDER THIS BILL
            </p>
            <p className="font-sans text-[14px] leading-[20px] text-white">
              <Emphasis text={change.after} />
            </p>
          </div>
          {change.quote ? (
            <div className="mt-auto pt-3">
              <details className="group">
                <summary className="text-quiet flex cursor-pointer list-none items-center gap-[6px] font-sans text-[12px] font-semibold">
                  <Icon name="quote" size={11} />
                  {change.quote.locator
                    ? `In the text · ${change.quote.locator}`
                    : "In the text"}
                  <Chevron />
                </summary>
                <blockquote className="border-hair-2 mt-2 mb-0 ml-0 border-l-2 pl-3 font-serif text-[13.5px] leading-[20px] text-white/[0.78] italic">
                  {change.quote.text}
                </blockquote>
              </details>
              <div className="mt-3">
                <ViewSourceButton quote={change.quote} accent={accent} />
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

/* ---------- who it lands on ---------- */
function Affected({ affected }: { affected: Brief["affected"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="brief-affected">
      {affected.map((group, index) => {
        const d = DIRECTION[group.direction] ?? UNCLEAR;
        const takeaway =
          "takeaway" in group
            ? (group.takeaway as string | undefined)
            : undefined;
        return (
          <div
            key={index}
            className="rounded-[14px] border border-l-[3px] p-[14px]"
            style={{
              backgroundColor: `${d.color}0D`,
              borderColor: `${d.color}4A`,
              borderLeftColor: d.color,
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: `${d.color}24`,
                  borderColor: `${d.color}4A`,
                  color: d.color,
                }}
              >
                <Icon name={d.icon} size={14} />
              </span>
              <h3 className="flex-1 font-sans text-[14.5px] leading-[19px] font-bold">
                {group.group}
              </h3>
              <span
                className="rounded-full border px-2 py-[2px] font-sans text-[10px] font-bold tracking-[0.06em] uppercase"
                style={{
                  backgroundColor: `${d.color}18`,
                  borderColor: `${d.color}70`,
                  color: d.color,
                }}
              >
                {d.label}
              </span>
            </div>
            <p className="font-editorial text-[16px] leading-[22px] text-white/[0.8]">
              <Emphasis text={takeaway ?? group.effect.replaceAll("**", "")} />
            </p>
            {takeaway ? (
              <details className="group mt-2">
                <summary
                  className="flex cursor-pointer list-none items-center gap-[6px] font-sans text-[12px] font-semibold"
                  style={{ color: d.color }}
                >
                  <span className="group-open:hidden">Why this matters</span>
                  <span className="hidden group-open:inline">Hide context</span>
                  <Chevron />
                </summary>
                <p className="mt-2 font-sans text-[13.5px] leading-[20px] text-white/[0.74]">
                  <Emphasis text={group.effect} />
                </p>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- what the text doesn't settle ---------- */
// Same visual weight as the analysis: burying it would let a brief read as
// more settled than the source is.
function Unknowns({
  unknowns,
  accent,
}: {
  unknowns: string[];
  accent: string;
}) {
  if (unknowns.length === 0) return null;
  return (
    <section
      className="bg-surface border-hair-2 rounded-[14px] border p-[15px] md:p-5"
      data-testid="brief-unknowns"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="help" size={15} className="text-quiet" />
        <h2 className="font-editorial text-[16px] font-bold">
          What the text doesn&apos;t settle
        </h2>
      </div>
      <ol className="m-0 flex list-none flex-col gap-[10px] p-0">
        {unknowns.map((unknown, index) => (
          <li key={index} className="flex gap-[10px]">
            <span
              className="shrink-0 font-sans text-[13.5px] font-bold tabular-nums"
              style={{ color: accent }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-sans text-[14px] leading-[21px] text-white/[0.8]">
              <Emphasis text={unknown} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- keep reading ---------- */
function FurtherReading({
  deepDive,
  reading,
  accent,
}: {
  deepDive: Brief["deepDive"];
  reading: NonNullable<Brief["reading"]>;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid="brief-further-reading">
      {deepDive ? (
        <details
          className="group bg-slate border-hair-1 rounded-[14px] border border-l-[3px] p-4"
          style={{ borderLeftColor: accent }}
        >
          <summary className="flex cursor-pointer list-none items-start gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
              style={{ backgroundColor: `${accent}28`, color: accent }}
            >
              <Icon name="sparkle" size={16} />
            </span>
            <span className="flex-1">
              <span
                className="block font-sans text-[10px] font-bold tracking-[0.12em]"
                style={{ color: accent }}
              >
                BILLION EXPLAINER
              </span>
              <span className="font-editorial mt-1 block text-[18px] leading-[23px] font-bold">
                {deepDive.title}
              </span>
              <span className="text-quiet mt-1 block font-sans text-[13.5px] leading-[20px]">
                <Emphasis text={deepDive.dek} />
              </span>
              <span
                className="mt-2 block font-sans text-[12.5px] font-semibold group-open:hidden"
                style={{ color: accent }}
              >
                Read the full explainer
              </span>
            </span>
            <span style={{ color: accent }}>
              <Chevron />
            </span>
          </summary>
          <div className="border-hair-1 mt-4 border-t pt-4">
            <Markdown source={deepDive.body} />
          </div>
        </details>
      ) : null}
      {reading.map((item) => (
        <a
          key={item.url}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-slate border-hair-1 hover:bg-plane-hi group/read flex items-start gap-3 rounded-[14px] border p-4 no-underline transition-colors"
        >
          <span className="bg-surface text-quiet flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]">
            <Icon name="external" size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-quiet block font-sans text-[10.5px] font-bold tracking-[0.1em] uppercase">
              {item.publisher}
            </span>
            <span className="text-ink-night mt-1 line-clamp-2 block font-sans text-[15px] leading-[20px] font-semibold group-hover/read:underline">
              {item.title}
            </span>
            <span className="text-quiet mt-1 line-clamp-3 block font-sans text-[13px] leading-[19px]">
              <Emphasis text={item.whyRead} />
            </span>
          </span>
          <Icon name="chevR" size={16} className="text-quiet mt-1" />
        </a>
      ))}
    </div>
  );
}
