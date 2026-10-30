"use client";

import {
  CHAPTER_IDS,
  CHAPTER_VH,
  compactLayout,
  totalJourneyVh,
} from "./journey";
import { JourneyOverlay } from "./JourneyOverlay";
import { PhoneStage } from "./PhoneStage";
import { SiteNavigation } from "./SiteNavigation";
import { StaticExperience } from "./StaticExperience";
import { TeamSection } from "./TeamSection";
import { JourneyProvider, useJourney } from "./use-journey";
import { WorldStage } from "./WorldStage";

import "./cinematic.css";

function JourneyFrame() {
  const { reducedMotion, stageCovered, overlayProgress, width, height } =
    useJourney();

  if (reducedMotion) return <StaticExperience />;

  const compact = compactLayout(width, height);

  const worldOpacity =
    overlayProgress < 0.11 ? 0 : Math.min(1, (overlayProgress - 0.11) / 0.05);

  return (
    <main
      id="overview"
      tabIndex={-1}
      className={
        compact === "stacked"
          ? "cinematic-root is-compact is-stacked"
          : compact
            ? "cinematic-root is-compact"
            : "cinematic-root"
      }
    >
      <div
        className="cinematic-stage"
        inert={stageCovered}
        aria-hidden={stageCovered}
      >
        <div className="cinematic-world" style={{ opacity: worldOpacity }}>
          <WorldStage />
        </div>
        <PhoneStage />
        <JourneyOverlay />
      </div>
      <div
        id="cinematic-journey"
        className="cinematic-scroll"
        style={{ height: `${totalJourneyVh()}svh` }}
      >
        {CHAPTER_IDS.map((id) => (
          <section
            key={id}
            id={id}
            style={{ height: `${CHAPTER_VH[id]}svh` }}
            aria-label={id}
          />
        ))}
      </div>
      <TeamSection />
    </main>
  );
}

export function CinematicExperience() {
  return (
    <JourneyProvider>
      <SiteNavigation />
      <JourneyFrame />
    </JourneyProvider>
  );
}
