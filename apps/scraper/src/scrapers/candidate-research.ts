import {
  failResearchRefresh,
  saveResearchCollection,
} from "@acme/api/lib/candidate-research-store";

import type { Scraper } from "../utils/types.js";
import { collectPilot } from "../candidate-research/collect.js";
import { pilot } from "../candidate-research/drafts.js";
import { createLogger } from "../utils/log.js";
import { candidateResearchConfig } from "./candidate-research.config.js";

const logger = createLogger("candidate-research");
export const candidateResearch: Scraper = {
  ...candidateResearchConfig,
  async scrape(options) {
    const maxItems =
      options?.maxItems ??
      Number(process.env.CANDIDATE_RESEARCH_MAX_ITEMS ?? 1);
    if (maxItems !== 1)
      throw new Error(
        "Candidate research requires --max-items 1 (one complete pilot race)",
      );
    if (options?.targets?.some((t) => t !== pilot.key))
      throw new Error("Unknown candidate research pilot");
    try {
      const document = await collectPilot();
      const result = await saveResearchCollection(document);
      logger.info(
        `Collected ${result.candidates} real candidates; collection ${result.collectionId}; ${result.changed ? "new draft" : "unchanged sources"}`,
      );
      if (result.problems.length) throw new Error(result.problems.join(" "));
    } catch (error) {
      await failResearchRefresh(
        pilot.key,
        "Official source refresh failed; publication withdrawn pending a successful collection and fresh review",
      );
      throw error;
    }
  },
};
