import type { ReactNode } from "react";

import type { CourtBriefRecord } from "@acme/validators";
import { outcomeColors } from "@acme/ui/digest-tokens";

import type { SectionKey } from "~/lib/reader-sections";
import { sectionId } from "~/lib/reader-sections";
import { Icon } from "../../_components/icon";
import { CourtDefinedText } from "./court-defined-text";
import { ViewSourceButton } from "./reader-body";

type Point = CourtBriefRecord["action"];

const PROCEEDING = {
  emergency_order: {
    badge: "TEMPORARY",
    label: "Emergency order",
    detail: "Temporary decision while the case continues",
  },
  order: {
    badge: "ORDER",
    label: "Court order",
    detail: "Limited to the request before the court",
  },
  merits_opinion: {
    badge: "DECISION",
    label: "Full decision",
    detail: "The court decided the legal questions before it",
  },
  unknown: {
    badge: "SCOPE UNCLEAR",
    label: "Court filing",
    detail: "The procedural scope is not established",
  },
} as const;

const REASON: Record<CourtBriefRecord["reasoning"][number]["kind"], string> = {
  holding: "HOLDING",
  court_reasoning: "COURT REASONING",
  party_argument: "PARTY ARGUMENT",
  allegation: "ALLEGATION",
};

const OPINION = {
  majority: { label: "COURT'S MAIN OPINION", color: outcomeColors.gains },
  per_curiam: { label: "COURT OPINION · UNSIGNED", color: outcomeColors.gains },
  concurrence: { label: "AGREES · CONCURRENCE", color: "#B8A1FF" },
  dissent: { label: "DISAGREES · DISSENT", color: "#FF9575" },
  unknown: { label: "OPINION", color: outcomeColors.unclear },
} as const;

