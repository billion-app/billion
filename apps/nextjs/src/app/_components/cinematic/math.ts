export type Vec3 = readonly [number, number, number];

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Windowed opacity: fade in, hold, fade out. */
export function windowOpacity(
  progress: number,
  fadeIn: number,
  holdStart: number,
  holdEnd: number,
  fadeOut: number,
) {
  if (progress <= fadeIn || progress >= fadeOut) return 0;
  if (progress >= holdStart && progress <= holdEnd) return 1;
  if (progress < holdStart) return smoothstep(fadeIn, holdStart, progress);
  return 1 - smoothstep(holdEnd, fadeOut, progress);
}

export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickKeyframes<T extends { t: number }>(
  keys: readonly T[],
  progress: number,
): { from: T; to: T; local: number } {
  const last = keys[keys.length - 1];
  const first = keys[0];
  if (!first || !last) {
    throw new Error("keyframes require at least one entry");
  }
  if (progress <= first.t) return { from: first, to: first, local: 0 };
  if (progress >= last.t) return { from: last, to: last, local: 0 };

  for (let i = 0; i < keys.length - 1; i++) {
    const from = keys[i];
    const to = keys[i + 1];
    if (!from || !to) continue;
    if (progress >= from.t && progress <= to.t) {
      const span = to.t - from.t;
      const local = span <= 0 ? 0 : smootherstep(from.t, to.t, progress);
      return { from, to, local };
    }
  }

  return { from: last, to: last, local: 0 };
}
