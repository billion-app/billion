"use client";

import {
  CHAPTER_IDS,
  CHAPTER_VH,
  compactLayout,
  totalJourneyVh,
} from "./journey";
import { JourneyOverlay } from "./JourneyOverlay";
import { PhoneStage } from "./PhoneStage";
import { StaticExperience } from "./StaticExperience";
import { JourneyProvider, useJourney } from "./use-journey";
import { WorldStage } from "./WorldStage";

import "./cinematic.css";

function JourneyFrame() {
  const { reducedMotion, overlayProgress, width, height } = useJourney();

  if (reducedMotion) return <StaticExperience />;

  const compact = compactLayout(width, height);

  const worldOpacity =
    overlayProgress < 0.11 ? 0 : Math.min(1, (overlayProgress - 0.11) / 0.05);

  return (
    <div
      className={
        compact === "stacked"
          ? "cinematic-root is-compact is-stacked"
          : compact
            ? "cinematic-root is-compact"
            : "cinematic-root"
      }
    >
      <div className="cinematic-stage">
        <div className="cinematic-world" style={{ opacity: worldOpacity }}>
          <WorldStage />
        </div>
        <PhoneStage />
        <JourneyOverlay />
      </div>
      <div
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
