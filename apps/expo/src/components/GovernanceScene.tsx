import { Pressable, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import type { GovernanceExample } from "~/utils/governance-map";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";

const BASE_WIDTH = 393;
const BLUE = P.primary;
const WHITE = P.inkOnNight;
const QUIET = P.quiet;
const FAINT = hair[2];

function Text({
  x,
  y,
  children,
  size = 13,
  fill = WHITE,
  bold = false,
  anchor = "middle",
  tracking = 0,
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  fill?: string;
  bold?: boolean;
  anchor?: "start" | "middle" | "end";
  tracking?: number;
}) {
  return (
    <SvgText
      x={x}
      y={y}
      fill={fill}
      fontSize={size}
      fontFamily={bold ? fontEditorial.bold : fontBody.regular}
      textAnchor={anchor}
      letterSpacing={tracking}
    >
      {children}
    </SvgText>
  );
}

function Track({
  d,
  muted = false,
  dashed = false,
  width = 3,
}: {
  d: string;
  muted?: boolean;
  dashed?: boolean;
  width?: number;
}) {
  return (
    <Path
      d={d}
      fill="none"
      stroke={muted ? QUIET : BLUE}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "4 7" : undefined}
      opacity={muted ? 0.65 : 0.92}
    />
  );
}

function Voters({ x, y }: { x: number; y: number }) {
  return (
    <G>
      {[0, 28, 56, 84].map((offset) => (
        <G key={offset}>
          <Circle
            cx={x + offset}
            cy={y}
            r={9}
            fill={planes.surface}
            stroke={WHITE}
            strokeWidth={1.4}
          />
          <Path
            d={`M ${x + offset - 13} ${y + 27} Q ${x + offset} ${y + 10} ${x + offset + 13} ${y + 27}`}
            fill="none"
            stroke={WHITE}
            strokeWidth={1.4}
          />
        </G>
      ))}
    </G>
  );
}

function BallotBox({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect
        x={x - 40}
        y={y - 5}
        width={80}
        height={56}
        rx={8}
        fill={planes.surface}
        stroke={BLUE}
        strokeWidth={2}
      />
      <Rect
        x={x - 45}
        y={y - 13}
        width={90}
        height={13}
        rx={3}
        fill={planes.hi}
        stroke={BLUE}
        strokeWidth={1.5}
      />
      <Line
        x1={x - 18}
        y1={y - 6}
        x2={x + 18}
        y2={y - 6}
        stroke={WHITE}
        strokeWidth={2}
      />
      <Rect
        x={x - 14}
        y={y - 34}
        width={28}
        height={26}
        rx={2}
        fill={planes.paper}
        transform={`rotate(-10 ${x} ${y - 21})`}
      />
      <Path
        d={`M ${x - 6} ${y - 22} l 5 5 l 10 -12`}
        fill="none"
        stroke={BLUE}
        strokeWidth={2.5}
      />
    </G>
  );
}

