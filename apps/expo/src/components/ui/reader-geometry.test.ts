import assert from "node:assert/strict";
import test from "node:test";

import { readerColumns, readerScalePosition } from "./reader-geometry";

void test("column widths and gutter fill the physical canvas with at most one pixel difference", () => {
  for (const width of [272, 327, 345, 354.333333, 696])
    for (const density of [1, 2, 3])
      for (const count of [1, 2] as const) {
        const result = readerColumns(width, count, 24, density);
        const pixels = result.widths.map((value) =>
          Math.round(value * density),
        );
        assert.equal(
          pixels.reduce((a, b) => a + b, 0) + Math.round(result.gap * density),
          Math.round(width * density),
        );
        if (count === 2)
          assert.ok(Math.abs((pixels[0] ?? 0) - (pixels[1] ?? 0)) <= 1);
      }
});
void test("scale geometry reflects the supplied domain rather than decorative positions", () => {
  assert.equal(readerScalePosition(80, 75, 95, 320), 80);
  assert.equal(readerScalePosition(90, 75, 95, 320), 240);
  assert.equal(readerScalePosition(30, 20, 60, 400), 100);
  assert.equal(readerScalePosition(20, 20, 60, 400), 0);
  assert.equal(readerScalePosition(60, 20, 60, 400), 400);
  assert.equal(readerScalePosition(10, 20, 60, 400), null);
  assert.equal(readerScalePosition(30, 20, 20, 400), null);
  assert.equal(readerScalePosition(NaN, 20, 60, 400), null);
});
