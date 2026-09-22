import assert from "node:assert/strict";
import test from "node:test";

import {
  appScreenAt,
  billJourneyAt,
  cameraAt,
  chapterAt,
  COPY_BEATS,
  keepOffPhone,
  layoutMix,
  phoneFootprint,
  phonePose,
  prismMorph,
  projectPoint,
} from "./journey";
import { clamp, lerp3, windowOpacity } from "./math";
import {
  createCapitolLines,
  createParticles,
  layoutPositions,
  mixLayouts,
} from "./world-layout";

void test("windowed copy fades in, holds, then fades out", () => {
  assert.equal(windowOpacity(0.01, 0.05, 0.08, 0.1, 0.14), 0);
  assert.ok(windowOpacity(0.065, 0.05, 0.08, 0.1, 0.14) > 0);
  assert.equal(windowOpacity(0.09, 0.05, 0.08, 0.1, 0.14), 1);
  assert.equal(windowOpacity(0.2, 0.05, 0.08, 0.1, 0.14), 0);
});

void test("layout mix holds a quiet field, then becomes the sphere", () => {
  const early = layoutMix(0.04);
  assert.equal(early.from, "quiet");
  assert.equal(early.to, "quiet");
  const mid = layoutMix(0.16);
  assert.equal(mid.to, "sphere");
  const held = layoutMix(0.22);
  assert.equal(held.from, "sphere");
  assert.equal(held.to, "sphere");
});

void test("camera stays near the product instead of flying away", () => {
  const near = cameraAt(0);
  const later = cameraAt(0.4);
  assert.ok(Math.abs(later.position[2] - near.position[2]) < 2);
});

void test("chapter lookup covers the full scroll", () => {
  assert.equal(chapterAt(0), "hero");
  assert.equal(chapterAt(0.25), "complicated");
  assert.equal(chapterAt(0.5), "bill");
  assert.equal(chapterAt(0.7), "personal");
  assert.equal(chapterAt(0.99), "download");
});

void test("hero copy is visible at the first frame", () => {
  assert.ok(COPY_BEATS.hero(0) > 0.5);
});

void test("the hero phone is huge, frontal, and cropped off the bottom", () => {
  const hero = phonePose(0, 1200);
  assert.ok(hero.yPct > 80);
  assert.ok(hero.scale > 1.4);
  assert.ok(Math.abs(hero.rotateY) < 1);
  assert.ok(Math.abs(hero.rotateX) < 1);
});

void test("the phone moves aside while the three statements appear", () => {
  const hero = phonePose(0.04, 1200);
  const aside = phonePose(0.2, 1200);
  assert.ok(aside.xPct > hero.xPct + 10);
});

void test("the product chapter keeps the feed until Congress, without a ballot detour", () => {
  assert.equal(appScreenAt(0.02), "feed");
  assert.equal(appScreenAt(0.3), "feed");
  assert.equal(appScreenAt(0.5), "bill");
  assert.equal(appScreenAt(0.72), "feed");
});

void test("the phone stays aside instead of centering for a product tour", () => {
  const aside = phonePose(0.3, 1200);
  assert.ok(aside.xPct > 65);
  assert.ok(aside.opacity > 0.9);
});

void test("the phone stays on during the combined feed chapter", () => {
  const pose = phonePose(0.72, 1200);
  assert.ok(pose.opacity > 0.9);
  assert.ok(pose.xPct > 65);
});

void test("the bill chapter parks the phone on the right, with tilt", () => {
  const pose = phonePose(0.58, 1200);
  assert.ok(pose.xPct > 65);
  assert.ok(Math.abs(pose.rotateY) > 6);
});

void test("the bill chapter walks introduced to signed", () => {
  const start = billJourneyAt(0.52);
  const mid = billJourneyAt(0.58);
  const end = billJourneyAt(0.64);
  assert.ok(mid.node >= start.node);
  assert.ok(end.node >= 2);
});

void test("the field becomes a capitol as Congress arrives", () => {
  const mix = layoutMix(0.5);
  assert.equal(mix.to, "capitol");
});

void test("orbit labels stay off the phone", () => {
  const foot = phoneFootprint(0.5, 1200, 800);
  const hit = keepOffPhone(foot.xPct, foot.yPct, foot);
  assert.ok(hit.hidden || Math.abs(hit.xPct - foot.xPct) > foot.halfWPct);
  const clear = keepOffPhone(8, 20, foot);
  assert.equal(clear.xPct, 8);
  assert.equal(clear.hidden, false);
});

void test("the prism morphs into a capitol instead of staying a sphere", () => {
  const early = prismMorph(0.12);
  const later = prismMorph(0.62);
  const closer = prismMorph(0.92);
  assert.ok(early.morph < 0.05);
  assert.ok(later.morph > 0.95);
  assert.ok(later.buildingOpacity > early.buildingOpacity);
  assert.ok(later.fillOpacity > 0.9);
  assert.ok(closer.fillOpacity < 0.05);
});

void test("the same particles can morph from quiet dust into a sphere", () => {
  const particles = createParticles(48);
  const quiet = layoutPositions(particles, "quiet");
  const sphere = layoutPositions(particles, "sphere");
  const mixed = new Float32Array(quiet.length);
  mixLayouts(quiet, sphere, 1, mixed);
  assert.equal(mixed[0], sphere[0]);
  assert.notEqual(quiet[0], sphere[0]);
});

void test("capitol drawing is a wide building, not a sphere", () => {
  const lines = createCapitolLines();
  assert.equal(lines.length % 6, 0);
  assert.ok(lines.length > 400);
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < lines.length; i += 3) {
    minX = Math.min(minX, lines[i] ?? 0);
    maxX = Math.max(maxX, lines[i] ?? 0);
    minY = Math.min(minY, lines[i + 1] ?? 0);
    maxY = Math.max(maxY, lines[i + 1] ?? 0);
  }
  assert.ok(maxY > minY + 1.2);
  assert.ok(maxX - minX > maxY - minY);
});

void test("projection keeps a point in front of the camera on screen", () => {
  const projected = projectPoint(
    [0, 0, 0],
    { position: [0, 0, 8], lookAt: [0, 0, 0], fov: 40 },
    1200,
    800,
  );
  assert.equal(projected.visible, true);
  assert.ok(Math.abs(projected.x - 600) < 2);
  assert.ok(Math.abs(projected.y - 400) < 2);
});

void test("lerp3 and clamp stay numeric", () => {
  assert.deepEqual(lerp3([0, 0, 0], [10, 0, 0], 0.5), [5, 0, 0]);
  assert.equal(clamp(1.4), 1);
});
