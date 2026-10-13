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
    /** "light": the main case shows the disputes and a row of links instead of tiles and tabs. */
    layout?: "full" | "light";
  },
): { jump: (state: string) => void; destroy: () => void };
