"use client";

import { APP_STORE_URL } from "~/app/_lib/app-store";
import { DocumentMark, FlowMark, TerrainMark } from "./marks";
import { CinematicPalette } from "./palette";

const ROWS = [
  {
    kicker: "What's moving",
    title: "H.R. 3935 advanced in committee",
    dek: "Aviation, labor, and airport funding now share one legislative path.",
    Mark: DocumentMark,
  },
  {
    kicker: "What changed",
    title: "Federal AI procurement memo signed",
    dek: "Agencies must disclose model use in new contracts above a threshold.",
    Mark: FlowMark,
  },
  {
    kicker: "Why it matters",
    title: "Defense vendors face new reporting",
    dek: "The requirement travels from executive action into existing programs.",
    Mark: DocumentMark,
  },
  {
    kicker: "What comes next",
    title: "House floor vote expected Thursday",
    dek: "If it passes, implementation begins in the next fiscal quarter.",
    Mark: TerrainMark,
  },
] as const;

export function ProductInterface({ opacity }: { opacity: number }) {
  return (
    <div
      className="cinematic-product"
      style={{ opacity, pointerEvents: opacity > 0.35 ? "auto" : "none" }}
      aria-hidden={opacity < 0.2}
    >
      <div className="cinematic-product-frame">
        <header className="cinematic-product-head">
          <span className="cinematic-product-word">Billion</span>
          <span className="cinematic-product-meta">Intelligence feed</span>
        </header>
        <div className="cinematic-product-rule" />
        <ul className="cinematic-product-list">
          {ROWS.map((row, index) => (
            <li
              key={row.kicker}
              className={index === 0 ? "is-live" : undefined}
            >
              <row.Mark />
              <div>
                <p className="cinematic-product-kicker">{row.kicker}</p>
                <p className="cinematic-product-title">{row.title}</p>
                <p className="cinematic-product-dek">{row.dek}</p>
              </div>
            </li>
          ))}
        </ul>
        <a
          href={APP_STORE_URL}
          className="cinematic-product-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open the feed
        </a>
      </div>
      <svg
        className="cinematic-product-corners"
        viewBox="0 0 320 420"
        aria-hidden="true"
      >
        <path
          d="M8 28V8h20M312 28V8h-20M8 392v20h20M312 392v20h-20"
          fill="none"
          stroke={CinematicPalette.gold}
          strokeWidth="1"
          strokeOpacity="0.55"
        />
      </svg>
    </div>
  );
}
