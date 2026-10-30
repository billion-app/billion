import { pilot } from "./drafts.js";
import { lieutenantGovernor } from "./statewide.js";

export function candidateResearchTarget(targets?: readonly string[]) {
  const selected = targets?.length ? targets : [pilot.key];
  if (
    selected.length !== 1 ||
    (selected[0] !== pilot.key && selected[0] !== lieutenantGovernor.key)
  )
    throw new Error("Select exactly one supported candidate research race");
  return selected[0];
}

export function validateResearchTargetArgs(args: {
  scraper?: unknown;
  target?: readonly string[];
  bill?: readonly string[];
  maxItems?: number;
}) {
  if (!args.target) return;
  if (args.target.length !== 1)
    throw new Error("--target requires exactly one complete race");
  if (args.scraper !== "candidate-research")
    throw new Error('--target requires the "candidate-research" scraper');
  if (args.bill?.length)
    throw new Error("--target and --bill cannot be combined");
  candidateResearchTarget(args.target);
  if (args.maxItems !== 1)
    throw new Error("--target requires --max-items 1 (one complete race)");
}
