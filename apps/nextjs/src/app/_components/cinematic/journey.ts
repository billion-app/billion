import type { Vec3 } from "./math";
import { clamp, lerp, lerp3, pickKeyframes, smootherstep, windowOpacity } from "./math";

export const CHAPTER_IDS = [
  "hero",
  "complicated",
  "bill",
  "personal",
  "download",
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

export const CHAPTER_VH: Record<ChapterId, number> = {
  hero: 140,
  complicated: 150,
  bill: 160,
  personal: 160,
  download: 120,
};

export function totalJourneyVh() {
  return Object.values(CHAPTER_VH).reduce((sum, vh) => sum + vh, 0);
}

function chapterSpans(): Record<ChapterId, { start: number; end: number }> {
  const total = totalJourneyVh();
  let cursor = 0;
  const spans = {} as Record<ChapterId, { start: number; end: number }>;
  for (const id of CHAPTER_IDS) {
    const start = cursor;
    cursor += CHAPTER_VH[id] / total;
    spans[id] = { start, end: cursor };
  }
  spans.download.end = 1;
  return spans;
}

export const CHAPTER_SPANS: Record<ChapterId, { start: number; end: number }> =
  chapterSpans();

export const APP_SCREENS = [
  "feed",
  "bill",
  "detail",
  "election",
  "court",
  "search",
] as const;

export type AppScreenId = (typeof APP_SCREENS)[number];

export const BILL_NODES = [
  {
    id: "introduced",
    date: "Jun 9, 2023",
    label: "Introduced",
    note: "In the House",
  },
  {
    id: "committee",
    date: "Jun 13, 2023",
    label: "Referred",
    note: "Transportation and Infrastructure",
  },
  {
    id: "vote",
    date: "Jul 20, 2023",
    label: "Passed House",
    note: "377–31",
  },
  {
    id: "signed",
    date: "May 16, 2024",
    label: "Became law",
    note: "Public Law 118–63",
  },
] as const;

export const ORBIT_LABELS = [
  "FEDERAL",
  "CALIFORNIA",
  "ELECTIONS",
  "COURTS",
  "TECHNOLOGY",
] as const;

export const PERSONAL_TOPICS = [
  { id: "technology", label: "Technology" },
  { id: "defense", label: "Defense" },
  { id: "economy", label: "Economy" },
  { id: "energy", label: "Energy" },
  { id: "healthcare", label: "Healthcare" },
] as const;

export type PersonalTopicId = (typeof PERSONAL_TOPICS)[number]["id"];

export const COMPLICATED_BEATS = [
  {
    id: "track",
    word: "Track",
    line: "Bills. Elections. Courts. Executive actions.",
  },
  {
    id: "understand",
    word: "Understand",
    line: "Clear summaries. Real sources. No political theater.",
  },
  {
    id: "ahead",
    word: "Stay ahead",
    line: "Know what's changing before it reaches your life.",
  },
] as const;

export const EDITORIAL_PHONES = [
  {
    id: "happened",
    kicker: "What happened",
    title: "H.R. 3935 cleared the House.",
    dek: "Aviation, labor, and airport funding now share one legislative path.",
  },
  {
    id: "matters",
    kicker: "Why it matters",
    title: "The rule reaches the gate, not just the agency.",
    dek: "If you fly, build, or insure, the implementation memo is the actual product.",
  },
  {
    id: "next",
    kicker: "What's next",
    title: "Senate referral this week.",
    dek: "Watch committee jurisdiction. That's where the bill gets rewritten.",
  },
] as const;

export const FLOATING_META = [
  "H.R. 3935",
  "S. 2",
  "CA SB 492",
  "EO 14110",
  "SCOTUS",
] as const;

export type LayoutName =
  | "quiet"
  | "sphere"
  | "orbit"
  | "path"
  | "threads"
  | "dust"
  | "capitol";

interface CameraKey {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
}

/** The camera barely moves. The phone is the spectacle, not a fly-through. */
const CAMERA_KEYS: readonly CameraKey[] = [
  { t: 0, pos: [0, 0.12, 8.2], look: [0, 0, 0], fov: 32 },
  { t: 0.18, pos: [0.35, 0.08, 8.5], look: [-0.2, 0, 0], fov: 34 },
  { t: 0.4, pos: [0, 0.16, 7.9], look: [0, 0.05, 0], fov: 30 },
  { t: 0.58, pos: [-0.25, 0.1, 8.1], look: [0.35, 0, 0], fov: 32 },
  { t: 0.84, pos: [0.12, 0.06, 8.6], look: [0, 0, 0], fov: 34 },
  { t: 1, pos: [0, 0.02, 8.3], look: [0, 0, 0], fov: 32 },
];

export interface CameraState {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
}

export function cameraAt(progress: number): CameraState {
  const { from, to, local } = pickKeyframes(CAMERA_KEYS, progress);
  return {
    position: lerp3(from.pos, to.pos, local),
    lookAt: lerp3(from.look, to.look, local),
    fov: lerp(from.fov, to.fov, local),
  };
}

interface LayoutKey {
  t: number;
  layout: LayoutName;
}

const LAYOUT_KEYS: readonly LayoutKey[] = [
  { t: 0, layout: "quiet" },
  { t: 0.12, layout: "quiet" },
  { t: 0.18, layout: "sphere" },
  { t: 0.34, layout: "sphere" },
  { t: 0.42, layout: "capitol" },
  { t: 0.58, layout: "capitol" },
  { t: 0.66, layout: "threads" },
  { t: 0.82, layout: "threads" },
  { t: 0.88, layout: "dust" },
  { t: 1, layout: "dust" },
];

export function layoutMix(progress: number): {
  from: LayoutName;
  to: LayoutName;
  t: number;
} {
  const { from, to, local } = pickKeyframes(LAYOUT_KEYS, progress);
  return { from: from.layout, to: to.layout, t: local };
}

export function chapterAt(progress: number): ChapterId {
  for (const id of CHAPTER_IDS) {
    const span = CHAPTER_SPANS[id];
    if (progress >= span.start && progress < span.end) return id;
  }
  return "download";
}

const complicated = CHAPTER_SPANS.complicated;
const complicatedThird =
  (complicated.end - complicated.start) / COMPLICATED_BEATS.length;

export const COPY_BEATS = {
  hero: (p: number) =>
    windowOpacity(
      p,
      -0.01,
      0,
      CHAPTER_SPANS.hero.end - 0.04,
      CHAPTER_SPANS.hero.end + 0.015,
    ),
  complicatedHead: (p: number) =>
    windowOpacity(
      p,
      complicated.start - 0.01,
      complicated.start + 0.02,
      complicated.end - 0.03,
      complicated.end + 0.01,
    ),
  track: (p: number) =>
    windowOpacity(
      p,
      complicated.start,
      complicated.start + 0.015,
      complicated.start + complicatedThird - 0.01,
      complicated.start + complicatedThird + 0.012,
    ),
  understand: (p: number) =>
    windowOpacity(
      p,
      complicated.start + complicatedThird - 0.008,
      complicated.start + complicatedThird + 0.01,
      complicated.start + complicatedThird * 2 - 0.01,
      complicated.start + complicatedThird * 2 + 0.012,
    ),
  ahead: (p: number) =>
    windowOpacity(
      p,
      complicated.start + complicatedThird * 2 - 0.008,
      complicated.start + complicatedThird * 2 + 0.01,
      complicated.end - 0.015,
      complicated.end + 0.01,
    ),
  bill: (p: number) =>
    windowOpacity(
      p,
      CHAPTER_SPANS.bill.start - 0.01,
      CHAPTER_SPANS.bill.start + 0.02,
      CHAPTER_SPANS.bill.end - 0.03,
      CHAPTER_SPANS.bill.end + 0.01,
    ),
  personal: (p: number) =>
    windowOpacity(
      p,
      CHAPTER_SPANS.personal.start - 0.01,
      CHAPTER_SPANS.personal.start + 0.025,
      CHAPTER_SPANS.personal.end - 0.03,
      CHAPTER_SPANS.personal.end + 0.01,
    ),
  download: (p: number) =>
    windowOpacity(
      p,
      CHAPTER_SPANS.download.start - 0.01,
      CHAPTER_SPANS.download.start + 0.025,
      1,
      1.05,
    ),
} as const;

export interface PhonePose {
  xPct: number;
  yPct: number;
  scale: number;
  rotateY: number;
  rotateX: number;
  opacity: number;
}

interface PhoneKey {
  t: number;
  xPct: number;
  yPct: number;
  scale: number;
  rotateY: number;
  rotateX: number;
  opacity: number;
}

const PHONE_KEYS: readonly PhoneKey[] = [
  {
    t: 0,
    xPct: 50,
    yPct: 90,
    scale: 1.62,
    rotateY: 0,
    rotateX: 0,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.hero.end - 0.02,
    xPct: 50,
    yPct: 90,
    scale: 1.64,
    rotateY: 2,
    rotateX: 1,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.complicated.start + 0.02,
    xPct: 74,
    yPct: 52,
    scale: 0.86,
    rotateY: 18,
    rotateX: 6,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.bill.start - 0.02,
    xPct: 74,
    yPct: 52,
    scale: 0.86,
    rotateY: 20,
    rotateX: 5,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.bill.start + 0.03,
    xPct: 72,
    yPct: 58,
    scale: 1.16,
    rotateY: 14,
    rotateX: 6,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.personal.start - 0.02,
    xPct: 72,
    yPct: 58,
    scale: 1.16,
    rotateY: 16,
    rotateX: 5,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.personal.start + 0.03,
    xPct: 72,
    yPct: 56,
    scale: 1.12,
    rotateY: 13,
    rotateX: 5,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.download.start - 0.02,
    xPct: 74,
    yPct: 54,
    scale: 1.08,
    rotateY: 12,
    rotateX: 6,
    opacity: 1,
  },
  {
    t: 1,
    xPct: 74,
    yPct: 54,
    scale: 1.1,
    rotateY: 14,
    rotateX: 5,
    opacity: 1,
  },
];

const PHONE_KEYS_COMPACT: readonly PhoneKey[] = [
  {
    t: 0,
    xPct: 50,
    yPct: 88,
    scale: 1.32,
    rotateY: 0,
    rotateX: 0,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.hero.end - 0.02,
    xPct: 50,
    yPct: 88,
    scale: 1.34,
    rotateY: 2,
    rotateX: 2,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.complicated.start + 0.02,
    xPct: 50,
    yPct: 72,
    scale: 0.72,
    rotateY: 12,
    rotateX: 6,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.bill.start + 0.03,
    xPct: 50,
    yPct: 76,
    scale: 1.06,
    rotateY: 10,
    rotateX: 5,
    opacity: 1,
  },
  {
    t: CHAPTER_SPANS.personal.start + 0.03,
    xPct: 50,
    yPct: 76,
    scale: 1.04,
    rotateY: 9,
    rotateX: 5,
    opacity: 1,
  },
  {
    t: 1,
    xPct: 50,
    yPct: 78,
    scale: 0.92,
    rotateY: 8,
    rotateX: 6,
    opacity: 1,
  },
];

export function phonePose(progress: number, width: number): PhonePose {
  const keys = width < 760 ? PHONE_KEYS_COMPACT : PHONE_KEYS;
  const { from, to, local } = pickKeyframes(keys, progress);
  return {
    xPct: lerp(from.xPct, to.xPct, local),
    yPct: lerp(from.yPct, to.yPct, local),
    scale: lerp(from.scale, to.scale, local),
    rotateY: lerp(from.rotateY, to.rotateY, local),
    rotateX: lerp(from.rotateX, to.rotateX, local),
    opacity: lerp(from.opacity, to.opacity, local),
  };
}

export interface PhoneFootprint {
  xPct: number;
  yPct: number;
  halfWPct: number;
  halfHPct: number;
  opacity: number;
}

/** Screen-space box of the phone, padded so field marks stay in the gutters. */
export function phoneFootprint(
  progress: number,
  width: number,
  height: number,
): PhoneFootprint {
  const pose = phonePose(progress, width);
  const compact = width < 760;
  const hero = Math.abs(pose.rotateY) < 3 && Math.abs(pose.rotateX) < 3;
  const baseW = compact ? 280 : hero ? 372 : 340;
  const baseH = compact ? 574 : hero ? 764 : 700;
  const pad = 1.12;
  return {
    xPct: pose.xPct,
    yPct: pose.yPct,
    halfWPct: ((baseW * pose.scale * pad) / 2 / Math.max(1, width)) * 100,
    halfHPct: ((baseH * pose.scale * pad) / 2 / Math.max(1, height)) * 100,
    opacity: pose.opacity,
  };
}

export function keepOffPhone(
  xPct: number,
  yPct: number,
  foot: PhoneFootprint,
): { xPct: number; yPct: number; hidden: boolean } {
  if (foot.opacity < 0.08) return { xPct, yPct, hidden: false };
  const inX = Math.abs(xPct - foot.xPct) < foot.halfWPct;
  const inY = Math.abs(yPct - foot.yPct) < foot.halfHPct;
  if (!inX || !inY) return { xPct, yPct, hidden: false };
  const dir = xPct < foot.xPct ? -1 : 1;
  const x = foot.xPct + dir * foot.halfWPct * 1.22;
  if (x < 5 || x > 95) return { xPct: x, yPct, hidden: true };
  return { xPct: x, yPct, hidden: false };
}

export function pixelOnPhone(
  x: number,
  y: number,
  width: number,
  height: number,
  foot: PhoneFootprint,
) {
  if (foot.opacity < 0.08) return false;
  const cx = (foot.xPct / 100) * width;
  const cy = (foot.yPct / 100) * height;
  const hw = (foot.halfWPct / 100) * width;
  const hh = (foot.halfHPct / 100) * height;
  return Math.abs(x - cx) < hw && Math.abs(y - cy) < hh;
}

export function heroTilt(progress: number) {
  const t = clamp(progress / CHAPTER_SPANS.hero.end);
  return lerp(-5, 8, t);
}

export function beatIndexAt(
  progress: number,
  span: { start: number; end: number },
  count: number,
): number {
  const local = clamp((progress - span.start) / (span.end - span.start));
  return Math.min(count - 1, Math.max(0, Math.floor(local * count)));
}

export function appScreenAt(progress: number): AppScreenId {
  if (progress < CHAPTER_SPANS.bill.start) return "feed";
  if (progress < CHAPTER_SPANS.bill.end) return "bill";
  return "feed";
}

export interface BillJourney {
  t: number;
  xPct: number;
  yPct: number;
  scale: number;
  opacity: number;
  node: number;
  returning: boolean;
}

const BILL_PATH: readonly { t: number; xPct: number; yPct: number }[] = [
  { t: 0, xPct: 36, yPct: 50 },
  { t: 0.12, xPct: 36, yPct: 50 },
  { t: 0.28, xPct: 58, yPct: 28 },
  { t: 0.46, xPct: 78, yPct: 42 },
  { t: 0.64, xPct: 74, yPct: 64 },
  { t: 0.78, xPct: 52, yPct: 72 },
  { t: 1, xPct: 36, yPct: 50 },
];

export function billJourneyAt(progress: number): BillJourney {
  const span = CHAPTER_SPANS.bill;
  const local = clamp((progress - span.start) / (span.end - span.start));
  const { from, to, local: u } = pickKeyframes(BILL_PATH, local);
  const node = Math.min(
    BILL_NODES.length - 1,
    Math.max(0, Math.floor((local - 0.12) / 0.16)),
  );
  const leaving = local > 0.1 && local < 0.9;
  const returning = local > 0.78;
  return {
    t: local,
    xPct: lerp(from.xPct, to.xPct, u),
    yPct: lerp(from.yPct, to.yPct, u),
    scale: leaving ? lerp(0.6, 1.15, Math.min(1, (local - 0.1) / 0.18)) : 0.35,
    opacity: windowOpacity(local, 0.04, 0.1, 0.9, 0.995),
    node,
    returning,
  };
}

export function prismMorph(progress: number) {
  const morph = smootherstep(
    CHAPTER_SPANS.complicated.start,
    CHAPTER_SPANS.bill.end - 0.04,
    progress,
  );
  const dissolve = smootherstep(
    CHAPTER_SPANS.personal.start,
    CHAPTER_SPANS.personal.start + 0.1,
    progress,
  );
  const spin = 1 - morph;
  const scale = lerp(1.72, 0.92, morph) * (1 - dissolve * 0.08);
  const prismOpacity = 0.06 * (1 - morph) * (1 - morph) * (1 - dissolve);
  const buildingOpacity = morph * 0.82 * (1 - dissolve * 0.35);
  const fillOpacity = morph * (1 - dissolve);
  return { morph, spin, scale, prismOpacity, buildingOpacity, fillOpacity };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

export function projectPoint(
  point: Vec3,
  camera: CameraState,
  width: number,
  height: number,
) {
  const forward = normalize([
    camera.lookAt[0] - camera.position[0],
    camera.lookAt[1] - camera.position[1],
    camera.lookAt[2] - camera.position[2],
  ]);
  let right = cross(forward, [0, 1, 0]);
  if (Math.hypot(right[0], right[1], right[2]) < 0.0001) {
    right = [1, 0, 0];
  } else {
    right = normalize(right);
  }
  const up = normalize(cross(right, forward));
  const dx = point[0] - camera.position[0];
  const dy = point[1] - camera.position[1];
  const dz = point[2] - camera.position[2];
  const depth = dx * forward[0] + dy * forward[1] + dz * forward[2];
  const sx = dx * right[0] + dy * right[1] + dz * right[2];
  const sy = dx * up[0] + dy * up[1] + dz * up[2];
  const fovRad = (camera.fov * Math.PI) / 180;
  const scale = 1 / Math.tan(fovRad / 2);
  const aspect = width / Math.max(1, height);
  const ndcX = (sx * scale) / Math.max(0.12, depth);
  const ndcY = (sy * scale) / Math.max(0.12, depth);
  return {
    x: width * 0.5 + ndcX * (height * 0.5) * aspect,
    y: height * 0.5 - ndcY * (height * 0.5),
    depth,
    visible: depth > 0.35,
  };
}
