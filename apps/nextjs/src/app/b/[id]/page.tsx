import type { Metadata } from "next";
import { Fragment } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { BillBriefRecord } from "@acme/validators";

import type { SharedContent } from "./shared-content";
import type { ReaderLanguage } from "~/app/_lib/reader-language";
import { ArticleDates } from "~/app/_components/article-dates";
import { readerLanguage, readerText } from "~/app/_lib/reader-language";
import { WaitlistForm } from "../../_components/waitlist-form";
import { isAndroidUserAgent } from "../../_lib/platform";
import {
  headerImage,
  markdownToPlainText,
  plainText,
  presentType,
  shareSegment,
  shareSummary,
  truncate,
} from "./share-copy";
import { getLocalizedSharedContent } from "./shared-content";

/**
 * The public face of a single record.
 *
 * A link out of the app has to be worth opening on its own — someone who was
 * sent one has no app, and telling them to install before they may read
 * anything is how a shared link dies. So this page carries the brief itself,
 * with the same provenance note the app shows. The install ask comes after the
 * reader has been given something, not before.
 *
 * It is deliberately the app's article screen with blocks removed rather than
 * a second design: same navy canvas, same serif headline, same summary card,
 * same before/after change cards, same outcome palette. Someone who follows
 * the install prompt should recognise where they landed. What it drops is
 * everything that needs interaction or depth — the dual lens, the timeline,
 * the glossary, the deep dive — because this page's job is to be skimmed and
 * forwarded, and finished in the app or on the official record.
 */

const APP_STORE_CAMPAIGN = "share_web";

/* The app's planes and hairlines, so the two surfaces stay one design. */
const SLATE = "#272D3C";
const SURFACE = "#323848";
const HAIR_1 = "rgba(255,255,255,0.06)";
const HAIR_2 = "rgba(255,255,255,0.10)";

/**
 * Outcome colour is a navigation aid, not a verdict — the same four hues the
 * app uses, deliberately avoiding a red-versus-green or red-versus-blue
 * binary, and never the only signal: each one carries a written label too.
 */
interface Outcome {
  label: string;
  color: string;
  mark: string;
}

/** Also the fallback: a direction we do not recognise reads as unclear. */
const UNCLEAR: Outcome = { label: "Unclear", color: "#F4C95D", mark: "?" };

const DIRECTION: Record<string, Outcome | undefined> = {
  gains: { label: "Gains", color: "#55D6BE", mark: "↑" },
  loses: { label: "Loses", color: "#FF9575", mark: "↓" },
  mixed: { label: "Mixed", color: "#B8A1FF", mark: "–" },
  unclear: UNCLEAR,
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const language = readerLanguage((await searchParams).lang);
  const { content, pending } = await getLocalizedSharedContent(id, language);
  if (!content)
    return {
      title: `${readerText(language, pending ? "Translation is being prepared." : "Not found")} — Billion`,
    };

  const type = presentType(
    content.type,
    content.type === "government_content"
      ? content.governmentContentType
      : undefined,
  );
  const title = content.billNumber
    ? `${content.billNumber}: ${content.title}`
    : content.title;
  const description = truncate(
    shareSummary(content) || `${readerText(language, type.kind)} · Billion`,
    200,
  );
  const canonical = `/b/${shareSegment(content.title, content.id)}${language === "en" ? "" : `?lang=${language}`}`;
  const images =
    language === "en"
      ? undefined
      : [
          {
            url: `/b/${content.id}/story?lang=${language}&format=og`,
            width: 1200,
            height: 630,
            alt: title,
          },
        ];

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
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}

