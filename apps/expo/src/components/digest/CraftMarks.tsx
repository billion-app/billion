/**
 * Craft ornaments. Geometry: apps/expo/assets/digest/craft (CREDITS.md).
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

/** Original-text folio — folded document with source rules. */
export function FolioMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden>
      <Path
        d="M10 6H24L30 12V34H10V6Z"
        stroke={SPARK}
        strokeWidth={1.2}
        fill="none"
      />
      <Path d="M24 6V12H30" stroke={SPARK} strokeWidth={1.2} />
      <Path d="M14 18H26M14 23H26M14 28H22" stroke={QUIET} strokeWidth={1.1} />
    </Svg>
  );
}

/** Small civic seal for “the brief” masthead. */
export function BriefSeal({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityElementsHidden>
      <Circle
        cx={18}
        cy={18}
        r={16}
        stroke={SPARK}
        strokeOpacity={0.45}
        strokeWidth={1}
        fill="none"
      />
      <Circle cx={18} cy={18} r={11} stroke={SPARK} strokeWidth={1.1} fill="none" />
      <Path
        d="M18 10.5L19.8 16.2H25.8L21 19.7L22.8 25.5L18 22L13.2 25.5L15 19.7L10.2 16.2H16.2L18 10.5Z"
        fill="rgba(196,163,90,0.18)"
        stroke={SPARK}
        strokeWidth={0.9}
      />
    </Svg>
  );
}

/** Before → after delta tick for change cards. */
export function DeltaMark({ height = 22 }: { height?: number }) {
  const w = (height * 16) / 28;
  return (
    <Svg width={w} height={height} viewBox="0 0 16 28" accessibilityElementsHidden>
      <Path d="M8 2V18" stroke={SPARK} strokeWidth={1.4} />
      <Path d="M3.5 14.5L8 20L12.5 14.5" stroke={SPARK} strokeWidth={1.4} />
      <Path
        d="M2 24H14"
        stroke={SPARK}
        strokeOpacity={0.55}
        strokeWidth={1.2}
      />
    </Svg>
  );
}

/** Magnifier for search fields — diamond crosshair, not a stock SF symbol. */
export function SearchMark({
  size = 18,
  color = SPARK,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={1.4} fill="none" />
      <Path d="M15.2 15.2L20 20" stroke={color} strokeWidth={1.4} />
      <Path
        d="M10.5 7.5L10.5 13.5M7.5 10.5H13.5"
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1.1}
      />
    </Svg>
  );
}

/** Browse empty / no-match. */
export function EmptySearchMark({ width = 96 }: { width?: number }) {
  const h = (width * 64) / 96;
  return (
    <Svg width={width} height={h} viewBox="0 0 96 64" accessibilityElementsHidden>
      <Circle
        cx={40}
        cy={28}
        r={16}
        stroke={SPARK}
        strokeOpacity={0.85}
        strokeWidth={1.5}
        fill="none"
      />
      <Path d="M52 40L64 52" stroke={SPARK} strokeWidth={1.6} />
      <Path d="M32 28H48M40 20V36" stroke={QUIET} strokeWidth={1.2} />
      <Path d="M22 56H74" stroke={SPARK} strokeOpacity={0.4} strokeWidth={1} />
    </Svg>
  );
}

/** Address / location pin — diamond drop, not a stock SF symbol. */
export function PinMark({
  size = 18,
  color = SPARK,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 21C12 21 6.5 14.8 6.5 10.6C6.5 7.5 8.9 5 12 5C15.1 5 17.5 7.5 17.5 10.6C17.5 14.8 12 21 12 21Z"
        stroke={color}
        strokeWidth={1.4}
        fill="none"
      />
      <Circle cx={12} cy={10.5} r={2.2} stroke={color} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}
export function SettingsCrest({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden>
      <Circle
        cx={20}
        cy={20}
        r={18}
        stroke={SPARK}
        strokeOpacity={0.45}
        strokeWidth={1}
        fill="none"
      />
      <Circle
        cx={20}
        cy={15}
        r={5}
        stroke={SPARK}
        strokeWidth={1.2}
        fill="rgba(196,163,90,0.12)"
      />
      <Path
        d="M10 30C12.5 24.5 16 22 20 22C24 22 27.5 24.5 30 30"
        stroke={SPARK}
        strokeWidth={1.2}
      />
    </Svg>
  );
}
