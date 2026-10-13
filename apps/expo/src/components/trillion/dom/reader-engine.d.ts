import type { PublicTrillionGraph } from "@acme/validators";

export function mountTrillionReader(
  root: HTMLElement,
  graph: PublicTrillionGraph,
  options?: {
    onExit?: () => void;
    onOpenUrl?: (url: string) => void;
    view?: "list" | "map";
  },
): { jump: (state: string) => void };
