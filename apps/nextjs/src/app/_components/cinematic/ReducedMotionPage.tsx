"use client";

import Link from "next/link";
import posthog from "posthog-js";

import { APP_STORE_URL } from "~/app/_lib/app-store";
import { WaitlistForm } from "../waitlist-form";
import { COMPLICATED_BEATS, EDITORIAL_PHONES, PERSONAL_TOPICS } from "./journey";
import { BillionMark, SectionRule } from "./marks";

export function ReducedMotionPage() {
  return (
    <main className="cinematic-static">
      <header className="cinematic-static-hero">
        <BillionMark size={22} />
        <h1>Know what government is doing.</h1>
        <p className="cinematic-dek cinematic-dek-left">
          Billion turns bills, elections, court decisions, and executive actions
          into intelligence you can actually understand.
        </p>
        <a
          href={APP_STORE_URL}
          className="cinematic-store"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            posthog.capture("app_store_clicked", { surface: "reduced-motion" })
          }
        >
          Download on the App Store
        </a>
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
        <div className="cinematic-static-phones">
          {EDITORIAL_PHONES.map((phone) => (
            <article key={phone.id}>
              <p className="cinematic-kicker">{phone.kicker}</p>
              <h3>{phone.title}</h3>
              <p className="cinematic-dek cinematic-dek-left">{phone.dek}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cinematic-static-end">
        <h2>
          Government doesn’t stop moving. Neither should your understanding of
          it.
        </h2>
        <a
          href={APP_STORE_URL}
          className="cinematic-store"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download Billion
        </a>
        <div className="cinematic-finale-form">
          <WaitlistForm formLocation="reduced-motion" />
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
