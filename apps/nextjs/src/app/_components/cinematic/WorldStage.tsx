"use client";

import dynamic from "next/dynamic";

import { CanvasWorld } from "./CanvasWorld";
import { useJourney } from "./use-journey";

const WebGLWorld = dynamic(
  () => import("./CivicWorld").then((mod) => mod.CivicWorld),
  {
    ssr: false,
    loading: () => <div style={{ background: "#0E1530" }} />,
  },
);

export function WorldStage() {
  const { webgl, reducedMotion, width } = useJourney();
  const preferCanvas = reducedMotion || webgl === false || width < 640;

  if (webgl === null) {
    return (
      <div
        style={{
          background: "#0E1530",
          width: "100%",
          height: "100%",
        }}
      />
    );
  }

  if (preferCanvas) {
    return <CanvasWorld />;
  }

  return <WebGLWorld />;
}
