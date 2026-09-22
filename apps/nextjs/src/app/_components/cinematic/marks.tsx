"use client";

import { useEffect, useId, useState } from "react";

import { B_PATHS } from "./billion-mark-paths";
import { CinematicPalette } from "./palette";

/** Digest spark — same foil midtone as Expo `GoldBillionMark`. */
const FOIL_GOLD = "#D4AF37";

/**
 * Brand B with traveling gold foil (matches native GoldBillionMark).
 * Reduced motion: flat spark fill, no sweep.
 */
export function BillionMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const foilId = `bfoil-${uid}`;
  const specId = `bspec-${uid}`;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (reduceMotion) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        {B_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={FOIL_GOLD}
            stroke={FOIL_GOLD}
            strokeWidth={0.35}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className ? `billion-foil-mark ${className}` : "billion-foil-mark"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={foilId}
          gradientUnits="userSpaceOnUse"
          x1={-10}
          y1={-6}
          x2={30}
          y2={30}
        >
          <stop offset="0" stopColor="#3D2A0C" />
          <stop offset="0.18" stopColor="#8A6410" />
          <stop offset="0.38" stopColor={FOIL_GOLD} />
          <stop offset="0.5" stopColor="#FFE9A8" />
          <stop offset="0.62" stopColor={FOIL_GOLD} />
          <stop offset="0.82" stopColor="#8A6410" />
          <stop offset="1" stopColor="#3D2A0C" />
          <animate
            attributeName="x1"
            values="-14;8;-14"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="y1"
            values="-8;2;-8"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="x2"
            values="26;48;26"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="y2"
            values="28;38;28"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </linearGradient>
        <linearGradient
          id={specId}
          gradientUnits="userSpaceOnUse"
          x1={-12}
          y1={0}
          x2={28}
          y2={10}
        >
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.38" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.62" />
          <stop offset="0.62" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          <animate
            attributeName="x1"
            values="-16;10;-16"
            dur="2.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="x2"
            values="24;50;24"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      {B_PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={`url(#${foilId})`}
          stroke={`url(#${foilId})`}
          strokeWidth={0.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {B_PATHS.map((d, i) => (
        <path key={`s-${i}`} d={d} fill={`url(#${specId})`} />
      ))}
    </svg>
  );
}

export function GoldPointMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6.5" fill={CinematicPalette.gold} />
    </svg>
  );
}

export function ExploreArrowMark({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 1v11.5M1.5 9.5 5 13l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SectionRule({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 8"
      width="180"
      height="8"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 4h66"
        stroke={CinematicPalette.gold}
        strokeWidth="0.8"
        strokeOpacity="0.85"
      />
      <circle cx="90" cy="4" r="1.35" fill={CinematicPalette.gold} />
      <path
        d="M112 4h66"
        stroke={CinematicPalette.gold}
        strokeWidth="0.8"
        strokeOpacity="0.85"
      />
    </svg>
  );
}

export function DocumentMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7 3.5h7.2L18.5 8v12.5H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M14.2 3.5V8H18.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M9.2 12h6.2M9.2 15.2h4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FlowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.5 12h13.5M13.5 7.5 18.5 12l-5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TerrainMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 17.5 8.2 9.5l3.4 4.8 3.1-6.6L21 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UnitedStatesOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 620"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M188 214c22-38 61-68 104-79 46-12 94-6 139 4 41 9 83 8 124-2 39-9 80-4 116 14 33 16 70 18 104 9 28-7 58 4 74 28 14 21 12 51-3 72-9 13-9 32 1 45 16 22 18 52 6 77-12 24-38 40-64 47-31 8-61 23-81 48-16 19-41 29-66 29-29 0-57 11-77 32-22 24-55 35-87 31-36-4-72-3-104 10-29 12-62 10-89-4-32-17-71-18-104-4-21 9-46 4-61-14-17-21-17-52 1-73 13-16 15-39 5-57-14-27-12-61 6-86 13-18 16-43 7-64-7-16-3-36 10-47z"
        stroke={CinematicPalette.gold}
        strokeOpacity="0.28"
        strokeWidth="1.4"
      />
    </svg>
  );
}
