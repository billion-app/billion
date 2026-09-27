"use client";

import Image from "next/image";
import Link from "next/link";
import posthog from "posthog-js";

import { APP_STORE_URL } from "~/app/_lib/app-store";
import { WaitlistForm } from "../waitlist-form";
import { BILL_NODES, COMPLICATED_BEATS, PERSONAL_TOPICS } from "./journey";
import { BillionMark, SectionRule } from "./marks";

export function StaticExperience() {
  const surface = "reduced-motion";
  return (
    <main className="cinematic-static">
      <nav className="cinematic-static-nav" aria-label="Main">
        <span className="cinematic-nav-brand">
          <BillionMark size={28} />
          Billion
        </span>
        <a
          href={APP_STORE_URL}
          className="cinematic-pill cinematic-pill-nav"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download
        </a>
      </nav>
      <header className="cinematic-static-hero">
        <h1>Know what government is doing.</h1>
        <p className="cinematic-dek cinematic-dek-left">
          Bills, elections, courts, and executive actions — in English, on your
          phone.
        </p>
        <a
          href={APP_STORE_URL}
          className="cinematic-pill"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture("app_store_clicked", { surface })}
        >
          Download →
        </a>
        <div className="cinematic-static-product">
          <Image
            src="/product-screens/feed.png"
            width={390}
            height={844}
            sizes="(max-width: 760px) 80vw, 390px"
            alt="Billion's daily brief with sourced news about California legislation"
            loading="eager"
            unoptimized
          />
        </div>
      </header>

      <section className="cinematic-static-section">
        <SectionRule />
        <h2>Government is complicated. Billion isn’t.</h2>
        <ul className="cinematic-static-timeline">
          {COMPLICATED_BEATS.map((beat) => (
            <li key={beat.id}>
              <strong>{beat.word}</strong>
              <span>{beat.line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cinematic-static-section">
        <SectionRule />
        <h2>A bill enters Congress.</h2>
        <p className="cinematic-dek cinematic-dek-left">
          Billion keeps the official timeline.
        </p>
        <ol className="cinematic-static-timeline">
          {BILL_NODES.map((node) => (
            <li key={node.id}>
              <time>{node.date}</time>
              <strong>{node.label}</strong>
              <span>{node.note}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="cinematic-static-section">
        <SectionRule />
        <p className="cinematic-kicker">
          Built for people who don’t live in Washington.
        </p>
        <h2>You shouldn’t need to follow politics all day.</h2>
        <p className="cinematic-dek cinematic-dek-left">
          Choose what you watch. Billion reorganizes around it.
        </p>
        <p className="cinematic-static-topics">
          {PERSONAL_TOPICS.map((topic) => topic.label).join(" · ")}
        </p>
      </section>

      <section id="download" className="cinematic-static-end">
        <h2>
          Government doesn’t stop moving. Neither should your understanding of
          it.
        </h2>
        <a
          href={APP_STORE_URL}
          className="cinematic-pill"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download Billion
        </a>
        <div className="cinematic-finale-form">
          <WaitlistForm formLocation={surface} />
        </div>
        <footer>
          <Link href="/support">Support</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </footer>
      </section>
    </main>
  );
}
