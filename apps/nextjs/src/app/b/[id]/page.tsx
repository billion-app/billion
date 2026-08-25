import type { Metadata } from "next";
import { Fragment } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { BillBriefRecord } from "@acme/validators";

import type { SharedContent } from "./shared-content";
import { WaitlistForm } from "../../_components/waitlist-form";
import { isAndroidUserAgent } from "../../_lib/platform";
import {
  headerImage,
  plainText,
  presentType,
  shareSegment,
  shareSummary,
  truncate,
} from "./share-copy";
import { getSharedContent } from "./shared-content";

/**
 * The public face of a single record.
 *
 * A link out of the app has to be worth opening on its own — someone who was
 * sent one has no app, and telling them to install before they may read
 * anything is how a shared link dies. So this page carries the brief itself:
 * the summary, what changes, and who it lands on, with the same provenance
 * note the app shows. The install ask comes after the reader has been given
 * something, not before.
 *
 * It deliberately stops short of the full explainer. The point of the page is
 * to be forwarded and to be finished in the app or on the official record,
 * both of which it links to.
 */

const APP_STORE_CAMPAIGN = "share_web";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const content = await getSharedContent(id);
  if (!content) return { title: "Not found — Billion" };

  const type = presentType(content.type);
  const title = content.billNumber
    ? `${content.billNumber}: ${content.title}`
    : content.title;
  const description = truncate(
    shareSummary(content) || `${type.kind} on Billion.`,
    200,
  );
  const canonical = `/b/${shareSegment(content.title, content.id)}`;

  return {
    title: `${title} — Billion`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      siteName: "Billion",
      url: canonical,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedContentPage({ params }: PageProps) {
  const { id } = await params;
  const content = await getSharedContent(id);
  if (!content) notFound();

  const type = presentType(content.type);
  const brief = briefOf(content);
  const art = headerImage(content);
  const isAndroid = isAndroidUserAgent((await headers()).get("user-agent"));

  return (
    <main className="bg-background text-foreground min-h-screen">
      <nav
        className="mx-auto flex items-center justify-between px-6 py-5"
        style={{ maxWidth: 760 }}
      >
        <Link
          href="/"
          className="text-foreground font-display text-[22px] font-bold tracking-[-0.02em] no-underline"
        >
          Billion
        </Link>
        <span className="text-muted-foreground font-sans text-[13px] font-medium">
          {type.kind}
        </span>
      </nav>

      <article className="mx-auto px-6 pb-16" style={{ maxWidth: 760 }}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className="rounded-full border px-3 py-1 font-sans text-[11px] font-bold tracking-[0.09em]"
            style={{
              color: type.color,
              borderColor: type.color,
              backgroundColor: `${type.color}1F`,
            }}
          >
            {type.label}
          </span>
          {content.billNumber ? (
            <span className="text-muted-foreground font-sans text-[13px] font-semibold tracking-[0.03em]">
              {content.billNumber}
            </span>
          ) : null}
        </div>

        <h1
          className="mb-4 leading-[1.14] font-bold tracking-[-0.02em]"
          style={{ fontSize: "clamp(2rem, 6vw, 2.85rem)" }}
        >
          {content.title}
        </h1>

        {content.description ? (
          <p className="text-muted-foreground mb-8 font-sans text-[17px] leading-[1.6]">
            {content.description}
          </p>
        ) : null}

        {art ? (
          // Header art is usually an inline data: URI written by the
          // pipeline, which the image optimizer cannot process.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            className="mb-10 h-auto w-full rounded-[14px] border border-white/10"
          />
        ) : null}

        {brief ? (
          <BriefSections brief={brief} accent={type.color} />
        ) : (
          <Excerpt content={content} />
        )}

        <p className="text-muted-foreground mt-10 mb-10 rounded-[14px] border border-white/10 bg-white/[0.04] px-5 py-4 font-sans text-[13px] leading-[1.6]">
          Written by Billion AI from the official text — always check the
          source.{" "}
          {content.url ? (
            <a
              href={content.url}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="text-accent font-medium"
            >
              Read the original record →
            </a>
          ) : null}
        </p>

        <InstallCta isAndroid={isAndroid} />
      </article>
    </main>
  );
}

/* ---------- brief ---------- */

/** The stored brief, when this record has one. Only bills do, today. */
function briefOf(content: SharedContent): BillBriefRecord | null {
  if (!("brief" in content)) return null;
  return (content.brief as BillBriefRecord | null | undefined) ?? null;
}

const DIRECTION_LABEL: Record<string, string> = {
  gains: "Gains",
  loses: "Loses",
  mixed: "Mixed",
  unclear: "Unclear",
};

function BriefSections({
  brief,
  accent,
}: {
  brief: BillBriefRecord;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      {brief.summary ? (
        <p
          className="font-editorial border-l-[3px] pl-5 text-[22px] leading-[1.45] font-bold"
          style={{ borderColor: accent }}
        >
          <Emphasis text={brief.summary} />
        </p>
      ) : null}

      <section>
        <SectionLabel accent={accent}>What this means for you</SectionLabel>
        <p className="font-sans text-[17px] leading-[1.7] text-white/85">
          <Emphasis text={brief.hook} />
        </p>
      </section>

      <section>
        <SectionLabel accent={accent}>What changes</SectionLabel>
        <div className="flex flex-col gap-4">
          {brief.changes.map((change, index) => (
            <div
              key={index}
              className="rounded-[14px] border border-white/10 bg-white/[0.04] p-5"
            >
              <h3 className="mb-3 text-[18px] font-bold">{change.title}</h3>
              <dl className="flex flex-col gap-2 font-sans text-[15px] leading-[1.6]">
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="text-muted-foreground shrink-0 text-[12px] font-semibold tracking-[0.06em] uppercase sm:w-14">
                    Now
                  </dt>
                  <dd className="text-muted-foreground m-0">
                    <Emphasis text={change.before} />
                  </dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt
                    className="shrink-0 text-[12px] font-semibold tracking-[0.06em] uppercase sm:w-14"
                    style={{ color: accent }}
                  >
                    After
                  </dt>
                  <dd className="m-0 text-white/85">
                    <Emphasis text={change.after} />
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel accent={accent}>Who it lands on</SectionLabel>
        <div className="flex flex-col gap-4">
          {brief.affected.map((group, index) => (
            <div key={index} className="border-l border-white/10 pl-4">
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <h3 className="text-[17px] font-bold">{group.group}</h3>
                <span className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
                  {DIRECTION_LABEL[group.direction] ?? group.direction}
                </span>
              </div>
              <p className="text-muted-foreground font-sans text-[15px] leading-[1.6]">
                <Emphasis text={group.takeaway} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {brief.unknowns.length > 0 ? (
        <section>
          <SectionLabel accent={accent}>
            What it doesn&apos;t settle
          </SectionLabel>
          <ul className="text-muted-foreground m-0 flex list-disc flex-col gap-2 pl-5 font-sans text-[15px] leading-[1.6]">
            {brief.unknowns.map((unknown, index) => (
              <li key={index}>
                <Emphasis text={unknown} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SectionLabel({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className="mb-4 font-sans text-[11px] font-bold tracking-[0.12em] uppercase"
      style={{ color: accent }}
    >
      {children}
    </h2>
  );
}

/**
 * Brief prose marks its key phrases with `**double asterisks**` so every
 * surface can decide how to draw the emphasis. Here it is a bold span.
 */
function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-white">
            {part}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The fallback for records with no brief — executive actions and court cases
 * today, and bills the pipeline has not reached yet.
 *
 * Deliberately an excerpt rather than the whole explainer. The article is
 * markdown, this page has no markdown renderer, and republishing the full text
 * here would give the reader no reason to open either the app or the source.
 */
function Excerpt({ content }: { content: SharedContent }) {
  const body = plainText(content.articleContent).replace(/^#{1,6}\s.*$/gm, "");
  const excerpt = truncate(body.replace(/\s+/g, " ").trim(), 900);
  if (!excerpt) return null;

  return (
    <p className="font-sans text-[17px] leading-[1.75] text-white/85">
      {excerpt}
    </p>
  );
}

/* ---------- install ---------- */

function InstallCta({ isAndroid }: { isAndroid: boolean }) {
  return (
    <aside className="rounded-[16px] border border-white/10 bg-white/[0.04] p-6">
      <h2 className="mb-2 text-[21px] font-bold">
        {isAndroid
          ? "Billion isn't on Android yet."
          : "Every bill, explained like this."}
      </h2>
      <p className="text-muted-foreground mb-5 font-sans text-[15px] leading-[1.6]">
        {isAndroid
          ? "We're building it. Leave your email and we'll tell you the day it's ready."
          : "Billion turns bills, executive orders, and court cases into plain language, with the original text one tap away."}
      </p>

      {isAndroid ? (
        <WaitlistForm buttonText="Notify me" />
      ) : (
        <a
          href={`/r?dest=app&p=${APP_STORE_CAMPAIGN}`}
          className="bg-primary text-primary-foreground inline-flex items-center rounded-full px-6 py-3 font-sans text-[15px] font-semibold no-underline transition-opacity duration-200 hover:opacity-90"
        >
          Get Billion for iPhone
        </a>
      )}
    </aside>
  );
}
