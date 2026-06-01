/**
 * Cost estimation for API usage during scraper runs.
 *
 * Prices are approximate and may drift as providers update pricing.
 * Override via env vars if needed:
 *   LLM_INPUT_PRICE, LLM_OUTPUT_PRICE,
 *   IMAGEN_IMAGE_PRICE, GOOGLE_SEARCH_PRICE
 */

// Prices per unit (USD)
const PRICES = {
  // LLM — $/1M tokens (default: DeepSeek V4 Flash pricing)
  llmInput: Number(process.env.LLM_INPUT_PRICE) || 0.10,
  llmOutput: Number(process.env.LLM_OUTPUT_PRICE) || 0.30,
  // Imagen 3 — $/image (1:1 aspect ratio)
  imagenImage: Number(process.env.IMAGEN_IMAGE_PRICE) || 0.03,
  // Google Custom Search — $/query (after free tier)
  googleSearch: Number(process.env.GOOGLE_SEARCH_PRICE) || 0.005,
};

interface CostState {
  llmInputTokens: number;
  llmOutputTokens: number;
  imagenImages: number;
  googleSearches: number;
}

let state: CostState = {
  llmInputTokens: 0,
  llmOutputTokens: 0,
  imagenImages: 0,
  googleSearches: 0,
};

export function resetCosts(): void {
  state = {
    llmInputTokens: 0,
    llmOutputTokens: 0,
    imagenImages: 0,
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

export function trackImagenImage(): void {
  state.imagenImages++;
}

export function trackGoogleSearch(): void {
  state.googleSearches++;
}

export interface CostSummary {
  llmInputTokens: number;
  llmOutputTokens: number;
  imagenImages: number;
  googleSearches: number;
  llmCost: number;
  imagenCost: number;
  googleSearchCost: number;
  totalCost: number;
}

export function getCostSummary(): CostSummary {
  const llmCost =
    (state.llmInputTokens / 1_000_000) * PRICES.llmInput +
    (state.llmOutputTokens / 1_000_000) * PRICES.llmOutput;
  const imagenCost = state.imagenImages * PRICES.imagenImage;
  const googleSearchCost = state.googleSearches * PRICES.googleSearch;

  return {
    ...state,
    llmCost,
    imagenCost,
    googleSearchCost,
    totalCost: llmCost + imagenCost + googleSearchCost,
  };
}