export default async function SharedContentPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const language = readerLanguage((await searchParams).lang);
  const t = (text: string) => readerText(language, text);
  const { content, pending } = await getLocalizedSharedContent(id, language);
  if (pending)
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1>{t("Translation is being prepared.")}</h1>
        <a href={`?lang=${language}`}>{t("Try again")}</a>
        <br />
        <a href="?lang=en">{t("Read in English")}</a>
      </main>
    );
  if (!content) notFound();

  const type = presentType(
    content.type,
    content.type === "government_content"
      ? content.governmentContentType
      : undefined,
  );
  const brief = briefOf(content);
  const art = headerImage(content);
  const isAndroid = isAndroidUserAgent((await headers()).get("user-agent"));
  const summary = brief?.summary ? plainText(brief.summary) : "";

  return (
    <main className="bg-background text-foreground min-h-screen">
      <nav
        className="mx-auto flex items-center justify-between px-5 py-4"
        style={{ maxWidth: 640 }}
      >
        <Link
          href="/"
          className="text-foreground font-display text-[20px] font-bold tracking-[-0.02em] no-underline"
        >
          Billion
        </Link>
        <span className="text-muted-foreground font-sans text-[12px] font-medium tracking-[0.04em] uppercase">
          {t(type.kind)}
        </span>
        <div className="flex gap-3 text-sm">
          {(["en", "es", "zh"] as const).map((lang) => (
            <Link
              key={lang}
              href={`?lang=${lang}`}
              aria-current={language === lang ? "page" : undefined}
            >
              {lang === "zh" ? "中文" : lang === "es" ? "Español" : "English"}
            </Link>
          ))}
        </div>
      </nav>

      <article className="mx-auto px-5 pb-14" style={{ maxWidth: 640 }}>
        {art ? (
          // Header art is usually an inline data: URI written by the
          // pipeline, which the image optimizer cannot process.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            className="mb-[18px] h-[170px] w-full rounded-[16px] object-cover"
            style={{ backgroundColor: SURFACE }}
          />
        ) : null}

        <div className="mb-[14px] flex flex-wrap items-center gap-[9px]">
          <span
            className="rounded-[7px] px-[9px] py-[5px] font-sans text-[10.5px] font-bold tracking-[0.06em]"
            style={{ color: "#fff", backgroundColor: type.color }}
          >
            {t(type.label)}
          </span>
          {content.billNumber ? (
            <span className="text-muted-foreground font-sans text-[12px] font-semibold tracking-[0.3px]">
              {content.billNumber}
            </span>
          ) : null}
        </div>

        <h1
          className="font-display mb-4 font-bold tracking-[-0.02em]"
          style={{ fontSize: "clamp(1.9rem, 6.4vw, 2.4rem)", lineHeight: 1.14 }}
        >
          {content.title}
        </h1>

        <ArticleDates
          language={language}
          createdAt={content.createdAt}
          updatedAt={content.updatedAt}
        />

        {content.description ? (
          <p className="text-muted-foreground mb-[22px] font-sans text-[15px] leading-[22px]">
            {markdownToPlainText(content.description)}
          </p>
        ) : null}

        {/* The app's provenance note, verbatim in intent: this is AI writing
            over an official record, and the reader is told before they read. */}
        {/* Quiet on purpose. The reader has to be told this before they read,
            but it is not the thing they came for — a filled card here competes
            with the summary directly beneath it for the same attention. */}
        <p
          className="text-muted-foreground mb-[22px] flex items-center gap-[7px] border-t pt-[13px] font-sans text-[12px] leading-[16px]"
          style={{ borderColor: HAIR_1 }}
        >
          <span aria-hidden style={{ color: type.color }}>
            ✦
          </span>
          {t("Written by Billion AI · Always check the source")}
        </p>

        {language !== "en" && (
          <p className="text-muted-foreground mb-4 text-sm">
            {t("Machine translated · Original sources retain their language.")}
          </p>
        )}
        {brief ? (
          <Brief
            language={language}
            brief={brief}
            summary={summary}
            accent={type.color}
          />
        ) : (
          <Excerpt content={content} />
        )}

        <ExitToSource language={language} url={content.url} />
        <InstallCta language={language} isAndroid={isAndroid} />
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

function Brief({
  language,
  brief,
  summary,
  accent,
}: {
  language: ReaderLanguage;
  brief: BillBriefRecord;
  summary: string;
  accent: string;
}) {
  const t = (text: string) => readerText(language, text);
  return (
    <div className="flex flex-col gap-7">
      {summary ? (
        <section
          className="rounded-[14px] border p-4"
          style={{
            backgroundColor: SLATE,
            borderColor: HAIR_1,
            borderLeftWidth: 3,
            borderLeftColor: accent,
          }}
        >
          <div className="mb-[13px] flex items-center gap-[9px]">
            <span
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] text-[13px]"
              style={{ backgroundColor: `${accent}28`, color: accent }}
              aria-hidden
            >
              ✦
            </span>
            <h2 className="font-editorial flex-1 text-[17px] font-bold">
              {t("The short version")}
            </h2>
            <span
              className="rounded-full border px-[9px] py-[3px] font-sans text-[9.5px] font-bold tracking-[0.08em] uppercase"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              {brief.legalStatus === "enacted" ? t("Enacted") : t("Proposed")}
            </span>
          </div>
          <p className="font-sans text-[15px] leading-[23px] text-white">
            <Emphasis text={brief.summary} />
          </p>
        </section>
      ) : null}

      <section>
        <BlockTitle>{t("What this means for you")}</BlockTitle>
        <p className="font-sans text-[15px] leading-[23px] text-white/[0.82]">
          <Emphasis text={brief.hook} />
        </p>
      </section>

      <section>
        <BlockTitle>{t("What would change")}</BlockTitle>
        <div className="flex flex-col gap-3">
          {brief.changes.map((change, index) => (
            <div
              key={index}
              className="rounded-[14px] border p-[15px]"
              style={{ backgroundColor: SLATE, borderColor: HAIR_1 }}
            >
              <h3 className="mb-[11px] font-sans text-[16px] leading-[22px] font-semibold">
                {change.title}
              </h3>
              <dl className="flex flex-col gap-2 font-sans text-[14px] leading-[20px]">
                <div className="flex flex-col gap-[3px] sm:flex-row sm:gap-3">
                  <dt className="text-muted-foreground shrink-0 text-[10.5px] font-bold tracking-[0.08em] uppercase sm:w-[52px] sm:pt-[3px]">
                    {t("Now")}
                  </dt>
                  <dd className="text-muted-foreground m-0">
                    <Emphasis text={change.before} />
                  </dd>
                </div>
                <div className="flex flex-col gap-[3px] sm:flex-row sm:gap-3">
                  <dt
                    className="shrink-0 text-[10.5px] font-bold tracking-[0.08em] uppercase sm:w-[52px] sm:pt-[3px]"
                    style={{ color: accent }}
                  >
                    {t("After")}
                  </dt>
                  <dd className="m-0 text-white/[0.88]">
                    <Emphasis text={change.after} />
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <BlockTitle>{t("Who it lands on")}</BlockTitle>
        <div className="flex flex-col gap-[14px]">
          {brief.affected.map((group, index) => {
            const outcome = DIRECTION[group.direction] ?? UNCLEAR;
            return (
              <div
                key={index}
                className="border-l-2 pl-[13px]"
                style={{ borderColor: `${outcome.color}66` }}
              >
                <div className="mb-[5px] flex flex-wrap items-center gap-[7px]">
                  <span
                    className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: `${outcome.color}22`,
                      color: outcome.color,
                    }}
                    aria-hidden
                  >
                    {outcome.mark}
                  </span>
                  <h3 className="font-sans text-[14.5px] font-bold">
                    {group.group}
                  </h3>
                  <span
                    className="font-sans text-[10px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: outcome.color }}
                  >
                    {t(outcome.label)}
                  </span>
                </div>
                <p className="font-editorial text-[15.5px] leading-[21px] text-white/[0.72]">
                  <Emphasis text={group.takeaway} />
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {brief.unknowns.length > 0 ? (
        <section
          className="rounded-[14px] border p-[15px]"
          style={{ backgroundColor: SURFACE, borderColor: HAIR_2 }}
        >
          <h2 className="font-editorial mb-[10px] text-[15px] font-bold">
            {t("What the text doesn't settle")}
          </h2>
          <ol className="m-0 flex list-none flex-col gap-[9px] p-0">
            {brief.unknowns.map((unknown, index) => (
              <li key={index} className="flex gap-[10px]">
                <span
                  className="shrink-0 font-sans text-[13.5px] font-bold tabular-nums"
                  style={{ color: "#F4C95D" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-sans text-[13.5px] leading-[20px] text-white/[0.78]">
                  <Emphasis text={unknown} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-editorial mb-[13px] text-[18px] font-bold">
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
  const excerpt = truncate(markdownToPlainText(content.articleContent), 900);
  if (!excerpt) return null;

  return (
    <p className="font-sans text-[15px] leading-[24px] text-white/[0.82]">
      {excerpt}
    </p>
  );
}

/* ---------- exits ---------- */

/** The app ends its explainer by handing the reader back to the record. */
function ExitToSource({
  url,
  language,
}: {
  url?: string;
  language: ReaderLanguage;
}) {
  const t = (text: string) => readerText(language, text);
  if (!url) return null;
  return (
    <section
      className="mt-8 rounded-[16px] border p-5"
      style={{ backgroundColor: SLATE, borderColor: HAIR_2 }}
    >
      <h2 className="font-display mb-[6px] text-[18px] font-bold">
        {t("Don't take our word for it.")}
      </h2>
      <p className="text-muted-foreground mb-4 font-sans text-[14px] leading-[20px]">
        {t("Read the full, unedited text on the official record.")}
      </p>
      <a
        href={url}
        rel="noopener noreferrer nofollow"
        target="_blank"
        className="text-accent font-sans text-[14px] font-semibold no-underline"
      >
        {t("Open the source →")}
      </a>
    </section>
  );
}

function InstallCta({
  isAndroid,
  language,
}: {
  isAndroid: boolean;
  language: ReaderLanguage;
}) {
  const t = (text: string) => readerText(language, text);
  return (
    <aside
      className="mt-4 rounded-[16px] border p-5"
      style={{ backgroundColor: SURFACE, borderColor: HAIR_2 }}
    >
      <h2 className="font-display mb-[6px] text-[18px] font-bold">
        {isAndroid
          ? t("Billion isn't on Android yet.")
          : t("Every bill, explained like this.")}
      </h2>
      <p className="text-muted-foreground mb-4 font-sans text-[14px] leading-[20px]">
        {isAndroid
          ? t(
              "We're building it. Leave your email and we'll tell you the day it's ready.",
            )
          : t(
              "Bills, executive orders and court cases in plain language, with the original text one tap away.",
            )}
      </p>

      {isAndroid ? (
        <WaitlistForm language={language} buttonText={t("Notify me")} />
      ) : (
        <a
          href={`/r?dest=app&p=${APP_STORE_CAMPAIGN}`}
          className="bg-primary text-primary-foreground inline-flex items-center rounded-full px-[22px] py-[11px] font-sans text-[14.5px] font-semibold no-underline transition-opacity duration-200 hover:opacity-90"
        >
          {t("Get Billion for iPhone")}
        </a>
      )}
    </aside>
  );
}
