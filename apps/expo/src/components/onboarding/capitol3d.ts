/**
 * Round Capitol cameras. Welcome bakes one 3/4 plate; the watch page
 * bakes a yaw turntable of the same mesh so it can rotate without
 * rebuilding topology.
 */
const DEG = Math.PI / 180;
const SPAN = 1.92;
const N_COL = 24;
const N_THOLOS = 24;
const N_RIBS = 16;
const DRUM_R = 1.1;
const DRUM_Y0 = 0.22;
const DRUM_Y1 = 0.98;
const THOLOS_R = 0.86;
const THOLOS_Y0 = 1.2;
const THOLOS_Y1 = 1.52;
const DOME_RX = 0.86;
const DOME_RY = 0.7;
const DOME_CY = 1.58;

export const CAPITOL_VIEW = { w: 390, h: 780 } as const;

type Cam = {
  az: number;
  el: number;
  dist: number;
  lookY: number;
  focal: number;
  cx: number;
  cy: number;
};

function cam(azDeg: number, elDeg: number, dist: number, lookY: number): Cam {
  return {
    az: azDeg * DEG,
    el: elDeg * DEG,
    dist,
    lookY,
    focal: CAPITOL_VIEW.h * 0.95,
    cx: CAPITOL_VIEW.w * 0.5,
    cy: CAPITOL_VIEW.h * 0.5,
  };
}

function px(n: number): string {
  return `${Math.round(n * 10) / 10}`;
}

function facing(theta: number, az: number): boolean {
  return Math.cos(theta - az) > -0.22;
}

function project(
  x: number,
  y: number,
  z: number,
  c: Cam,
): [number, number] | null {
  const cosEl = Math.cos(c.el);
  const camX = c.dist * Math.sin(c.az) * cosEl;
  const camY = c.lookY + c.dist * Math.sin(c.el);
  const camZ = c.dist * Math.cos(c.az) * cosEl;
  const relX = x - camX;
  const relY = y - camY;
  const relZ = z - camZ;
  const fx = -camX;
  const fy = c.lookY - camY;
  const fz = -camZ;
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const fX = fx / fl;
  const fY = fy / fl;
  const fZ = fz / fl;
  let rX = -fZ;
  let rY = 0;
  let rZ = fX;
  const rl = Math.sqrt(rX * rX + rY * rY + rZ * rZ) || 1;
  rX /= rl;
  rY /= rl;
  rZ /= rl;
  const uX = rY * fZ - rZ * fY;
  const uY = rZ * fX - rX * fZ;
  const uZ = rX * fY - rY * fX;
  const depth = relX * fX + relY * fY + relZ * fZ;
  if (depth < 0.08) return null;
  return [
    c.cx + (c.focal * (relX * rX + relY * rY + relZ * rZ)) / depth,
    c.cy - (c.focal * (relX * uX + relY * uY + relZ * uZ)) / depth,
  ];
}

function moveTo(d: string, pts: ([number, number] | null)[]): string {
  let out = d;
  let started = false;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) {
      started = false;
      continue;
    }
    out += (started ? "L" : "M") + px(p[0]) + " " + px(p[1]);
    started = true;
  }
  return out;
}

function arc(c: Cam, r: number, y: number, n: number): ([number, number] | null)[] {
  const pts: ([number, number] | null)[] = [];
  const t0 = c.az - SPAN;
  const t1 = c.az + SPAN;
  for (let i = 0; i <= n; i++) {
    const th = t0 + ((t1 - t0) * i) / n;
    pts.push(project(r * Math.sin(th), y, r * Math.cos(th), c));
  }
  return pts;
}

function meridian(
  c: Cam,
  lam: number,
  phi0: number,
  phi1: number,
  n: number,
): ([number, number] | null)[] {
  const pts: ([number, number] | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const phi = phi0 + ((phi1 - phi0) * i) / n;
    const s = Math.sin(phi);
    pts.push(
      project(
        DOME_RX * Math.sin(lam) * s,
        DOME_CY + DOME_RY * Math.cos(phi),
        DOME_RX * Math.cos(lam) * s,
        c,
      ),
    );
  }
  return pts;
}

