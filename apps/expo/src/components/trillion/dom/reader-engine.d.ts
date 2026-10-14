import type { PublicTrillionGraph } from "@acme/validators";

export function mountTrillionReader(
  root: HTMLElement,
  graph: PublicTrillionGraph,
  options?: {
    onExit?: () => void;
    onOpenUrl?: (url: string) => void;
    /** A mention of another proposition was tapped. */
    onOpenMeasure?: (number: string) => void;
    view?: "list" | "map";
    /** Measures on this ballot; only these are linked when they are mentioned. */
    ballot?: string[];
  },
): { jump: (state: string) => void; destroy: () => void };
