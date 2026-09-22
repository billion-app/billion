import type { LayoutName } from "./journey";
import type { Vec3 } from "./math";
import { BILL_NODES, PERSONAL_TOPICS } from "./journey";
import { mulberry32 } from "./math";

export interface Particle {
  index: number;
  u: number;
  v: number;
  w: number;
  importance: number;
  topic: number;
  node: number;
}

export const LAYOUT_NAMES: readonly LayoutName[] = [
  "quiet",
  "sphere",
  "orbit",
  "path",
  "threads",
  "dust",
  "capitol",
];

export function createParticles(count: number, seed = 20260911): Particle[] {
  const rng = mulberry32(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const u = rng();
    const importance = u > 0.92 ? 0.85 : u > 0.72 ? 0.4 : rng() * 0.18;
    particles.push({
      index: i,
      u,
      v: rng(),
      w: rng(),
      importance,
      topic: i % PERSONAL_TOPICS.length,
      node: i % BILL_NODES.length,
    });
  }
  return particles;
}

function quietPos(p: Particle): Vec3 {
  const theta = p.v * Math.PI * 2;
  const phi = Math.acos(2 * p.w - 1);
  const radius = 4.8 + p.u * 3.2;
  return [
    radius * Math.sin(phi) * Math.cos(theta) * 1.15,
    radius * Math.sin(phi) * Math.sin(theta) * 0.42,
    radius * Math.cos(phi) * 0.7,
  ];
}

function spherePos(p: Particle): Vec3 {
  const theta = p.v * Math.PI * 2;
  const phi = Math.acos(2 * p.w - 1);
  const radius = 2.55 + p.importance * 0.2;
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  ];
}

function orbitPos(p: Particle): Vec3 {
  const angle = p.v * Math.PI * 2;
  const radius = 4.15 + p.u * 1.05;
  return [
    Math.cos(angle) * radius,
    (p.w - 0.5) * 1.55,
    Math.sin(angle) * radius * 0.72,
  ];
}

function pathPos(p: Particle): Vec3 {
  const along = p.node / Math.max(1, BILL_NODES.length - 1);
  return [
    -0.6 + along * 4.8 + (p.u - 0.5) * 0.35,
    0.8 - along * 1.6 + (p.v - 0.5) * 0.25,
    (p.w - 0.5) * 0.4,
  ];
}

function threadsPos(p: Particle): Vec3 {
  const count = PERSONAL_TOPICS.length;
  const angle = (p.topic / count) * Math.PI * 1.15 - 0.9;
  const arm = 0.4 + p.u * 3.4;
  return [
    Math.sin(angle) * arm,
    1.6 - p.u * 2.8 + (p.v - 0.5) * 0.2,
    Math.cos(angle) * arm * 0.35,
  ];
}

function dustPos(p: Particle): Vec3 {
  return [
    (p.u - 0.5) * 7.4,
    (p.v - 0.5) * 4.6,
    (p.w - 0.5) * 3.2,
  ];
}

function pushSeg(
  out: number[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  out.push(ax, ay, az, bx, by, bz);
}

function box(
  out: number[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
) {
  pushSeg(out, x0, y0, z0, x1, y0, z0);
  pushSeg(out, x1, y0, z0, x1, y0, z1);
  pushSeg(out, x1, y0, z1, x0, y0, z1);
  pushSeg(out, x0, y0, z1, x0, y0, z0);
  pushSeg(out, x0, y1, z0, x1, y1, z0);
  pushSeg(out, x1, y1, z0, x1, y1, z1);
  pushSeg(out, x1, y1, z1, x0, y1, z1);
  pushSeg(out, x0, y1, z1, x0, y1, z0);
  pushSeg(out, x0, y0, z0, x0, y1, z0);
  pushSeg(out, x1, y0, z0, x1, y1, z0);
  pushSeg(out, x1, y0, z1, x1, y1, z1);
  pushSeg(out, x0, y0, z1, x0, y1, z1);
}

function faceZ(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
) {
  pushSeg(out, x0, y0, z, x1, y0, z);
  pushSeg(out, x1, y0, z, x1, y1, z);
  pushSeg(out, x1, y1, z, x0, y1, z);
  pushSeg(out, x0, y1, z, x0, y0, z);
}

function ring(
  out: number[],
  y: number,
  radius: number,
  zOff: number,
  segs: number,
) {
  let px = radius;
  let pz = zOff;
  for (let i = 1; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    const x = Math.cos(t) * radius;
    const z = zOff + Math.sin(t) * radius;
    pushSeg(out, px, y, pz, x, y, z);
    px = x;
    pz = z;
  }
}

function windows(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  cols: number,
  rows: number,
) {
  const spanX = x1 - x0;
  const spanY = y1 - y0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx0 = x0 + ((col + 0.16) / cols) * spanX;
      const wx1 = x0 + ((col + 0.84) / cols) * spanX;
      const wy0 = y0 + ((row + 0.16) / rows) * spanY;
      const wy1 = y0 + ((row + 0.84) / rows) * spanY;
      faceZ(out, wx0, wy0, wx1, wy1, z);
      pushSeg(out, (wx0 + wx1) / 2, wy0, z, (wx0 + wx1) / 2, wy1, z);
    }
  }
}