function capitolPath(c: Cam, layer: "structure" | "vault"): string {
  let d = "";
  if (layer === "structure") {
    d = moveTo(d, arc(c, 1.24, 0, 28));
    d = moveTo(d, arc(c, 1.18, 0.06, 28));
    d = moveTo(d, arc(c, 1.13, 0.12, 28));
    d = moveTo(d, arc(c, 1.16, 0.98, 28));
    d = moveTo(d, arc(c, 1.14, 1.06, 28));
    d = moveTo(d, arc(c, 1.1, 1.14, 28));
    const step = (Math.PI * 2) / N_COL;
    for (let i = 0; i < N_COL; i++) {
      const th = i * step;
      if (!facing(th, c.az)) continue;
      const s = Math.sin(th);
      const co = Math.cos(th);
      d = moveTo(d, [
        project(DRUM_R * s, DRUM_Y0, DRUM_R * co, c),
        project(DRUM_R * s, DRUM_Y1, DRUM_R * co, c),
      ]);
    }
    for (let i = 0; i < N_COL; i++) {
      const a = i * step;
      const b = a + step;
      if (!facing(a, c.az) || !facing(b, c.az)) continue;
      if (Math.cos(a + step / 2 - c.az) < 0.25) continue;
      const tm = a + step / 2;
      const rw = 1.02;
      const a2 = a + 0.035;
      const b2 = b - 0.035;
      d = moveTo(d, [
        project(rw * Math.sin(a2), 0.4, rw * Math.cos(a2), c),
        project(rw * Math.sin(a2), 0.76, rw * Math.cos(a2), c),
      ]);
      d = moveTo(d, [
        project(rw * Math.sin(b2), 0.4, rw * Math.cos(b2), c),
        project(rw * Math.sin(b2), 0.76, rw * Math.cos(b2), c),
      ]);
      const tl = [rw * Math.sin(a2), 0.76, rw * Math.cos(a2)];
      const tr = [rw * Math.sin(b2), 0.76, rw * Math.cos(b2)];
      const ap = [rw * Math.sin(tm), 0.86, rw * Math.cos(tm)];
      const arch: ([number, number] | null)[] = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        const iu = 1 - u;
        arch.push(
          project(
            iu * iu * tl[0] + 2 * iu * u * ap[0] + u * u * tr[0],
            iu * iu * tl[1] + 2 * iu * u * ap[1] + u * u * tr[1],
            iu * iu * tl[2] + 2 * iu * u * ap[2] + u * u * tr[2],
            c,
          ),
        );
      }
      d = moveTo(d, arch);
    }
    d = moveTo(d, arc(c, 0.96, 1.16, 26));
    d = moveTo(d, arc(c, 0.9, 1.2, 26));
    d = moveTo(d, arc(c, 0.9, 1.52, 26));
    d = moveTo(d, arc(c, 0.88, 1.58, 26));
    const thStep = (Math.PI * 2) / N_THOLOS;
    for (let i = 0; i < N_THOLOS; i++) {
      const th = i * thStep;
      if (!facing(th, c.az)) continue;
      const s = Math.sin(th);
      const co = Math.cos(th);
      d = moveTo(d, [
        project(THOLOS_R * s, THOLOS_Y0, THOLOS_R * co, c),
        project(THOLOS_R * s, THOLOS_Y1, THOLOS_R * co, c),
      ]);
    }
    return d.length > 0 ? d : "M0 0";
  }

  const ribStep = (Math.PI * 2) / N_RIBS;
  for (let i = 0; i < N_RIBS; i++) {
    const lam = i * ribStep;
    if (!facing(lam, c.az)) continue;
    d = moveTo(d, meridian(c, lam, 90 * DEG, 12 * DEG, 10));
  }
  d = moveTo(
    d,
    arc(c, DOME_RX * Math.sin(50 * DEG), DOME_CY + DOME_RY * Math.cos(50 * DEG), 22),
  );
  d = moveTo(
    d,
    arc(c, DOME_RX * Math.sin(70 * DEG), DOME_CY + DOME_RY * Math.cos(70 * DEG), 22),
  );
  d = moveTo(d, meridian(c, c.az - Math.PI / 2, 92 * DEG, 10 * DEG, 13));
  d = moveTo(d, meridian(c, c.az + Math.PI / 2, 92 * DEG, 10 * DEG, 13));
  d = moveTo(d, arc(c, 0.13, 2.18, 12));
  d = moveTo(d, arc(c, 0.12, 2.22, 12));
  d = moveTo(d, arc(c, 0.11, 2.44, 12));
  const lanStep = Math.PI / 4;
  for (let i = 0; i < 8; i++) {
    const th = i * lanStep;
    if (!facing(th, c.az)) continue;
    d = moveTo(d, [
      project(0.12 * Math.sin(th), 2.22, 0.12 * Math.cos(th), c),
      project(0.11 * Math.sin(th), 2.44, 0.11 * Math.cos(th), c),
    ]);
  }
  d = moveTo(d, [
    project(-0.11, 2.44, 0, c),
    project(0, 2.54, 0, c),
    project(0.11, 2.44, 0, c),
  ]);
  d = moveTo(d, [project(0, 2.5, 0, c), project(0, 2.66, 0, c)]);
  d = moveTo(d, [project(0, 2.66, 0, c), project(0, 2.78, 0, c)]);
  d = moveTo(d, [project(-0.025, 2.66, 0, c), project(0.025, 2.66, 0, c)]);
  d = moveTo(d, [project(0, 2.62, 0, c), project(0.075, 2.67, 0.02, c)]);
  d = moveTo(d, [
    project(-0.045, 2.54, 0, c),
    project(0, 2.6, 0, c),
    project(0.045, 2.55, 0, c),
  ]);
  return d.length > 0 ? d : "M0 0";
}

