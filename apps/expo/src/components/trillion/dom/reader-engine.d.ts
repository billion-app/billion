import type { PublicTrillionGraph } from "@acme/validators";

export function mountTrillionReader(
  root: HTMLElement,
  graph: PublicTrillionGraph,
  options?: {
    language?: "en" | "es" | "zh";
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
  destroy: () => void;
};
