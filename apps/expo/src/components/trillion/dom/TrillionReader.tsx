"use dom";

import "./reader.css";

import type { DOMImperativeFactory, DOMProps } from "expo/dom";
import type { Ref } from "react";
import { useEffect, useRef } from "react";
import { useDOMImperativeHandle } from "expo/dom";

import type { PublicTrillionGraph } from "@acme/validators";

import { mountTrillionReader } from "./reader-engine";

/** What native code can ask of the reader. */
export interface TrillionReaderHandle extends DOMImperativeFactory {
  /** Back as the edge swipe does it: close a sheet or the full map, else step back. */
  goBack: () => void;
}

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
  onBackState,
  view,
  ballot,
  ref,
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
  /** True while back stays inside the reader, so native code can hand it the swipe. */
  onBackState: (inside: boolean) => Promise<void>;
  ref?: Ref<TrillionReaderHandle>;
  dom?: DOMProps;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reader = useRef<ReturnType<typeof mountTrillionReader>>(null);
  useDOMImperativeHandle(
    ref ?? null,
    () => ({ goBack: () => reader.current?.goBack() }),
    [],
  );
  useEffect(() => {
    if (!root.current) return;
    const mounted = mountTrillionReader(root.current, graph, {
      onExit: () => void onExit(),
      onOpenUrl: (url: string) => void onOpenUrl(url),
      onOpenMeasure: (number: string) => void onOpenMeasure(number),
      onBackState: (inside: boolean) => void onBackState(inside),
      view,
      ballot,
    });
    reader.current = mounted;
    return () => {
      reader.current = null;
      mounted.destroy();
    };
    // The engine owns the DOM below the root; a new graph replaces the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);
  return (
    <div ref={root} style={{ height: "100vh", width: "100%", minWidth: 0 }} />
  );
}