function bake(c: Cam) {
  return {
    structure: capitolPath(c, "structure"),
    vault: capitolPath(c, "vault"),
  };
}

/** Readable 3/4 of the round dome — the only plate the welcome stage uses. */
export const CAPITOL_HERO = bake(cam(26, 2, 4.5, 1.2));

/** Same geometry, framed for the watch-page spinner. */
export const SPIN_VIEW = { w: 360, h: 300 } as const;
export const SPIN_N = 32;
export const SPIN_AZ0 = 26;

function spinCam(azDeg: number): Cam {
  return {
    az: azDeg * DEG,
    el: 2 * DEG,
    dist: 5.35,
    lookY: 1.2,
    focal: SPIN_VIEW.h * 1.28,
    cx: SPIN_VIEW.w * 0.5,
    cy: SPIN_VIEW.h * 0.6,
  };
}

function xy(x: number, y: number, z: number, c: Cam): [number, number] {
  return project(x, y, z, c) ?? [c.cx, c.cy];
}

function ring(c: Cam, r: number, y: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const th = (Math.PI * 2 * i) / n;
    const p = xy(r * Math.sin(th), y, r * Math.cos(th), c);
    pts.push(p[0], p[1]);
  }
  return pts;
}

function post(
  c: Cam,
  r: number,
  y0: number,
  y1: number,
  th: number,
): number[] {
  const s = Math.sin(th);
  const co = Math.cos(th);
  const a = xy(r * s, y0, r * co, c);
  const b = xy(r * s, y1, r * co, c);
  return [a[0], a[1], b[0], b[1]];
}

function meridianPts(c: Cam, lam: number, n: number): number[] {
  const pts: number[] = [];
  const phi0 = 90 * DEG;
  const phi1 = 12 * DEG;
  for (let i = 0; i <= n; i++) {
    const phi = phi0 + ((phi1 - phi0) * i) / n;
    const s = Math.sin(phi);
    const p = xy(
      DOME_RX * Math.sin(lam) * s,
      DOME_CY + DOME_RY * Math.cos(phi),
      DOME_RX * Math.cos(lam) * s,
      c,
    );
    pts.push(p[0], p[1]);
  }
  return pts;
}

function flatten(polys: number[][]): { flat: number[]; breaks: number[] } {
  const breaks: number[] = [];
  const flat: number[] = [];
  for (const poly of polys) {
    breaks.push(flat.length / 2);
    for (let i = 0; i < poly.length; i++) flat.push(poly[i]!);
  }
  return { flat, breaks };
}

function slicePolys(
  flat: number[],
  breaks: number[],
  from: number,
  to: number,
): { flat: number[]; breaks: number[] } {
  if (from >= to) return { flat: [], breaks: [] };
  const startPt = breaks[from]!;
  const endPt = to < breaks.length ? breaks[to]! : flat.length / 2;
  const sliced = flat.slice(startPt * 2, endPt * 2);
  const nextBreaks: number[] = [];
  for (let i = from; i < to; i++) nextBreaks.push(breaks[i]! - startPt);
  return { flat: sliced, breaks: nextBreaks };
}

function joinLayer(
  a: { flat: number[]; breaks: number[] },
  b: { flat: number[]; breaks: number[] },
): { flat: number[]; breaks: number[] } {
  const n = a.flat.length / 2;
  return {
    flat: a.flat.concat(b.flat),
    breaks: a.breaks.concat(b.breaks.map((x) => x + n)),
  };
}

/** Polyline ranges that fade in as the reader marks more options. */
const BANDS: { struct: [number, number]; vault: [number, number] }[] = [
  { struct: [0, 3], vault: [0, 4] },
  { struct: [3, 19], vault: [0, 0] },
  { struct: [19, 38], vault: [0, 0] },
  { struct: [0, 0], vault: [4, 14] },
  { struct: [0, 0], vault: [14, 31] },
];

