"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";

import { APP_STORE_URL } from "~/app/_lib/app-store";
import { BillionMark } from "./marks";
import { useJourney } from "./use-journey";

export function SiteNavigation() {
  const { reducedMotion } = useJourney();
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const team = document.getElementById("team");
    if (!team) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setActiveSection(entry?.isIntersecting ? "team" : "overview");
      },
      { rootMargin: "-72px 0px -50% 0px" },
    );
    observer.observe(team);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <header className="cinematic-site-header">
      <a className="cinematic-skip" href="#team">
        Skip to team
      </a>
      <nav aria-label="Main" className="cinematic-site-nav">
        <a
          href="#overview"
          className="cinematic-nav-brand"
          aria-label="Billion home"
        >
          <BillionMark size={28} />
          <span>Billion</span>
        </a>
        <div className="cinematic-nav-actions">
          <a
            href="#overview"
            className="cinematic-section-link"
            aria-current={activeSection === "overview" ? "location" : undefined}
          >
            Overview
          </a>
          <a
            href="#team"
            className="cinematic-section-link"
            aria-current={activeSection === "team" ? "location" : undefined}
          >
            Team
          </a>
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
        </div>
      </nav>
    </header>
  );
}
