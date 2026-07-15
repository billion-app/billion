"use client";

import Link from "next/link";
import { motion } from "motion/react";

import {
  AnimatedSection,
  EASE_OUT_QUART,
  StaggerContainer,
  StaggerItem,
} from "./animations";

interface LegalSection {
  title: string;
  body: string;
}

export function LegalPage({
  title,
  lastUpdated,
  sections,
  crossLinkHref,
  crossLinkLabel,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  crossLinkHref: string;
  crossLinkLabel: string;
}) {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <motion.nav
        initial={{ opacity: 0, filter: "blur(8px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5, ease: EASE_OUT_QUART }}
        className="mx-auto flex items-center justify-between px-6 py-5"
        style={{ maxWidth: 1120 }}
      >
        <Link
          href="/"
          className="text-foreground font-display text-[22px] font-bold tracking-[-0.02em] no-underline"
        >
          Billion
        </Link>
        <Link
          href={crossLinkHref}
          className="text-muted-foreground hover:text-accent font-sans text-[15px] font-medium no-underline transition-colors duration-200"
        >
          {crossLinkLabel}
        </Link>
      </motion.nav>

      <article
        className="mx-auto px-6 py-12 md:py-16"
        style={{ maxWidth: 720 }}
      >
        <StaggerContainer staggerDelay={0.1}>
          <StaggerItem
            variant="focusIn"
            className="tracking-label text-muted-foreground mb-2 block font-sans text-[12px] font-medium uppercase"
          >
            Last updated {lastUpdated}
          </StaggerItem>
          <StaggerItem variant="focusIn">
            <h1
              className="text-foreground font-display mb-10 leading-[1.15] font-bold tracking-[-0.02em]"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
            >
              {title}
            </h1>
          </StaggerItem>
        </StaggerContainer>

        <div className="flex flex-col gap-8">
          {sections.map((s, i) => (
            <AnimatedSection
              key={s.title}
              variant="fadeUp"
              delay={i < 3 ? 0.15 + i * 0.08 : 0}
            >
              <section>
                <h2 className="text-foreground mb-2 font-sans text-[15px] font-semibold">
                  {s.title}
                </h2>
                <p className="text-muted-foreground m-0 font-sans text-[16px] leading-[1.7]">
                  {s.body}
                </p>
              </section>
            </AnimatedSection>
          ))}
        </div>
      </article>

      <footer
        className="border-border mx-auto flex items-center justify-between border-t px-6 py-8"
        style={{ maxWidth: 1120 }}
      >
        <span className="text-muted-foreground font-display text-[18px] font-bold">
          Billion
        </span>
        <div className="flex items-center gap-5 font-sans text-[13px]">
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-accent no-underline transition-colors duration-200"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-accent no-underline transition-colors duration-200"
          >
            Privacy
          </Link>
          <span className="text-muted-foreground/70">
            &copy; 2026 Billion. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