function column(
  out: number[],
  x: number,
  y0: number,
  y1: number,
  z: number,
  r = 0.03,
) {
  pushSeg(out, x, y0, z, x, y1, z);
  pushSeg(out, x - r, y0, z, x + r, y0, z);
  pushSeg(out, x - r * 1.15, y0 + 0.035, z, x + r * 1.15, y0 + 0.035, z);
  pushSeg(out, x - r, y0, z, x - r, y0 + 0.035, z);
  pushSeg(out, x + r, y0, z, x + r, y0 + 0.035, z);
  pushSeg(out, x - r * 1.2, y1, z, x + r * 1.2, y1, z);
  pushSeg(out, x - r, y1 - 0.03, z, x + r, y1 - 0.03, z);
}

function arch(
  out: number[],
  x0: number,
  x1: number,
  y0: number,
  peak: number,
  z: number,
) {
  const spring = y0 + (peak - y0) * 0.42;
  pushSeg(out, x0, y0, z, x0, spring);
  pushSeg(out, x1, y0, z, x1, spring);
  let px = x0;
  let py = spring;
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    const x = x0 + (x1 - x0) * t;
    const y = spring + Math.sin(t * Math.PI) * (peak - spring);
    pushSeg(out, px, py, z, x, y, z);
    px = x;
    py = y;
  }
}

function dentil(
  out: number[],
  x0: number,
  x1: number,
  y: number,
  z: number,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const t0 = i / count;
    const t1 = (i + 0.55) / count;
    const ax = x0 + (x1 - x0) * t0;
    const bx = x0 + (x1 - x0) * t1;
    pushSeg(out, ax, y, z, bx, y, z);
    pushSeg(out, ax, y, z, ax, y + 0.025, z);
    pushSeg(out, bx, y, z, bx, y + 0.025, z);
    pushSeg(out, ax, y + 0.025, z, bx, y + 0.025, z);
  }
}

