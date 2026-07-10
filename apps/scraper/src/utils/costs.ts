/**
 * Cost estimation for API usage during scraper runs.
 *
 * Prices are approximate and may drift as providers update pricing.
 * Override via env vars if needed:
 *   LLM_INPUT_PRICE, LLM_OUTPUT_PRICE, VISION_INPUT_PRICE, VISION_OUTPUT_PRICE,
 *   FLUX_IMAGE_PRICE, GOOGLE_SEARCH_PRICE
 */

// Prices per unit (USD)
const PRICES = {
  // DeepSeek V4 Flash — $/1M tokens. Input uses cache-miss pricing because
  // the AI SDK usage object does not expose the cache-hit/cache-miss split.
  llmInput: Number(process.env.LLM_INPUT_PRICE) || 0.14,
  llmOutput: Number(process.env.LLM_OUTPUT_PRICE) || 0.28,
  // Gemini 2.5 Flash — $/1M tokens for the PDF vision fallback.
  visionInput: Number(process.env.VISION_INPUT_PRICE) || 0.30,
  visionOutput: Number(process.env.VISION_OUTPUT_PRICE) || 2.50,
  // FLUX.2 Klein 9B — $/image (1MP / 1024x1024)
  fluxImage: Number(process.env.FLUX_IMAGE_PRICE) || 0.015,
  // Google Custom Search — $/query (after free tier)
  googleSearch: Number(process.env.GOOGLE_SEARCH_PRICE) || 0.005,
};

interface CostState {
  llmInputTokens: number;
  llmOutputTokens: number;
  visionInputTokens: number;
  visionOutputTokens: number;
  fluxImages: number;
  googleSearches: number;
}

let state: CostState = {
  llmInputTokens: 0,
  llmOutputTokens: 0,
  visionInputTokens: 0,
  visionOutputTokens: 0,
  fluxImages: 0,
  googleSearches: 0,
};

export function resetCosts(): void {
  state = {
    llmInputTokens: 0,
    llmOutputTokens: 0,
    visionInputTokens: 0,
    visionOutputTokens: 0,
    fluxImages: 0,
    googleSearches: 0,
  };
}

export function trackLLMUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): void {
  state.llmInputTokens += inputTokens ?? 0;
  state.llmOutputTokens += outputTokens ?? 0;
}

export function trackVisionUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): void {
  state.visionInputTokens += inputTokens ?? 0;
  state.visionOutputTokens += outputTokens ?? 0;
}

export function trackFluxImage(): void {
  state.fluxImages++;
}

export function trackGoogleSearch(): void {
  state.googleSearches++;
}

export interface CostSummary {
  llmInputTokens: number;
  llmOutputTokens: number;
  visionInputTokens: number;
  visionOutputTokens: number;
  fluxImages: number;
  googleSearches: number;
  llmCost: number;
  visionCost: number;
  fluxCost: number;
  googleSearchCost: number;
  totalCost: number;
}

export function getCostSummary(): CostSummary {
  const llmCost =
    (state.llmInputTokens / 1_000_000) * PRICES.llmInput +
    (state.llmOutputTokens / 1_000_000) * PRICES.llmOutput;
  const visionCost =
    (state.visionInputTokens / 1_000_000) * PRICES.visionInput +
    (state.visionOutputTokens / 1_000_000) * PRICES.visionOutput;
  const fluxCost = state.fluxImages * PRICES.fluxImage;
  const googleSearchCost = state.googleSearches * PRICES.googleSearch;

  return {
    ...state,
    llmCost,
    visionCost,
    fluxCost,
    googleSearchCost,
    totalCost: llmCost + visionCost + fluxCost + googleSearchCost,
  };
}
