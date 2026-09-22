"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  cameraAt,
  layoutMix,
  phoneFootprint,
  pixelOnPhone,
  prismMorph,
  projectPoint,
} from "./journey";
import { CinematicPalette } from "./palette";
import { useJourney } from "./use-journey";
import {
  createCapitolLines,
  createLayouts,
  createParticles,
  mixLayouts,
  particleCountForViewport,
} from "./world-layout";

export function CanvasWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progressRef, width } = useJourney();
  const count = particleCountForViewport(width);

  const world = useMemo(() => {
    const particles = createParticles(count);
    const layouts = createLayouts(particles);
    const mixed = new Float32Array(count * 3);
    mixed.set(layouts.quiet);
    const capitolLines = createCapitolLines();
    return { particles, layouts, mixed, capitolLines };
  }, [count]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const draw = () => {
      const progress = progressRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (
        canvas.width !== Math.floor(w * dpr) ||
        canvas.height !== Math.floor(h * dpr)
      ) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const mix = layoutMix(progress);
      mixLayouts(
        world.layouts[mix.from],
        world.layouts[mix.to],
        mix.t,
        world.mixed,
      );
      const cam = cameraAt(progress);
      const form = prismMorph(progress);
      const foot = phoneFootprint(progress, w, h);

      ctx.fillStyle = CinematicPalette.void;
      ctx.fillRect(0, 0, w, h);

      if (form.buildingOpacity > 0.01) {
        ctx.strokeStyle = `rgba(196,163,90,${form.buildingOpacity})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const lines = world.capitolLines;
        for (let i = 0; i + 5 < lines.length; i += 6) {
          const a = projectPoint(
            [lines[i] ?? 0, lines[i + 1] ?? 0, lines[i + 2] ?? 0],
            cam,
            w,
            h,
          );
          const b = projectPoint(
            [lines[i + 3] ?? 0, lines[i + 4] ?? 0, lines[i + 5] ?? 0],
            cam,
            w,
            h,
          );
          if (!a.visible && !b.visible) continue;
          if (pixelOnPhone(a.x, a.y, w, h, foot) && pixelOnPhone(b.x, b.y, w, h, foot)) {
            continue;
          }
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }

      for (let i = 0; i < world.particles.length; i++) {
        const particle = world.particles[i];
        if (!particle) continue;
        const o = i * 3;
        const projected = projectPoint(
          [
            world.mixed[o] ?? 0,
            world.mixed[o + 1] ?? 0,
            world.mixed[o + 2] ?? 0,
          ],
          cam,
          w,
          h,
        );
        if (!projected.visible) continue;
        if (pixelOnPhone(projected.x, projected.y, w, h, foot)) continue;
        const gold = particle.importance > 0.35;
        const alpha = gold ? 0.45 : 0.14;
        ctx.fillStyle = gold
          ? `rgba(196,163,90,${alpha})`
          : `rgba(244,239,230,${alpha})`;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, gold ? 1.4 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [progressRef, world]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        background: CinematicPalette.void,
      }}
    />
  );
}