/**
 * Fixed-topology polylines (no backface cull) so neighboring yaw
 * frames can lerp. See-through wireframe is the point — it reads as 3D.
 */
function spinPolys(c: Cam): { structure: number[][]; vault: number[][] } {
  const structure: number[][] = [];
  const vault: number[][] = [];

  structure.push(ring(c, 1.24, 0, 20));
  structure.push(ring(c, 1.18, 0.06, 20));
  structure.push(ring(c, 1.13, 0.12, 20));

  const colStep = (Math.PI * 2) / 16;
  for (let i = 0; i < 16; i++) {
    structure.push(post(c, DRUM_R, DRUM_Y0, DRUM_Y1, i * colStep));
  }

  structure.push(ring(c, 1.16, 0.98, 20));
  structure.push(ring(c, 1.14, 1.06, 20));
  structure.push(ring(c, 1.1, 1.14, 20));
  structure.push(ring(c, 0.96, 1.16, 18));
  structure.push(ring(c, 0.9, 1.2, 18));
  structure.push(ring(c, 0.9, 1.52, 18));
  structure.push(ring(c, 0.88, 1.58, 18));

  const thStep = (Math.PI * 2) / 12;
  for (let i = 0; i < 12; i++) {
    structure.push(post(c, THOLOS_R, THOLOS_Y0, THOLOS_Y1, i * thStep));
  }

  const ribStep = (Math.PI * 2) / 12;
  for (let i = 0; i < 12; i++) {
    vault.push(meridianPts(c, i * ribStep, 8));
  }
  vault.push(
    ring(
      c,
      DOME_RX * Math.sin(50 * DEG),
      DOME_CY + DOME_RY * Math.cos(50 * DEG),
      18,
    ),
  );
  vault.push(
    ring(
      c,
      DOME_RX * Math.sin(70 * DEG),
      DOME_CY + DOME_RY * Math.cos(70 * DEG),
      18,
    ),
  );
  vault.push(ring(c, 0.13, 2.18, 10));
  vault.push(ring(c, 0.12, 2.22, 10));
  vault.push(ring(c, 0.11, 2.44, 10));

  const lanStep = Math.PI / 4;
  for (let i = 0; i < 8; i++) {
    vault.push(post(c, 0.12, 2.22, 2.44, i * lanStep));
  }

  const s0 = xy(-0.11, 2.44, 0, c);
  const s1 = xy(0, 2.54, 0, c);
  const s2 = xy(0.11, 2.44, 0, c);
  vault.push([s0[0], s0[1], s1[0], s1[1], s2[0], s2[1]]);
  const p0 = xy(0, 2.5, 0, c);
  const p1 = xy(0, 2.66, 0, c);
  vault.push([p0[0], p0[1], p1[0], p1[1]]);
  const q0 = xy(0, 2.66, 0, c);
  const q1 = xy(0, 2.78, 0, c);
  vault.push([q0[0], q0[1], q1[0], q1[1]]);
  const a0 = xy(-0.025, 2.66, 0, c);
  const a1 = xy(0.025, 2.66, 0, c);
  vault.push([a0[0], a0[1], a1[0], a1[1]]);
  const arm0 = xy(0, 2.62, 0, c);
  const arm1 = xy(0.075, 2.67, 0.02, c);
  vault.push([arm0[0], arm0[1], arm1[0], arm1[1]]);
  const w0 = xy(-0.045, 2.54, 0, c);
  const w1 = xy(0, 2.6, 0, c);
  const w2 = xy(0.045, 2.55, 0, c);
  vault.push([w0[0], w0[1], w1[0], w1[1], w2[0], w2[1]]);

  return { structure, vault };
}

function bakeSpin() {
  const bands: { frames: number[][]; breaks: number[] }[] = BANDS.map(() => ({
    frames: [],
    breaks: [],
  }));
  for (let i = 0; i < SPIN_N; i++) {
    const az = SPIN_AZ0 + (i * 360) / SPIN_N;
    const { structure, vault } = spinPolys(spinCam(az));
    const s = flatten(structure);
    const v = flatten(vault);
    for (let b = 0; b < BANDS.length; b++) {
      const range = BANDS[b]!;
      const piece = joinLayer(
        slicePolys(s.flat, s.breaks, range.struct[0], range.struct[1]),
        slicePolys(v.flat, v.breaks, range.vault[0], range.vault[1]),
      );
      if (i === 0) bands[b]!.breaks = piece.breaks;
      bands[b]!.frames.push(piece.flat);
    }
  }
  return bands;
}

export const SPIN_BANDS = bakeSpin();
