"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import posthog from "posthog-js";

import { APP_STORE_URL } from "~/app/_lib/app-store";
import { WaitlistForm } from "../waitlist-form";
import { TopicPills } from "./AppFace";
import {
  BILL_NODES,
  COMPLICATED_BEATS,
  COPY_BEATS,
  billJourneyAt,
} from "./journey";
import { BillionMark, SectionRule } from "./marks";
import { useJourney } from "./use-journey";

function CopyBlock({
  opacity,
  align = "center",
  children,
}: {
  opacity: number;
  align?:
    | "center"
    | "left"
    | "right"
    | "lower"
    | "hero"
    | "statement"
    | "hero-left"
    | "hero-right"
    | "bill"
    | "finale";
  children: ReactNode;
}) {
  const { width } = useJourney();
  const compact = width < 760;
  const visible = opacity > 0.03;
  const shift = (1 - opacity) * 12;
  const isColumn =
    align === "left" ||
    align === "right" ||
    align === "statement" ||
    align === "hero-left" ||
    align === "hero-right" ||
    align === "bill" ||
    align === "finale";
  const stackHero =
    compact &&
    (align === "hero-left" ||
      align === "hero-right" ||
      align === "bill" ||
      align === "finale");
  const centerHero =
    !compact &&
    (align === "hero-left" || align === "hero-right" || align === "bill");
  const pinLower = align === "lower";
  const transform = stackHero
    ? `translate(-50%, ${shift}px)`
    : pinLower
      ? `translate(-50%, ${shift}px)`
      : centerHero
        ? `translateY(calc(-50% + ${shift}px))`
        : isColumn
          ? `translateY(${shift}px)`
          : `translate(-50%, calc(-50% + ${shift}px))`;
  return (
    <div
      className={`cinematic-copy cinematic-copy-${align}`}
      style={{
        opacity,
        transform,
        pointerEvents: opacity > 0.25 ? "auto" : "none",
      }}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}

export function JourneyOverlay() {
  const {
    overlayProgress: p,
    focusTopic,
    setFocusTopic,
    width,
  } = useJourney();

  const bill = billJourneyAt(p);
  const compact = width < 760;

  return (
    <div className="cinematic-overlay" suppressHydrationWarning>
      <a className="cinematic-skip" href="#download">
        Skip to download
      </a>

      <header className="cinematic-nav" style={{ opacity: p < 0.96 ? 1 : 0 }}>
        <span className="cinematic-nav-brand">
          <BillionMark size={28} />
          Billion
        </span>
        <a
          href={APP_STORE_URL}
          className="cinematic-pill cinematic-pill-nav"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            posthog.capture("app_store_clicked", { surface: "nav" })
          }
        >
          Download
        </a>
      </header>

      <CopyBlock opacity={COPY_BEATS.hero(p)} align="hero-left">
        <h1 className="cinematic-headline cinematic-headline-hero">
          Know what
          <br />
          government
          <br />
          is doing.
        </h1>
      </CopyBlock>

      <CopyBlock opacity={COPY_BEATS.hero(p)} align="hero-right">
        <p className="cinematic-dek cinematic-dek-left">
          Bills, elections, courts, and executive actions — in English, on
          your phone.
        </p>
        <div className="cinematic-hero-actions cinematic-hero-actions-start">
          <a
            href={APP_STORE_URL}
            className="cinematic-pill"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              posthog.capture("app_store_clicked", { surface: "hero" })
            }
          >
            Download →
          </a>
        </div>
      </CopyBlock>

      <CopyBlock opacity={COPY_BEATS.complicatedHead(p)} align="left">
        <SectionRule />
        <p className="cinematic-headline cinematic-headline-sm">
          Government is complicated.
          <br />
          Billion isn’t.
        </p>
      </CopyBlock>

      {COMPLICATED_BEATS.map((beat) => (
        <CopyBlock
          key={beat.id}
          opacity={COPY_BEATS[beat.id](p)}
          align={compact ? "center" : "statement"}
        >
          <p className="cinematic-word">{beat.word}</p>
          <p className="cinematic-dek cinematic-dek-left">{beat.line}</p>
        </CopyBlock>
      ))}

      <CopyBlock opacity={COPY_BEATS.bill(p)} align="bill">
        <p className="cinematic-headline cinematic-headline-section">
          A bill enters Congress.
        </p>
        <p className="cinematic-dek cinematic-dek-left">
          Billion keeps the official timeline.
        </p>
        <div className="cinematic-bill-thread">
          <div className="cinematic-bill-rail" aria-hidden="true">
            <span
              className="cinematic-bill-rail-fill"
              style={{
                height: `${((bill.node + 0.5) / BILL_NODES.length) * 100}%`,
              }}
            />
            <span
              className="cinematic-bill-pip"
              style={{
                top: `${((bill.node + 0.5) / BILL_NODES.length) * 100}%`,
              }}
            />
          </div>
          <ol className="cinematic-bill-steps">
            {BILL_NODES.map((node, i) => {
              const active = bill.node === i;
              const seen = bill.node > i;
              return (
                <li
                  key={node.id}
                  className={
                    active ? "is-active" : seen ? "is-seen" : undefined
                  }
                >
                  <time>{node.date}</time>
                  <strong>{node.label}</strong>
                  <em>{node.note}</em>
                </li>
              );
            })}
          </ol>
        </div>
      </CopyBlock>

      <CopyBlock opacity={COPY_BEATS.personal(p)} align="bill">
        <p className="cinematic-kicker">
          Built for people who don’t live in Washington.
        </p>
        <p className="cinematic-headline cinematic-headline-section">
          You shouldn’t need to follow politics all day.
        </p>
        <p className="cinematic-dek cinematic-dek-left">
          Choose what you watch. Billion reorganizes around it.
        </p>
        <TopicPills
          active={focusTopic}
          onSelect={(id) => setFocusTopic(id)}
        />
      </CopyBlock>

      <CopyBlock opacity={COPY_BEATS.download(p)} align="finale">
        <div className="cinematic-finale-copy">
          <p className="cinematic-headline cinematic-headline-section">
            Government doesn’t stop moving.
          </p>
          <p className="cinematic-dek cinematic-dek-left">
            Neither should your understanding of it.
          </p>
          <div className="cinematic-finale-actions">
            <a
              href={APP_STORE_URL}
              className="cinematic-pill"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                posthog.capture("app_store_clicked", { surface: "download" })
              }
            >
              Download Billion →
            </a>
          </div>
          <div className="cinematic-finale-form">
            <p>Or get a note when something important ships.</p>
            <WaitlistForm formLocation="cinematic-download" />
          </div>
        </div>
        <div className="cinematic-finale-capitol" aria-hidden>
          <img src="/digest-craft/capitol.svg?v=full3" alt="" />
        </div>
      </CopyBlock>

      <footer
        className="cinematic-footer"
        style={{ opacity: p > 0.92 ? 1 : 0 }}
      >
        <span>© 2026 Bryan Hu</span>
        <div>
          <Link href="/support">Support</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
