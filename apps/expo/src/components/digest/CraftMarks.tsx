/**
 * Editorial craft ornaments for Digest detail screens.
 * Geometry mirrors apps/expo/assets/digest/craft/*.svg — see CREDITS.md.
 * Original Billion marks · CC0 · not stock-AI / not scraped.
 */
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { DigestPalette as P } from "~/styles";

const SPARK = P.spark;
const QUIET = P.quiet;
const NIGHT = P.canvas;

/** Centered spark diamond + hairline rule under kickers. */
export function SectionFlourish({ width = 120 }: { width?: number }) {
  const h = 12;
  return (
    <Svg width={width} height={h} viewBox="0 0 120 12" accessibilityElementsHidden>
      <Path d="M0 6H48" stroke={SPARK} strokeOpacity={0.55} strokeWidth={1} />
      <Path d="M72 6H120" stroke={SPARK} strokeOpacity={0.55} strokeWidth={1} />
      <Path d="M60 1.5L62.5 6L60 10.5L57.5 6L60 1.5Z" fill={SPARK} />
    </Svg>
  );
}

/** Pull-quote double-mark for paper brief. */
export function PullQuoteMark({ size = 28 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={(size * 24) / 32}
      viewBox="0 0 32 24"
      accessibilityElementsHidden
    >
      <Path
        d="M6 18C6 12.5 9 8.5 14 6.5L15.2 8.8C11.8 10.2 10.2 12.4 10.2 15H14.5V22H6V18Z"
        fill={SPARK}
      />
      <Path
        d="M18 18C18 12.5 21 8.5 26 6.5L27.2 8.8C23.8 10.2 22.2 12.4 22.2 15H26.5V22H18V18Z"
        fill={SPARK}
        fillOpacity={0.7}
      />
    </Svg>
  );
}

/** Contest empty / no-match illustration. */
export function EmptyBallotMark({ width = 96 }: { width?: number }) {
  const h = (width * 72) / 96;
  return (
    <Svg width={width} height={h} viewBox="0 0 96 72" accessibilityElementsHidden>
      <Rect
        x={18}
        y={8}
        width={60}
        height={56}
        rx={4}
        stroke={SPARK}
        strokeOpacity={0.7}
        strokeWidth={1.5}
        fill="none"
      />
      <Path d="M28 24H68" stroke={QUIET} strokeWidth={1.2} />
      <Path d="M28 34H58" stroke={QUIET} strokeWidth={1.2} />
      <Path d="M28 44H52" stroke={QUIET} strokeWidth={1.2} />
      <Circle cx={68} cy={52} r={10} fill={NIGHT} stroke={SPARK} strokeWidth={1.5} />
      <Path d="M64 52H72M68 48V56" stroke={SPARK} strokeWidth={1.4} />
    </Svg>
  );
}

/** Sponsor profile crest. */
export function SponsorCrest({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Circle
        cx={24}
        cy={24}
        r={22}
        stroke={SPARK}
        strokeOpacity={0.45}
        strokeWidth={1}
        fill="none"
      />
      <Path
        d="M24 8L28 18H38L30 24L33 34L24 28L15 34L18 24L10 18H20L24 8Z"
        stroke={SPARK}
        strokeWidth={1.2}
        fill="rgba(196,163,90,0.12)"
      />
    </Svg>
  );
}

/** Measure yes/no balance mark. */
export function MeasureBalance({ width = 40 }: { width?: number }) {
  const h = (width * 28) / 40;
  return (
    <Svg width={width} height={h} viewBox="0 0 40 28" accessibilityElementsHidden>
      <Path d="M20 4V24" stroke={SPARK} strokeWidth={1.4} />
      <Path d="M12 24H28" stroke={SPARK} strokeWidth={1.4} />
      <Path d="M8 8H32" stroke={SPARK} strokeWidth={1.4} />
      <Path
        d="M8 8L4 16H12L8 8Z"
        stroke={SPARK}
        strokeWidth={1.2}
        fill="rgba(196,163,90,0.15)"
      />
      <Path
        d="M32 8L28 16H36L32 8Z"
        stroke={SPARK}
        strokeWidth={1.2}
        fill="rgba(196,163,90,0.15)"
      />
    </Svg>
  );
}

/** Local decision dossier seal. */
export function DecisionSeal({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityElementsHidden>
      <Rect
        x={4}
        y={4}
        width={28}
        height={28}
        rx={2}
        stroke={SPARK}
        strokeOpacity={0.6}
        strokeWidth={1.2}
        fill="none"
      />
      <Path d="M10 12H26M10 18H22M10 24H18" stroke={QUIET} strokeWidth={1.2} />
      <Circle cx={26} cy={24} r={3} fill={SPARK} />
    </Svg>
  );
}