export function CourtBriefBlocks({
  brief,
  accent,
  dualLens,
}: {
  brief: CourtBriefRecord;
  accent: string;
  dualLens?: ReactNode;
}) {
  const proceeding = PROCEEDING[brief.proceeding];
  return (
    <div className="flex flex-col gap-6" data-testid="court-brief">
      <section
        id={sectionId("short-version")}
        className="bg-slate border-hair-1 flex scroll-mt-24 flex-col gap-[13px] rounded-[14px] border border-l-[3px] p-4 md:p-5"
        style={{ borderLeftColor: accent }}
      >
        <div className="flex items-center gap-[9px]">
          <IconTile name="sparkle" accent={accent} />
          <h2 className="font-editorial flex-1 text-[17px] font-bold">
            The short version
          </h2>
          <span
            className="rounded-full border px-2 py-[3px] font-sans text-[9px] font-semibold tracking-[0.09em]"
            style={{ borderColor: `${accent}66`, color: accent }}
          >
            {proceeding.badge}
          </span>
        </div>
        <CourtDefinedText
          text={brief.takeaway.text}
          terms={brief.terms}
          accent={accent}
          className="font-sans text-[15.5px] leading-[24px] text-white md:text-[16.5px] md:leading-[26px]"
        />
        <PointSources brief={brief} point={brief.takeaway} />
      </section>

      <section className="bg-slate border-hair-1 flex gap-3 rounded-[14px] border p-[14px]">
        <IconTile name="scale" accent={accent} />
        <div className="min-w-0">
          <h2 className="font-editorial text-[16px] font-bold">
            {proceeding.label}
          </h2>
          <p className="font-sans text-[13px] leading-[19px] text-white/[0.72]">
            {proceeding.detail}
          </p>
          <p className="text-quiet mt-1 font-sans text-[11px] leading-4">
            {brief.court} · {brief.docket}
            {brief.decisionDate
              ? ` · ${brief.decisionDate}`
              : " · Date unknown"}
          </p>
        </div>
      </section>

      {brief.terms.length ? (
        <p className="text-quiet -mt-3 flex items-center gap-2 px-1 font-sans text-[12px]">
          <span style={{ color: accent }}>
            <Icon name="book" size={13} />
          </span>
          Tap any blue legal term for a plain-language definition.
        </p>
      ) : null}

      <BlockTitle section="court-ruling">What the court did</BlockTitle>
      <section
        className="bg-slate border-hair-1 flex flex-col gap-3 rounded-[14px] border border-l-[3px] p-4"
        style={{ borderLeftColor: accent }}
      >
        <p className="text-quiet flex items-center gap-2 font-sans text-[10px] font-semibold tracking-[0.1em]">
          <span style={{ color: accent }}>
            <Icon name="check" size={15} />
          </span>{" "}
          THE RULING
        </p>
        <CourtDefinedText
          text={brief.action.text}
          terms={brief.terms}
          accent={accent}
          className="font-sans text-[16px] leading-[23px] font-semibold"
        />
        <div className="bg-surface rounded-[10px] p-3">
          <p className="text-quiet mb-1 font-sans text-[9px] font-semibold tracking-[0.1em]">
            WHAT THE COURT WAS DECIDING
          </p>
          <CourtDefinedText
            text={brief.posture}
            terms={brief.terms}
            accent={accent}
            className="font-sans text-[13.5px] leading-[20px] text-white/[0.8]"
          />
        </div>
        <QuoteDisclosure point={brief.action} accent={accent} />
        <PointSources brief={brief} point={brief.action} />
      </section>

      {brief.questions.length ? (
        <>
          <BlockTitle section="court-questions">
            Questions before the court
          </BlockTitle>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {brief.questions.map((question, index) => (
              <li
                key={index}
                className="bg-slate border-hair-1 flex gap-3 rounded-[12px] border p-3"
              >
                <span
                  className="font-sans text-[11px] font-bold"
                  style={{ color: accent }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <CourtDefinedText
                    text={question.text}
                    terms={brief.terms}
                    accent={accent}
                    className="font-sans text-[14px] leading-[21px] text-white/[0.84]"
                  />
                  <PointSources brief={brief} point={question} />
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {brief.reasoning.length ? (
        <>
          <BlockTitle section="court-reasoning">
            How the court got there
          </BlockTitle>
          <div className="flex flex-col gap-3">
            {brief.reasoning.map((reason, index) => (
              <PointCard
                key={index}
                brief={brief}
                point={reason}
                accent={accent}
                label={REASON[reason.kind]}
              />
            ))}
          </div>
        </>
      ) : null}

      {brief.effects.length ? (
        <>
          <BlockTitle section="court-effects">Who it lands on</BlockTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {brief.effects.map((effect, index) => {
              const ordered = effect.certainty === "court_order";
              const color = ordered
                ? outcomeColors.gains
                : outcomeColors.unclear;
              return (
                <article
                  key={index}
                  className="rounded-[14px] border border-l-[3px] p-4"
                  style={{
                    backgroundColor: `${color}0D`,
                    borderColor: `${color}4A`,
                    borderLeftColor: color,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span style={{ color }}>
                      <Icon name={ordered ? "check" : "help"} size={15} />
                    </span>
                    <h3 className="flex-1 font-sans text-[14px] font-bold">
                      {effect.group}
                    </h3>
                    <span
                      className="rounded-full border px-2 py-[2px] font-sans text-[9px] font-bold"
                      style={{ color, borderColor: `${color}70` }}
                    >
                      {ordered ? "ORDERED" : "POSSIBLE"}
                    </span>
                  </div>
                  <CourtDefinedText
                    text={effect.text}
                    terms={brief.terms}
                    accent={accent}
                    className="font-editorial text-[16px] leading-[22px] text-white/[0.8]"
                  />
                  <QuoteDisclosure point={effect} accent={accent} />
                  <PointSources brief={brief} point={effect} />
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {brief.opinions.length ? (
        <>
          <BlockTitle section="court-opinions">Separate opinions</BlockTitle>
          <div className="flex flex-col gap-3">
            {brief.opinions.map((opinion, index) => {
              const treatment = OPINION[opinion.kind];
              return (
                <article
                  key={index}
                  className="bg-slate border-hair-1 rounded-[14px] border border-l-[3px] p-4"
                  style={{ borderLeftColor: treatment.color }}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span
                      className="font-sans text-[10px] font-bold tracking-[0.08em]"
                      style={{ color: treatment.color }}
                    >
                      {treatment.label}
                    </span>
                    <span className="text-quiet text-right font-sans text-[11px]">
                      {opinion.author ?? "Author not established"}
                    </span>
                  </div>
                  <CourtDefinedText
                    text={opinion.text}
                    terms={brief.terms}
                    accent={accent}
                    className="font-sans text-[14px] leading-[21px] text-white/[0.84]"
                  />
                  <QuoteDisclosure point={opinion} accent={accent} />
                  <PointSources brief={brief} point={opinion} />
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      <Unknowns brief={brief} accent={accent} />

      {dualLens ? (
        <>
          <BlockTitle section="how-people-make-the-case">
            How people make the case
          </BlockTitle>
          {dualLens}
        </>
      ) : null}

      <OfficialDocuments brief={brief} />
    </div>
  );
}

function BlockTitle({
  children,
  section,
}: {
  children: string;
  section: SectionKey;
}) {
  return (
    <h2
      id={sectionId(section)}
      className="font-editorial -mb-2 scroll-mt-24 text-[20px] font-bold"
    >
      {children}
    </h2>
  );
}

function IconTile({
  name,
  accent,
}: {
  name: "sparkle" | "scale";
  accent: string;
}) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
      style={{ backgroundColor: `${accent}28`, color: accent }}
    >
      <Icon name={name} size={16} />
    </span>
  );
}

function PointCard({
  brief,
  point,
  accent,
  label,
}: {
  brief: CourtBriefRecord;
  point: Point;
  accent: string;
  label: string;
}) {
  return (
    <article className="bg-slate border-hair-1 rounded-[14px] border p-4">
      <span
        className="mb-2 inline-block rounded-full border px-2 py-[3px] font-sans text-[9px] font-bold tracking-[0.1em]"
        style={{ borderColor: `${accent}80`, color: accent }}
      >
        {label}
      </span>
      <CourtDefinedText
        text={point.text}
        terms={brief.terms}
        accent={accent}
        className="font-sans text-[14px] leading-[21px] text-white/[0.86]"
      />
      <QuoteDisclosure point={point} accent={accent} />
      <PointSources brief={brief} point={point} />
    </article>
  );
}

function QuoteDisclosure({ point, accent }: { point: Point; accent: string }) {
  if (!point.quote) return null;
  const quote = {
    text: point.quote.text,
    locator: point.quote.locator ?? undefined,
    documentId: point.quote.documentId,
  };
  return (
    <div className="border-hair-1 mt-3 border-t pt-3">
      <details className="group">
        <summary className="text-quiet flex cursor-pointer list-none items-center gap-2 font-sans text-[12px] font-semibold">
          <Icon name="quote" size={11} />
          {quote.locator ? `In the text · ${quote.locator}` : "In the text"}
          <Icon
            name="chevD"
            size={13}
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <blockquote className="border-hair-2 mt-2 mb-0 ml-0 border-l-2 pl-3 font-serif text-[13.5px] leading-[20px] text-white/[0.78] italic">
          {quote.text}
        </blockquote>
      </details>
      <div className="mt-3">
        <ViewSourceButton quote={quote} accent={accent} />
      </div>
    </div>
  );
}

function PointSources({
  brief,
  point,
}: {
  brief: CourtBriefRecord;
  point: Point;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {point.documentIds.map((id) => {
        const source = brief.sources.find((candidate) => candidate.id === id);
        if (!source) return null;
        return (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface text-quiet border-hair-1 inline-flex items-center gap-1 rounded-full border px-2 py-[5px] font-sans text-[10.5px] no-underline hover:text-white"
          >
            <Icon name="doc" size={11} /> Official source{" "}
            {id.replace("document-", "")}
            <Icon name="external" size={10} />
          </a>
        );
      })}
    </div>
  );
}

function Unknowns({
  brief,
  accent,
}: {
  brief: CourtBriefRecord;
  accent: string;
}) {
  return (
    <section
      id={sectionId("court-unknowns")}
      className="bg-surface border-hair-2 scroll-mt-24 rounded-[14px] border p-4"
      data-testid="court-brief-unknowns"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="help" size={15} className="text-quiet" />
        <h2 className="font-editorial text-[16px] font-bold">
          What the ruling doesn&apos;t settle
        </h2>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {brief.unknowns.map((unknown, index) => (
          <li key={index} className="bg-slate flex gap-3 rounded-[10px] p-3">
            <span
              className="font-sans text-[11px] font-bold"
              style={{ color: accent }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <CourtDefinedText
              text={unknown}
              terms={brief.terms}
              accent={accent}
              className="font-sans text-[14px] leading-[21px] text-white/[0.8]"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function OfficialDocuments({ brief }: { brief: CourtBriefRecord }) {
  return (
    <section>
      <h2 className="font-editorial mb-3 text-[20px] font-bold">
        Official documents
      </h2>
      <div className="flex flex-col gap-2">
        {brief.sources.map((source, index) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface border-hair-1 hover:bg-plane-hi flex items-center gap-3 rounded-[14px] border p-4 no-underline"
          >
            <Icon name="doc" size={16} className="text-quiet" />
            <span className="min-w-0 flex-1">
              <span className="text-quiet block font-sans text-[9px] font-semibold tracking-[0.09em]">
                OFFICIAL COURT RECORD
              </span>
              <span className="block font-sans text-[14px] font-semibold">
                Document {index + 1}
              </span>
              <span className="text-quiet block truncate font-sans text-[11px]">
                {source.url}
              </span>
            </span>
            <Icon name="external" size={14} className="text-quiet" />
          </a>
        ))}
      </div>
    </section>
  );
}