/** US Capitol as a gold line drawing: wings, colonnade, drum, dome. */
export function createCapitolLines() {
  const p: number[] = [];
  const wingY0 = -0.78;
  const wingY1 = 0.04;
  const centerY1 = 0.18;
  const wingZ0 = -0.4;
  const wingZ1 = 0.34;
  const centerZ0 = -0.36;
  const centerZ1 = 0.42;

  box(p, -2.48, wingY0, wingZ0, -0.86, wingY1, wingZ1);
  box(p, 0.86, wingY0, wingZ0, 2.48, wingY1, wingZ1);
  box(p, -0.86, wingY0, centerZ0, 0.86, centerY1, centerZ1);

  box(p, -2.48, wingY1, wingZ0, -2.18, 0.22, wingZ1);
  box(p, 2.18, wingY1, wingZ0, 2.48, 0.22, wingZ1);
  pushSeg(p, -2.48, 0.22, wingZ1, -2.18, 0.34, wingZ1);
  pushSeg(p, -2.18, 0.22, wingZ1, -2.18, 0.34, wingZ1);
  pushSeg(p, 2.18, 0.22, wingZ1, 2.48, 0.34, wingZ1);
  pushSeg(p, 2.18, 0.22, wingZ1, 2.18, 0.34, wingZ1);
  pushSeg(p, -2.48, 0.22, wingZ1, -2.18, 0.22, wingZ1);
  pushSeg(p, 2.18, 0.22, wingZ1, 2.48, 0.22, wingZ1);

  windows(p, -2.36, wingY0 + 0.08, -0.96, wingY1 - 0.06, wingZ1, 8, 4);
  windows(p, 0.96, wingY0 + 0.08, 2.36, wingY1 - 0.06, wingZ1, 8, 4);
  windows(p, -0.72, wingY0 + 0.1, 0.72, 0.08, centerZ1, 5, 3);

  dentil(p, -2.4, -0.9, wingY1, wingZ1, 18);
  dentil(p, 0.9, 2.4, wingY1, wingZ1, 18);
  dentil(p, -0.8, 0.8, centerY1, centerZ1, 12);

  const stepY = [-0.94, -0.88, -0.82, -0.78];
  const stepW = [1.05, 0.94, 0.84, 0.74];
  const stepZ = [0.86, 0.76, 0.66, 0.56];
  for (let i = 0; i < stepY.length; i++) {
    const y = stepY[i] ?? 0;
    const w = stepW[i] ?? 0;
    const z = stepZ[i] ?? 0;
    pushSeg(p, -w, y, z, w, y, z);
    pushSeg(p, -w, y, z, -w, y, 0.42);
    pushSeg(p, w, y, z, w, y, 0.42);
  }
  for (let i = 0; i < 9; i++) {
    const x = (i / 8 - 0.5) * 1.4;
    pushSeg(p, x, -0.94, 0.86, x, -0.78, 0.56);
  }

  const colY0 = -0.78;
  const colY1 = 0.14;
  const colZ = 0.56;
  for (let i = 0; i < 10; i++) {
    const x = (i / 9 - 0.5) * 1.48;
    column(p, x, colY0, colY1, colZ, 0.028);
  }
  pushSeg(p, -0.78, colY1, colZ, 0.78, colY1, colZ);
  pushSeg(p, -0.78, colY1 + 0.05, colZ, 0.78, colY1 + 0.05, colZ);
  pushSeg(p, -0.78, colY1 + 0.1, colZ, 0.78, colY1 + 0.1, colZ);
  pushSeg(p, -0.78, colY1, colZ, -0.78, colY1 + 0.1, colZ);
  pushSeg(p, 0.78, colY1, colZ, 0.78, colY1 + 0.1, colZ);
  dentil(p, -0.76, 0.76, colY1 + 0.05, colZ, 14);

  pushSeg(p, -0.78, colY1 + 0.1, colZ, 0, 0.46, colZ);
  pushSeg(p, 0.78, colY1 + 0.1, colZ, 0, 0.46, colZ);
  pushSeg(p, -0.62, colY1 + 0.14, colZ, 0, 0.4, colZ);
  pushSeg(p, 0.62, colY1 + 0.14, colZ, 0, 0.4, colZ);
  pushSeg(p, -0.78, colY1 + 0.1, colZ, 0.78, colY1 + 0.1, colZ);

  const drumY0 = 0.24;
  const drumY1 = 0.58;
  const drumR = 0.42;
  const drumSegs = 20;
  ring(p, drumY0, drumR, 0, drumSegs);
  ring(p, drumY0 + 0.06, drumR * 1.04, 0, drumSegs);
  ring(p, drumY1, drumR, 0, drumSegs);
  ring(p, drumY1 + 0.05, drumR * 1.03, 0, 18);
  for (let i = 0; i < drumSegs; i++) {
    const t = (i / drumSegs) * Math.PI * 2;
    const x = Math.cos(t) * drumR;
    const z = Math.sin(t) * drumR;
    column(p, x, drumY0, drumY1, z, 0.018);
    const t2 = ((i + 0.5) / drumSegs) * Math.PI * 2;
    arch(
      p,
      Math.cos(t) * drumR * 0.98,
      Math.cos(t2) * drumR * 0.98,
      drumY0 + 0.08,
      drumY1 - 0.06,
      (Math.sin(t) * drumR + Math.sin(t2) * drumR) / 2,
    );
  }

  const domeY = drumY1 + 0.05;
  const domeR = 0.46;
  const meridians = 16;
  for (let m = 0; m < meridians; m++) {
    const theta = (m / meridians) * Math.PI * 2;
    let px = Math.cos(theta) * domeR;
    let py = domeY;
    let pz = Math.sin(theta) * domeR;
    for (let k = 1; k <= 10; k++) {
      const phi = (k / 10) * Math.PI * 0.5;
      const x = Math.cos(theta) * domeR * Math.cos(phi);
      const y = domeY + domeR * 0.92 * Math.sin(phi);
      const z = Math.sin(theta) * domeR * Math.cos(phi);
      pushSeg(p, px, py, pz, x, y, z);
      px = x;
      py = y;
      pz = z;
    }
  }
  for (const phi of [0.18, 0.34, 0.5, 0.68, 0.84]) {
    ring(p, domeY + domeR * 0.92 * Math.sin(phi), domeR * Math.cos(phi), 0, 20);
  }

  const lanternY = domeY + domeR * 0.92;
  ring(p, lanternY, 0.09, 0, 10);
  ring(p, lanternY + 0.12, 0.07, 0, 10);
  ring(p, lanternY + 0.18, 0.05, 0, 8);
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    pushSeg(
      p,
      Math.cos(t) * 0.09,
      lanternY,
      Math.sin(t) * 0.09,
      Math.cos(t) * 0.07,
      lanternY + 0.12,
      Math.sin(t) * 0.07,
    );
  }
  pushSeg(p, 0, lanternY + 0.18, 0, 0, lanternY + 0.32, 0);
  pushSeg(p, -0.04, lanternY + 0.26, 0, 0.04, lanternY + 0.26, 0);
  pushSeg(p, 0, lanternY + 0.32, 0, 0.035, lanternY + 0.28, 0.01);

  return new Float32Array(p);
}

