"use client";

import { CHAPTER_IDS, CHAPTER_VH, totalJourneyVh } from "./journey";
import { JourneyOverlay } from "./JourneyOverlay";
import { PhoneStage } from "./PhoneStage";
import { ReducedMotionPage } from "./ReducedMotionPage";
import { JourneyProvider, useJourney } from "./use-journey";
import { WorldStage } from "./WorldStage";

import "./cinematic.css";

function JourneyFrame() {
  const { reducedMotion, overlayProgress } = useJourney();

  if (reducedMotion) {
    return <ReducedMotionPage />;
  }

  const worldOpacity =
    overlayProgress < 0.11
      ? 0
      : Math.min(1, (overlayProgress - 0.11) / 0.05);

  return (
    <div className="cinematic-root">
      <div className="cinematic-stage">
        <div className="cinematic-world" style={{ opacity: worldOpacity }}>
          <WorldStage />
        </div>
        <PhoneStage />
        <JourneyOverlay />
      </div>
      <div
        className="cinematic-scroll"
        style={{ height: `${totalJourneyVh()}vh` }}
      >
        {CHAPTER_IDS.map((id) => (
          <section
            key={id}
            id={id}
            style={{ height: `${CHAPTER_VH[id]}vh` }}
            aria-label={id}
          />
        ))}
      </div>
    </div>
  );
}

export function CinematicExperience() {
  return (
    <JourneyProvider>
      <JourneyFrame />
    </JourneyProvider>
  );
}
