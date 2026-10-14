"use dom";

import "./reader.css";

import type { DOMProps } from "expo/dom";
import { useEffect, useRef } from "react";

import type { PublicTrillionGraph } from "@acme/validators";

import { mountTrillionReader } from "./reader-engine";

/**
 * The Trillion reader as an Expo DOM component. It runs the same engine as the
 * HTML mockup (prototypes/trillion/mobile.html), so the app matches it: list,
 * tabs, Cytoscape map, previews and drawers. Native code owns navigation and
 * external links through the callbacks.
 */
export default function TrillionReader({
  graph,
  onExit,
  onOpenUrl,
  onOpenMeasure,
  view,
  ballot,
}: {
  graph: PublicTrillionGraph;
  /** Which view opens first; the reader can switch afterwards. */
  view?: "list" | "map";
  /** Measures on this ballot; mentions of others are left as plain text. */
  ballot?: string[];
  onExit: () => Promise<void>;
  onOpenUrl: (url: string) => Promise<void>;
  /** Another proposition mentioned in a card was tapped. */
  onOpenMeasure: (number: string) => Promise<void>;
  dom?: DOMProps;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const reader = mountTrillionReader(root.current, graph, {
      onExit: () => void onExit(),
      onOpenUrl: (url: string) => void onOpenUrl(url),
      onOpenMeasure: (number: string) => void onOpenMeasure(number),
      view,
      ballot,
    });
    return () => reader.destroy();
    // The engine owns the DOM below the root; a new graph replaces the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);
  return <div ref={root} style={{ height: "100vh" }} />;
}
