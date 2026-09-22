"use client";

import { appScreenAt, phonePose } from "./journey";
import { AppFace } from "./AppFace";
import { useJourney } from "./use-journey";

export function PhoneStage() {
  const { overlayProgress, width } = useJourney();
  const pose = phonePose(overlayProgress, width);
  const screen = appScreenAt(overlayProgress);
  const flat = Math.abs(pose.rotateY) < 3 && Math.abs(pose.rotateX) < 3;

  return (
    <div className="phone-stage" aria-hidden={pose.opacity < 0.08}>
      <div
        className={`phone-rig${flat ? " is-hero" : ""}`}
        style={{
          left: `${pose.xPct}%`,
          top: `${pose.yPct}%`,
          opacity: pose.opacity,
          transform: `translate(-50%, -50%) scale(${pose.scale})`,
        }}
      >
        <div className="phone-shadow" />
        <div
          className={`phone-body${flat ? " is-flat" : ""}`}
          style={{
            transform: `rotateX(${pose.rotateX}deg) rotateY(${pose.rotateY}deg)`,
          }}
        >
          <span className="phone-rail phone-rail-left" />
          <span className="phone-rail phone-rail-right" />
          <span className="phone-btn phone-btn-silent" />
          <span className="phone-btn phone-btn-vol-up" />
          <span className="phone-btn phone-btn-vol-down" />
          <span className="phone-btn phone-btn-power" />
          <div className="phone-back" />
          <div className="phone-front">
            <div className="phone-glass">
              <AppFace screen={screen} />
              <div className="phone-specular" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