function Seal({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle
        cx={x}
        cy={y}
        r={45}
        fill={planes.slate}
        stroke={BLUE}
        strokeWidth={2.5}
      />
      <Circle
        cx={x}
        cy={y}
        r={36}
        fill="none"
        stroke={FAINT}
        strokeWidth={1.5}
      />
      <Path
        d={`M ${x - 17} ${y} l 11 11 l 24 -27`}
        fill="none"
        stroke={WHITE}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

function Gate({ x, y, open }: { x: number; y: number; open: boolean }) {
  return (
    <G>
      <Rect
        x={x - 47}
        y={y - 48}
        width={13}
        height={88}
        rx={3}
        fill={planes.hi}
        stroke={WHITE}
        strokeWidth={1.5}
      />
      <Rect
        x={x + 34}
        y={y - 48}
        width={13}
        height={88}
        rx={3}
        fill={planes.hi}
        stroke={WHITE}
        strokeWidth={1.5}
      />
      <Path
        d={
          open
            ? `M ${x - 36} ${y - 22} L ${x + 31} ${y - 49}`
            : `M ${x - 36} ${y - 22} L ${x + 36} ${y - 22}`
        }
        stroke={open ? BLUE : QUIET}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Path
        d={`M ${x - 55} ${y + 43} L ${x + 55} ${y + 43}`}
        stroke={FAINT}
        strokeWidth={2}
      />
      {open && (
        <Path
          d={`M ${x - 9} ${y + 22} l 18 0 m -8 -8 l 8 8 l -8 8`}
          stroke={BLUE}
          strokeWidth={2}
          fill="none"
        />
      )}
    </G>
  );
}

function Institution({
  x,
  y,
  width = 100,
  court = false,
}: {
  x: number;
  y: number;
  width?: number;
  court?: boolean;
}) {
  const half = width / 2;
  return (
    <G>
      <Polygon
        points={`${x - half},${y - 27} ${x},${y - 57} ${x + half},${y - 27}`}
        fill={planes.surface}
        stroke={court ? QUIET : BLUE}
        strokeWidth={2}
      />
      <Rect
        x={x - half}
        y={y - 27}
        width={width}
        height={12}
        fill={planes.hi}
        stroke={court ? QUIET : BLUE}
        strokeWidth={1.5}
      />
      {[-0.3, 0, 0.3].map((f) => (
        <Rect
          key={f}
          x={x + f * width - 5}
          y={y - 15}
          width={10}
          height={47}
          fill={planes.surface}
          stroke={WHITE}
          strokeWidth={1.3}
        />
      ))}
      <Rect
        x={x - half - 7}
        y={y + 31}
        width={width + 14}
        height={10}
        fill={planes.hi}
        stroke={court ? QUIET : BLUE}
        strokeWidth={1.5}
      />
    </G>
  );
}

function Program({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <G>
      <Circle
        cx={x}
        cy={y}
        r={32}
        fill={planes.slate}
        stroke={active ? BLUE : QUIET}
        strokeWidth={2}
      />
      {active ? (
        <G>
          <Circle
            cx={x}
            cy={y}
            r={17}
            fill="none"
            stroke={BLUE}
            strokeWidth={2}
          />
          <Text x={x} y={y + 7} size={24} fill={WHITE}>
            $
          </Text>
        </G>
      ) : (
        <Line
          x1={x - 14}
          y1={y}
          x2={x + 14}
          y2={y}
          stroke={QUIET}
          strokeWidth={3}
        />
      )}
    </G>
  );
}

function ArtBackdrop({ height }: { height: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={BASE_WIDTH} height={height} fill={P.canvas} />
      {[130, 320, 545, 800, 1080].map((y) => (
        <G key={y}>
          <Ellipse
            cx={196}
            cy={y}
            rx={185}
            ry={82}
            fill="none"
            stroke={FAINT}
            strokeWidth={1}
            opacity={0.65}
          />
          <Ellipse
            cx={196}
            cy={y}
            rx={136}
            ry={55}
            fill="none"
            stroke={FAINT}
            strokeWidth={1}
            opacity={0.45}
          />
        </G>
      ))}
      <Line
        x1={20}
        y1={0}
        x2={20}
        y2={height}
        stroke={FAINT}
        strokeWidth={1}
        opacity={0.5}
      />
      <Line
        x1={373}
        y1={0}
        x2={373}
        y2={height}
        stroke={FAINT}
        strokeWidth={1}
        opacity={0.5}
      />
    </G>
  );
}

function StageFocus({
  stage,
  spans,
}: {
  stage: number;
  spans: readonly number[];
}) {
  const top = spans[stage] ?? 0;
  const bottom = spans[stage + 1] ?? spans[spans.length - 1] ?? top;
  return (
    <G>
      <Rect
        x={20}
        y={top}
        width={353}
        height={bottom - top}
        fill={BLUE}
        opacity={0.045}
      />
      <Rect
        x={18}
        y={top + 12}
        width={3}
        height={bottom - top - 24}
        fill={BLUE}
        opacity={0.75}
      />
    </G>
  );
}

function PropositionArt({ activeStage }: { activeStage: number }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 393 1320">
      <ArtBackdrop height={1320} />
      <StageFocus stage={activeStage} spans={[0, 420, 765, 1320]} />
      <Text
        x={32}
        y={32}
        size={11}
        fill={QUIET}
        bold
        anchor="start"
        tracking={1.2}
      >
        01 · BALLOTS
      </Text>
      <Voters x={46} y={91} />
      <Track d="M 173 117 C 195 127 211 128 232 118" width={2} />
      <BallotBox x={274} y={100} />
      <Text x={196} y={186} size={14} bold>
        Ballots join a statewide count
      </Text>
      <Gate x={91} y={273} open={false} />
      <Track
        d="M 43 317 C 23 356 25 407 91 415 L 196 415"
        muted
        dashed
        width={2}
      />
      <Text x={96} y={339} size={10} fill={QUIET}>
        CAMPAIGN FUNDING
      </Text>
      <Text x={96} y={354} size={10} fill={QUIET}>
        BAN IN PLACE
      </Text>
      <Track d="M 274 154 C 274 225 196 208 196 268" />
      <Seal x={196} y={312} />
      <Text x={196} y={375} size={17} bold>
        Certified result
      </Text>
      <Text x={196} y={398} size={11} fill={QUIET}>
        The count decides which rule applies
      </Text>
      <Text
        x={32}
        y={443}
        size={11}
        fill={QUIET}
        bold
        anchor="start"
        tracking={1.2}
      >
        02 · CAMPAIGN FINANCING RULE
      </Text>
      <Track d="M 196 415 C 196 459 99 449 99 493" />
      <Track d="M 196 415 C 196 459 294 449 294 493" />
      <Circle cx={99} cy={489} r={22} fill={BLUE} />
      <Text x={99} y={494} size={12} bold>
        YES
      </Text>
      <Circle
        cx={294}
        cy={489}
        r={22}
        fill={planes.surface}
        stroke={QUIET}
        strokeWidth={1.5}
      />
      <Text x={294} y={494} size={12} bold>
        NO
      </Text>
      <Gate x={99} y={578} open />
      <Gate x={294} y={578} open={false} />
      <Text x={99} y={655} size={16} bold>
        Ban lifts
      </Text>
      <Text x={294} y={655} size={16} bold>
        Ban stays
      </Text>
      <Text x={99} y={677} size={11} fill={QUIET}>
        Programs become possible
      </Text>
      <Text x={294} y={677} size={11} fill={QUIET}>
        Existing rule remains
      </Text>
      <Track d="M 294 689 L 294 722" />
      <Circle cx={294} cy={728} r={5} fill={QUIET} />
      <Track d="M 99 689 C 99 758 196 742 196 801" />
      <Text
        x={360}
        y={771}
        size={11}
        fill={QUIET}
        bold
        anchor="end"
        tracking={1.2}
      >
        03 · IF YES PASSES
      </Text>
      <Institution x={196} y={877} width={106} />
      <Text x={196} y={943} size={16} bold>
        State & local officials
      </Text>
      <Text x={196} y={964} size={11} fill={QUIET}>
        A separate choice, made later
      </Text>
      <Track d="M 196 966 L 196 1009" />
      <Polygon
        points="196,1018 242,1065 196,1112 150,1065"
        fill={planes.surface}
        stroke={BLUE}
        strokeWidth={2.5}
      />
      <Text x={196} y={1061} size={12} bold>
        Create a
      </Text>
      <Text x={196} y={1078} size={12} bold>
        program?
      </Text>
      <Track d="M 153 1082 C 119 1109 103 1137 103 1170" />
      <Track d="M 239 1082 C 272 1109 290 1137 290 1170" />
      <Program x={103} y={1206} active />
      <Program x={290} y={1206} active={false} />
      <Text x={103} y={1266} size={13} bold>
        Could adopt
      </Text>
      <Text x={290} y={1266} size={13} bold>
        Could decline
      </Text>
      <Text x={196} y={1304} size={10} fill={QUIET}>
        Yes alone does not create or fund a program.
      </Text>
    </Svg>
  );
}

function Budget({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect
        x={x - 31}
        y={y - 37}
        width={62}
        height={75}
        rx={5}
        fill={planes.surface}
        stroke={BLUE}
        strokeWidth={2}
      />
      <Line
        x1={x - 19}
        y1={y - 19}
        x2={x + 19}
        y2={y - 19}
        stroke={WHITE}
        strokeWidth={2}
      />
      <Line
        x1={x - 19}
        y1={y - 3}
        x2={x + 12}
        y2={y - 3}
        stroke={WHITE}
        strokeWidth={2}
      />
      <Line
        x1={x - 19}
        y1={y + 13}
        x2={x + 19}
        y2={y + 13}
        stroke={WHITE}
        strokeWidth={2}
      />
    </G>
  );
}

function Bill({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect
        x={x - 32}
        y={y - 34}
        width={64}
        height={71}
        rx={5}
        fill={planes.surface}
        stroke={BLUE}
        strokeWidth={2}
      />
      <Path
        d={`M ${x - 19} ${y - 12} L ${x + 19} ${y - 12} M ${x - 19} ${y + 2} L ${x + 19} ${y + 2}`}
        stroke={WHITE}
        strokeWidth={2}
      />
      <Path
        d={`M ${x - 11} ${y + 17} l 9 8 l 17 -19`}
        fill="none"
        stroke={WHITE}
        strokeWidth={2.5}
      />
    </G>
  );
}

function Appointment({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle
        cx={x}
        cy={y - 17}
        r={15}
        fill={planes.surface}
        stroke={BLUE}
        strokeWidth={2}
      />
      <Path
        d={`M ${x - 32} ${y + 34} Q ${x - 29} ${y + 4} ${x} ${y + 4} Q ${x + 29} ${y + 4} ${x + 32} ${y + 34}`}
        fill={planes.surface}
        stroke={BLUE}
        strokeWidth={2}
      />
      <Circle
        cx={x + 25}
        cy={y - 15}
        r={12}
        fill={planes.hi}
        stroke={WHITE}
        strokeWidth={1.5}
      />
      <Text x={x + 25} y={y - 11} size={13} bold>
        +
      </Text>
    </G>
  );
}

function GovernorArt({ activeStage }: { activeStage: number }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 393 1450">
      <ArtBackdrop height={1450} />
      <StageFocus stage={activeStage} spans={[0, 410, 900, 1450]} />
      <Text
        x={32}
        y={32}
        size={11}
        fill={QUIET}
        bold
        anchor="start"
        tracking={1.2}
      >
        01 · ELECTION
      </Text>
      <Voters x={46} y={88} />
      <Track d="M 173 114 C 195 124 211 125 232 115" width={2} />
      <BallotBox x={274} y={97} />
      <Text x={196} y={182} size={14} bold>
        Ballots join a statewide count
      </Text>
      <Track d="M 274 150 C 274 220 196 206 196 253" />
      <Seal x={196} y={299} />
      <Text x={196} y={365} size={17} bold>
        Certified result
      </Text>
      <Text x={196} y={386} size={11} fill={QUIET}>
        Determines the next officeholder
      </Text>
      <Track d="M 196 399 L 196 450" />
      <Institution x={196} y={525} width={116} />
      <Text x={196} y={593} size={19} bold>
        Governor
      </Text>
      <Text x={196} y={617} size={11} fill={QUIET}>
        New term begins Jan 4, 2027
      </Text>
      <Text
        x={32}
        y={663}
        size={11}
        fill={QUIET}
        bold
        anchor="start"
        tracking={1.2}
      >
        02 · POWERS
      </Text>
      <Track d="M 173 631 C 173 678 88 674 88 707" />
      <Track d="M 218 631 C 218 678 305 674 305 707" />
      <Track d="M 196 632 L 196 877" />
      <Budget x={88} y={759} />
      <Bill x={305} y={759} />
      <Text x={88} y={820} size={14} bold>
        Budget proposal
      </Text>
      <Text x={305} y={820} size={14} bold>
        Sign or veto
      </Text>
      <Appointment x={196} y={922} />
      <Text x={196} y={987} size={14} bold>
        Appointments
      </Text>
      <Text
        x={216}
        y={1043}
        size={11}
        fill={QUIET}
        bold
        anchor="start"
        tracking={1.2}
      >
        03 · CHECKS
      </Text>
      <Track d="M 88 830 C 88 925 70 977 70 1080" />
      <Track d="M 305 830 C 305 925 323 977 323 1080" />
      <Track d="M 196 996 L 196 1188" />
      <Rect x={30} y={1058} width={80} height={20} fill={P.canvas} />
      <Text x={70} y={1073} size={10} fill={QUIET}>
        BUDGET
      </Text>
      <Rect x={283} y={1058} width={80} height={20} fill={P.canvas} />
      <Text x={323} y={1073} size={10} fill={QUIET}>
        VETO
      </Text>
      <Rect x={146} y={1168} width={100} height={20} fill={P.canvas} />
      <Text x={196} y={1183} size={10} fill={QUIET}>
        APPOINTMENTS
      </Text>
      <Institution x={70} y={1148} width={76} />
      <Institution x={323} y={1148} width={76} />
      <Institution x={196} y={1256} width={92} />
      <Text x={70} y={1204} size={11} bold>
        Legislature
      </Text>
      <Text x={70} y={1221} size={10} fill={QUIET}>
        approves spending
      </Text>
      <Text x={323} y={1204} size={11} bold>
        Legislature
      </Text>
      <Text x={323} y={1221} size={10} fill={QUIET}>
        can override veto
      </Text>
      <Text x={196} y={1313} size={12} bold>
        Senate
      </Text>
      <Text x={196} y={1331} size={10} fill={QUIET}>
        confirms some picks
      </Text>
      <Track
        d="M 258 520 C 367 548 368 700 368 920 L 368 1250 C 368 1320 306 1330 306 1360"
        muted
        dashed
        width={2}
      />
      <Circle
        cx={306}
        cy={1383}
        r={20}
        fill={planes.surface}
        stroke={QUIET}
        strokeWidth={1.5}
      />
      <Text x={306} y={1390} size={20} fill={WHITE}>
        §
      </Text>
      <Text x={258} y={1421} size={10} fill={QUIET}>
        If challenged: courts review
      </Text>
    </Svg>
  );
}