let capitolLineCache: Float32Array | null = null;

function capitolLines() {
  capitolLineCache ??= createCapitolLines();
  return capitolLineCache;
}

function capitolPos(p: Particle): Vec3 {
  const lines = capitolLines();
  const segs = Math.floor(lines.length / 6);
  if (segs <= 0) return [0, 0, 0];
  const seg = Math.min(segs - 1, Math.floor(p.u * segs));
  const t = p.v;
  const o = seg * 6;
  const ax = lines[o] ?? 0;
  const ay = lines[o + 1] ?? 0;
  const az = lines[o + 2] ?? 0;
  const bx = lines[o + 3] ?? 0;
  const by = lines[o + 4] ?? 0;
  const bz = lines[o + 5] ?? 0;
  return [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t];
}

/** Highest point of the dome vs the stepped plinth — used by tests. */
export function prismToCapitol(x: number, y: number, z: number): Vec3 {
  const h = (y / (Math.hypot(x, y, z) || 1) + 1) * 0.5;
  if (h < 0.2) return [x * 0.9, -0.86, z * 0.5];
  if (h < 0.55) return [x * 1.6, -0.4 + h * 0.5, z * 0.35];
  if (h < 0.72) return [x * 0.5, 0.2, z * 0.4];
  const u = (h - 0.72) / 0.28;
  const phi = u * Math.PI * 0.5;
  const theta = Math.atan2(z, x);
  return [
    Math.cos(theta) * 0.4 * Math.cos(phi),
    0.48 + 0.4 * Math.sin(phi),
    Math.sin(theta) * 0.4 * Math.cos(phi),
  ];
}

const LAYOUT_FNS: Record<LayoutName, (p: Particle) => Vec3> = {
  quiet: quietPos,
  sphere: spherePos,
  orbit: orbitPos,
  path: pathPos,
  threads: threadsPos,
  dust: dustPos,
  capitol: capitolPos,
};

export function layoutPositions(
  particles: readonly Particle[],
  layout: LayoutName,
) {
  const positions = new Float32Array(particles.length * 3);
  const fn = LAYOUT_FNS[layout];
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (!particle) continue;
    const [x, y, z] = fn(particle);
    const o = i * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
  }
  return positions;
}

export function createLayouts(particles: readonly Particle[]) {
  const layouts = {} as Record<LayoutName, Float32Array>;
  for (const name of LAYOUT_NAMES) {
    layouts[name] = layoutPositions(particles, name);
  }
  return layouts;
}

export function createEdges(particles: readonly Particle[], maxEdges: number) {
  const rng = mulberry32(91);
  const edges: number[] = [];
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    if (!a || rng() > 0.22) continue;
    const b = Math.floor(rng() * particles.length);
    if (b === a.index) continue;
    edges.push(a.index, b);
  }
  return edges.slice(0, maxEdges * 2);
}

export function mixLayouts(
  from: Float32Array,
  to: Float32Array,
  t: number,
  out: Float32Array,
) {
  const n = Math.min(from.length, to.length, out.length);
  const s = t * t * (3 - 2 * t);
  for (let i = 0; i < n; i++) {
    const a = from[i] ?? 0;
    const b = to[i] ?? 0;
    out[i] = a + (b - a) * s;
  }
}

export function particleCountForViewport(width: number) {
  if (width < 720) return 70;
  if (width < 1100) return 110;
  return 160;
}

export function edgeCountForViewport(width: number) {
  if (width < 720) return 28;
  if (width < 1100) return 42;
  return 58;
}
