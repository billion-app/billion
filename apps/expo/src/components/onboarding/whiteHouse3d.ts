/** White House construction layers, projected into a reusable yaw turntable. */
export const SPIN_AZ0 = 18;
export const SPIN_N = 72;
export const SPIN_VIEW = { w: 390, h: 230 };

type Point = [number, number, number];
type Line = Point[];
const layers: Line[][] = Array.from({ length: 11 }, () => []);

function line(layer: number, ...points: Point[]) {
  layers[layer]?.push(points);
}

function box(
  layer: number,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  for (const level of [y, y + h]) {
    line(
      layer,
      [x, level, z],
      [x + w, level, z],
      [x + w, level, z + d],
      [x, level, z + d],
      [x, level, z],
    );
  }
  for (const a of [x, x + w]) {
    for (const b of [z, z + d]) line(layer, [a, y, b], [a, y + h, b]);
  }
}

// Foundation, residence, north portico, west wing, east wing.
box(0, -3.6, 0, -0.95, 7.2, 0.08, 2.25);
box(1, -1.5, 0.08, -0.8, 3, 1.35, 1.6);
box(1, -1.57, 1.43, -0.87, 3.14, 0.12, 1.74);
box(2, -0.68, 0.08, 0.8, 1.36, 0.12, 0.5);
box(2, -0.72, 1.22, 0.8, 1.44, 0.1, 0.5);
for (const x of [-0.6, -0.2, 0.2, 0.6])
  box(2, x - 0.035, 0.2, 1.19, 0.07, 1.02, 0.07);
line(
  2,
  [-0.76, 1.32, 1.3],
  [0, 1.79, 1.3],
  [0.76, 1.32, 1.3],
  [-0.76, 1.32, 1.3],
);
for (const [layer, x] of [
  [3, -3.45],
  [4, 1.5],
] as const) {
  box(layer, x, 0.08, -0.6, 1.95, 0.57, 1.2);
  box(layer, x - 0.04, 0.65, -0.64, 2.03, 0.09, 1.28);
}
// Cornices and floor divisions give the residence depth from the first pick.
for (const y of [0.24, 0.78, 1.36]) {
  box(1, -1.52, y, -0.82, 3.04, 0.035, 1.64);
}
// Rounded south portico: curved terraces and six slender columns.
function southArc(layer: number, radius: number, y: number) {
  const points: Point[] = [];
  for (let i = 0; i <= 16; i++) {
    const theta = (i / 16) * Math.PI;
    points.push([
      Math.cos(theta) * radius,
      y,
      -0.8 - Math.sin(theta) * radius * 0.62,
    ]);
  }
  line(layer, ...points);
}
for (const y of [0.12, 0.22, 1.25, 1.34]) southArc(2, 0.7, y);
for (let i = 0; i < 6; i++) {
  const theta = ((i + 0.5) / 6) * Math.PI;
  const x = Math.cos(theta) * 0.65;
  const z = -0.8 - Math.sin(theta) * 0.65 * 0.62;
  box(2, x - 0.028, 0.22, z - 0.028, 0.056, 1.03, 0.056);
  box(2, x - 0.05, 1.19, z - 0.05, 0.1, 0.06, 0.1);
}
// Windows are present as each section arrives; topic picks add their trim.
for (const x of [-1.22, -0.91, -0.6, -0.3, 0, 0.3, 0.6, 0.91, 1.22]) {
  for (const z of [-0.825, 0.825]) {
    for (const y of [0.34, 0.88]) {
      line(
        1,
        [x - 0.075, y, z],
        [x - 0.075, y + 0.3, z],
        [x + 0.075, y + 0.3, z],
        [x + 0.075, y, z],
        [x - 0.075, y, z],
      );
    }
  }
}
for (const [layer, side] of [
  [3, -1],
  [4, 1],
] as const) {
  for (let i = 0; i < 7; i++) {
    const x = side * (1.72 + i * 0.25);
    for (const z of [-0.605, 0.605]) {
      line(
        layer,
        [x - 0.06, 0.23, z],
        [x - 0.06, 0.51, z],
        [x + 0.06, 0.51, z],
        [x + 0.06, 0.23, z],
        [x - 0.06, 0.23, z],
      );
    }
  }
}

// Topics add windows, colonnades, roof details, steps, and the flag.
for (const x of [-1.22, -0.91, -0.6, -0.3, 0, 0.3, 0.6, 0.91, 1.22]) {
  for (const z of [-0.805, 0.805]) {
    for (const [layer, y] of [
      [5, 0.34],
      [6, 0.88],
    ] as const) {
      line(layer, [x, y, z], [x, y + 0.3, z]);
      line(layer, [x - 0.075, y + 0.15, z], [x + 0.075, y + 0.15, z]);
      line(layer, [x - 0.1, y - 0.025, z], [x + 0.1, y - 0.025, z]);
      line(
        layer,
        [x - 0.1, y + 0.32, z],
        [x, y + 0.38, z],
        [x + 0.1, y + 0.32, z],
      );
    }
  }
}
for (const side of [-1, 1]) {
  for (let i = 0; i < 8; i++) {
    const x = side * (1.64 + i * 0.24);
    line(7, [x, 0.1, 0.61], [x, 0.65, 0.61]);
  }
  box(8, side * 1.08 - 0.09, 1.55, -0.35, 0.18, 0.32, 0.22);
}
box(8, -1.4, 1.55, -0.7, 2.8, 0.12, 1.4);
for (let i = 0; i <= 20; i++) {
  const x = -1.4 + i * 0.14;
  for (const z of [-0.7, 0.7]) line(8, [x, 1.55, z], [x, 1.67, z]);
}
for (const x of [-1.505, 1.505]) {
  for (const z of [-0.5, 0, 0.5]) {
    for (const y of [0.34, 0.88]) {
      line(
        6,
        [x, y, z - 0.08],
        [x, y + 0.3, z - 0.08],
        [x, y + 0.3, z + 0.08],
        [x, y, z + 0.08],
        [x, y, z - 0.08],
      );
      line(6, [x, y + 0.15, z - 0.08], [x, y + 0.15, z + 0.08]);
    }
  }
}
for (let i = 0; i < 3; i++)
  box(
    9,
    -0.8 - i * 0.09,
    0.02,
    1.3 + i * 0.12,
    1.6 + i * 0.18,
    0.12 - i * 0.035,
    0.12,
  );
line(10, [0, 1.67, 0], [0, 2.3, 0]);
line(10, [0, 2.3, 0], [0.48, 2.24, 0], [0.48, 2.02, 0], [0, 2.08, 0]);

export const SPIN_BANDS = layers.map((polys) => {
  const breaks: number[] = [];
  let count = 0;
  for (const poly of polys) {
    breaks.push(count);
    count += poly.length;
  }
  const frames = Array.from({ length: SPIN_N }, (_, i) => {
    const az = ((SPIN_AZ0 + (i * 360) / SPIN_N) * Math.PI) / 180;
    return polys.flatMap((poly) =>
      poly.flatMap(([x, y, z]) => {
        const horizontal = x * Math.cos(az) - z * Math.sin(az);
        const depth = x * Math.sin(az) + z * Math.cos(az);
        return [195 + horizontal * 47, 165 - y * 47 - depth * 14];
      }),
    );
  });
  return { frames, breaks };
});
