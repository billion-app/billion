import type { PublicTrillionGraph } from "@acme/validators";

export interface ReaderNavigation {
  key: string;
  path: { t: "node" | "edge"; id: string }[];
  tab: string;
  view: "list" | "map";
  shown?: string[];
  showAllArguments?: boolean;
  details?: number[];
  scroll?: number;
  sheetScroll?: number;
  fullMap?: boolean;
  sheet?: {
    kind:
      | "term"
      | "flag"
      | "ring"
      | "summary"
      | "node"
      | "edge"
      | "source"
      | "composer";
    id?: string;
    fromRing?: boolean;
    termIndex?: number;
  } | null;
  draft?: {
    claim: string;
    why: string;
    source: string;
    action: string;
    reuse: string | null;
    preview: boolean;
  };
}

export function mountTrillionReader(
  root: HTMLElement,
  graph: PublicTrillionGraph,
  options?: {
    language?: "en" | "es" | "zh";
    externalHeader?: boolean;
    navigation?: ReaderNavigation;
    localState?: string;
    onLocalState?: (value: string) => void | Promise<void>;
    onExit?: () => void;
    /** Initial fonts and layout have painted; native can uncover the reader. */
    onReady?: () => void;
    onOpenUrl?: (url: string) => void;
    /** A mention of another proposition was tapped. */
    onOpenMeasure?: (number: string) => void;
    view?: "list" | "map";
    /** Measures on this ballot; only these are linked when they are mentioned. */
    ballot?: string[];
    /** True while back stays inside the reader; false when it would leave the screen. */
    onBackState?: (inside: boolean) => void;
  },
): {
  jump: (state: string) => void;
  /** Back as the edge swipe does it: close a sheet or the full map, else step back. */
  goBack: () => void;
  getNavigation: () => ReaderNavigation;
  destroy: () => void;
};
