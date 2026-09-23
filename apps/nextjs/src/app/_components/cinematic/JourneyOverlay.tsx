"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import posthog from "posthog-js";

import { APP_STORE_URL } from "~/app/_lib/app-store";
import { WaitlistForm } from "../waitlist-form";
import { TopicPills } from "./AppFace";
import {
  BILL_NODES,
  billJourneyAt,
  compactLayout,
  COMPLICATED_BEATS,
  copyOpacityAt,
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
    | "bill"
    | "finale";
  children: ReactNode;
}) {
  const { width, height } = useJourney();
  const compact = compactLayout(width, height);
  const visible = opacity > 0.03;
  const shift = (1 - opacity) * 12;
  const transform =
    align === "bill" && !compact
      ? `translateY(calc(-50% + ${shift}px))`
      : align === "lower"
        ? `translate(-50%, ${shift}px)`
        : align === "center"
          ? `translate(-50%, calc(-50% + ${shift}px))`
          : `translateY(${shift}px)`;
  return (
    <div
      className={`cinematic-copy cinematic-copy-${align}`}
      style={{
        opacity,
        transform,
        pointerEvents: opacity > 0.25 ? "auto" : "none",
      }}
      aria-hidden={!visible}
      inert={!visible}
      data-lenis-prevent={compact && align === "finale" ? true : undefined}
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
    height,
  } = useJourney();
  const compact = compactLayout(width, height);

  const bill = billJourneyAt(p);

  return (
    <div className="cinematic-overlay" suppressHydrationWarning>
      <a className="cinematic-skip" href="#download">
        Skip to download
      </a>

      <header
        className="cinematic-nav"
        style={{ opacity: p < 0.96 ? 1 : 0 }}
        inert={p >= 0.96}
        aria-hidden={p >= 0.96}
      >
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

      <CopyBlock opacity={copyOpacityAt("hero", p, !!compact)} align="hero">
        <h1 className="cinematic-headline cinematic-headline-hero">
          Know what government is doing.
        </h1>
        <div className="cinematic-hero-summary">
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
        </div>
      </CopyBlock>

      <CopyBlock
        opacity={copyOpacityAt("complicatedHead", p, !!compact)}
        align="left"
      >
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
          opacity={copyOpacityAt(beat.id, p, !!compact)}
          align="statement"
        >
          <p className="cinematic-word">{beat.word}</p>
          <p className="cinematic-dek cinematic-dek-left">{beat.line}</p>
        </CopyBlock>
      ))}

      <CopyBlock opacity={copyOpacityAt("bill", p, !!compact)} align="bill">
        <p className="cinematic-headline cinematic-headline-section">
          A bill enters Congress.
        </p>
        <p className="cinematic-dek cinematic-dek-left">
          Billion keeps the official timeline.
        </p>
        {compact ? (
          <div className="cinematic-mobile-timeline">
            <div
              className="cinematic-mobile-steps"
              aria-label={`Step ${bill.node + 1} of ${BILL_NODES.length}`}
            >
              {BILL_NODES.map((node, i) => (
                <span
                  key={node.id}
                  className={i <= bill.node ? "is-seen" : undefined}
                />
              ))}
            </div>
            <div key={bill.node} className="cinematic-mobile-step">
              <p className="cinematic-kicker">
                {bill.node + 1} / {BILL_NODES.length} ·{" "}
                {BILL_NODES[bill.node]?.date}
              </p>
              <strong>{BILL_NODES[bill.node]?.label}</strong>
              <p>{BILL_NODES[bill.node]?.note}</p>
            </div>
          </div>
        ) : (
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
        )}
      </CopyBlock>

      <CopyBlock opacity={copyOpacityAt("personal", p, !!compact)} align="bill">
        <p className="cinematic-kicker">
          Built for people who don’t live in Washington.
        </p>
        <p className="cinematic-headline cinematic-headline-section">
          You shouldn’t need to follow politics all day.
        </p>
        <p className="cinematic-dek cinematic-dek-left">
          Choose what you watch. Billion reorganizes around it.
        </p>
        <TopicPills active={focusTopic} onSelect={(id) => setFocusTopic(id)} />
      </CopyBlock>

      <CopyBlock
        opacity={copyOpacityAt("download", p, !!compact)}
        align="finale"
      >
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
        inert={p <= 0.92}
        aria-hidden={p <= 0.92}
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
