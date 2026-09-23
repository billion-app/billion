import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { Brief } from "../_components/brief-blocks";
import type { LensData } from "../_components/lens-panel";
import type { Sponsor } from "../_components/sponsor-card";
import type { TimelineAction } from "../_components/timeline";
import type { ReaderContent } from "./reader-content";
import {
  displayBillNumber,
  presentType,
  safeImageSrc,
  stateBody,
} from "~/lib/content-card";
import { BriefBlocks, Terms } from "../_components/brief-blocks";
import { LensPanel } from "../_components/lens-panel";
import { looksLikeMarkdown, Markdown } from "../_components/markdown";
import { ReaderActions } from "../_components/reader-actions";
import { ReaderBody } from "../_components/reader-body";
import { SponsorCard } from "../_components/sponsor-card";
import { Timeline } from "../_components/timeline";
import {
  markdownToPlainText,
  shareSegment,
  truncate,
} from "../../../b/[id]/share-copy";
import { getReaderContent } from "./reader-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const content = await getReaderContent(id);
  if (!content) return { title: "Not found — Billion" };
  const title =
    "billNumber" in content && content.billNumber
      ? `${content.billNumber}: ${content.title}`
      : content.title;
  return {
    title: `${title} — Billion`,
    description: truncate(markdownToPlainText(content.description), 200),
    // One URL per record for search engines: the share page.
    alternates: { canonical: `/b/${shareSegment(content.title, content.id)}` },
  };
}

/**
 * The full web reader — the phone's article screen with a document layout.
 *
 * Server-rendered through a session-less caller; only the view toggle, save
 * and copy-link hydrate. From 1280px the timeline and glossary move into a
 * right rail, so the same content needs less scrolling. A record that does
 * not resolve is a 404, as on the share page.
 */
export default async function ReaderPage({ params }: PageProps) {
  const { id } = await params;
  const content = await getReaderContent(id);
  if (!content) notFound();

  const type = presentType(content.type);
  const accent = type.color;
  const art = safeImageSrc(content.imageUri ?? content.thumbnailUrl);
  const jurisdiction = field<string>(content, "jurisdiction");
  const billNumber = displayBillNumber(
    field<string>(content, "billNumber"),
    jurisdiction,
  );
  const body = stateBody(jurisdiction);
  const sessionLabel = field<string>(content, "sessionLabel");
  const sponsor =
    content.type === "bill" ? field<Sponsor>(content, "sponsor") : undefined;
  const brief = field<Brief | null>(content, "brief") ?? null;
  const lensData = (content.lensData as LensData | null | undefined) ?? null;
  const actions = field<TimelineAction[]>(content, "actions") ?? [];
  const officialUrl = field<string>(content, "officialUrl");
  const sourceUrl = officialUrl ?? content.url;
  const sourceLabel = field<string>(content, "sourceLabel") ?? "congress.gov";
  const sharePath = `/b/${shareSegment(content.title, content.id)}`;

  const lens = lensData ? <LensPanel data={lensData} /> : null;
  const explainer = brief ? (
    <BriefBlocks brief={brief} accent={accent} dualLens={lens} />
  ) : (
    <div className="flex flex-col gap-8">
      <Article content={content} />
      {lens}
    </div>
  );

  const timeline = (
    <Timeline
      actions={actions}
      accent={accent}
      sourceUrl={actions.length > 0 ? content.url : undefined}
      sourceLabel={sourceLabel}
    />
  );

  return (
    <div className="mx-auto max-w-[1160px] px-4 pt-6 pb-24 md:px-8 md:pt-10">
      <div className="xl:grid xl:grid-cols-[minmax(0,720px)_320px] xl:justify-between xl:gap-14">
        <article className="mx-auto w-full max-w-[720px] min-w-0">
          {art ? (
            // Usually an inline data: URI written by the pipeline.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              alt={`Header image for ${content.title}`}
              className="bg-surface mb-6 h-[190px] w-full rounded-[18px] object-cover md:h-[300px] md:rounded-[24px]"
            />
          ) : null}

          <div className="mb-3 flex flex-wrap items-center gap-[10px]">
            <span
              className="rounded-[8px] px-[10px] py-[5px] font-sans text-[10.5px] font-bold tracking-[0.08em] text-white"
              style={{ backgroundColor: accent }}
            >
              {type.label}
            </span>
            {billNumber ? (
              <span
                className="text-quiet font-sans text-[13px] font-semibold tracking-[0.02em]"
                data-testid="article-bill-number"
              >
                {billNumber}
              </span>
            ) : null}
          </div>
          {body ? (
            <p className="text-quiet mb-2 font-sans text-[13px]">
              {body}
              {sessionLabel ? ` · ${sessionLabel}` : ""}
            </p>
          ) : null}

          <h1
            className="font-display mb-4 font-bold tracking-[-0.02em]"
            style={{
              fontSize: "clamp(1.9rem, 4.2vw, 2.9rem)",
              lineHeight: 1.12,
            }}
            data-testid="article-title"
          >
            {content.title}
          </h1>
          {content.description ? (
            <p className="text-quiet mb-5 font-sans text-[16px] leading-[24px] md:text-[17.5px] md:leading-[27px]">
              {markdownToPlainText(content.description)}
            </p>
          ) : null}

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <ReaderActions
              id={content.id}
              type={content.type}
              title={content.title}
              sharePath={sharePath}
            />
          </div>

          {sponsor ? (
            <div className="mb-6">
              <SponsorCard sponsor={sponsor} isStateBill={!!body} />
            </div>
          ) : null}

          <ReaderBody
            accent={accent}
            hasBrief={!!brief}
            explainer={explainer}
            timeline={<div className="xl:hidden">{timeline}</div>}
            original={content.originalContent}
            sourceUrl={sourceUrl}
            isFederalRegister={!!officialUrl}
          />
        </article>

        {/* Wide screens: the phone's inline timeline and glossary, alongside. */}
        <aside className="hidden xl:block">
          <div className="sticky top-[84px] flex max-h-[calc(100vh-100px)] flex-col gap-8 overflow-y-auto pb-6">
            {timeline}
            {brief ? <Terms terms={brief.terms} accent={accent} /> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Long-form explainer for records without a structured brief. */
function Article({ content }: { content: ReaderContent }) {
  // The router has no output schema, so guard against a null at runtime.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const text = content.articleContent ?? "";
  const asMarkdown =
    text.length <= 20000 && (content.isAIGenerated || looksLikeMarkdown(text));
  return asMarkdown ? (
    <Markdown source={text} />
  ) : (
    <p className="font-sans text-[16px] leading-[26px] whitespace-pre-wrap text-white/[0.86]">
      {text}
    </p>
  );
}

/** A field that only some record types carry. */
function field<T>(content: ReaderContent, key: string): T | undefined {
  return (content as Record<string, unknown>)[key] as T | undefined;
}