const PROP_HOTSPOTS = [
  { id: "vote", x: 33, y: 50, w: 314, h: 140 },
  { id: "result", x: 138, y: 267, w: 116, h: 146 },
  { id: "current", x: 42, y: 224, w: 108, h: 131 },
  { id: "yes", x: 48, y: 466, w: 104, h: 231 },
  { id: "no", x: 244, y: 466, w: 104, h: 231 },
  { id: "next", x: 134, y: 808, w: 125, h: 307 },
  { id: "adopt", x: 55, y: 1170, w: 96, h: 110 },
  { id: "decline", x: 242, y: 1170, w: 96, h: 110 },
] as const;
const GOVERNOR_HOTSPOTS = [
  { id: "vote", x: 33, y: 50, w: 314, h: 140 },
  { id: "result", x: 138, y: 250, w: 116, h: 150 },
  { id: "office", x: 125, y: 462, w: 142, h: 164 },
  { id: "budget", x: 38, y: 710, w: 103, h: 125 },
  { id: "law", x: 251, y: 710, w: 103, h: 125 },
  { id: "appointments", x: 141, y: 881, w: 110, h: 123 },
  { id: "legislature", x: 22, y: 1090, w: 113, h: 142 },
  { id: "legislature", x: 266, y: 1090, w: 113, h: 142 },
  { id: "confirmation", x: 141, y: 1196, w: 110, h: 149 },
  { id: "courts", x: 225, y: 1350, w: 150, h: 95 },
] as const;

export function GovernanceScene({
  example,
  width,
  activeStage,
  onSelect,
  accessibilityLabels,
}: {
  example: GovernanceExample;
  width: number;
  activeStage: number;
  onSelect: (id: string) => void;
  accessibilityLabels: Record<string, string>;
}) {
  const scale = width / BASE_WIDTH;
  const height = (example === "governor" ? 1450 : 1320) * scale;
  const hotspots = example === "governor" ? GOVERNOR_HOTSPOTS : PROP_HOTSPOTS;
  return (
    <View style={[s.scene, { width, height }]}>
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {example === "governor" ? (
          <GovernorArt activeStage={activeStage} />
        ) : (
          <PropositionArt activeStage={activeStage} />
        )}
      </View>
      {hotspots.map((hotspot) => (
        <Pressable
          key={`${hotspot.id}-${hotspot.x}`}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabels[hotspot.id] ?? hotspot.id}. Open source and explanation`}
          onPress={() => onSelect(hotspot.id)}
          style={{
            position: "absolute",
            left: hotspot.x * scale,
            top: hotspot.y * scale,
            width: hotspot.w * scale,
            height: hotspot.h * scale,
          }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({ scene: { backgroundColor: P.canvas } });
