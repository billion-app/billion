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
  translationKey = "en",
  language = "en",
  localState,
  onLocalState,
  onExit,
  onOpenUrl,
  onOpenMeasure,
  onBackState,
  onReady,
  view,
  ballot,
  ref,
}: {
  graph: PublicTrillionGraph;
  translationKey?: string;
  language?: "en" | "es" | "zh";
  localState: string;
  onLocalState: (value: string) => Promise<void>;
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
  onReady: () => Promise<void>;
  ref?: Ref<TrillionReaderHandle>;
  dom?: DOMProps;
}) {
  const local = useRef(localState);
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
      onReady: () => void onReady(),
      onExit: () => void onExit(),
      onOpenUrl: (url: string) => void onOpenUrl(url),
      onOpenMeasure: (number: string) => void onOpenMeasure(number),
      onBackState: (inside: boolean) => void onBackState(inside),
      localState: local.current,
      onLocalState: async (value: string) => {
        local.current = value;
        await onLocalState(value);
      },
      view,
      ballot,
      language,
    });
    reader.current = mounted;
    return () => {
      reader.current = null;
      mounted.destroy();
    };
    // Native prop updates serialize the graph into a new object. Only a new
    // published revision replaces the reader; back-state updates must keep its path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graph.electionDate,
    graph.measure.number,
    graph.revision,
    translationKey,
  ]);
  return (
    <div ref={root} style={{ height: "100vh", width: "100%", minWidth: 0 }} />
  );
}
