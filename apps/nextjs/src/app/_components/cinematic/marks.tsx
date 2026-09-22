import { CinematicPalette } from "./palette";

/** Real brand mark — ivory B on navy. Never gold. */
export function BillionMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/billion-logo.png"
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
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
