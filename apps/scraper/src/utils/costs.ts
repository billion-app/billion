/**
 * Cost estimation for API usage during scraper runs.
 *
 * Prices are approximate and may drift as providers update pricing.
 * Override via env vars if needed:
 *   GEMINI_FLASH_INPUT_PRICE, GEMINI_FLASH_OUTPUT_PRICE,
 *   DALLE3_IMAGE_PRICE, GOOGLE_SEARCH_PRICE
 */

// Prices per unit (USD)
const PRICES = {
  // Gemini 2.5 Flash — $/1M tokens
  geminiFlashInput: Number(process.env.GEMINI_FLASH_INPUT_PRICE) || 0.15,
  geminiFlashOutput: Number(process.env.GEMINI_FLASH_OUTPUT_PRICE) || 0.60,
  // DALL-E 3 — $/image (1024x1024, standard)
  dalle3Image: Number(process.env.DALLE3_IMAGE_PRICE) || 0.04,
  // Google Custom Search — $/query (after free tier)
  googleSearch: Number(process.env.GOOGLE_SEARCH_PRICE) || 0.005,
};

interface CostState {
  geminiInputTokens: number;
  geminiOutputTokens: number;
  dalle3Images: number;
  googleSearches: number;
}

let state: CostState = {
  geminiInputTokens: 0,
  geminiOutputTokens: 0,
  dalle3Images: 0,
  googleSearches: 0,
};

export function resetCosts(): void {
  state = {
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    dalle3Images: 0,
    googleSearches: 0,
  };
}

export function trackGeminiUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): void {
  state.geminiInputTokens += inputTokens ?? 0;
  state.geminiOutputTokens += outputTokens ?? 0;
}

export function trackDalle3Image(): void {
  state.dalle3Images++;
}

export function trackGoogleSearch(): void {
  state.googleSearches++;
}

export interface CostSummary {
  geminiInputTokens: number;
  geminiOutputTokens: number;
  dalle3Images: number;
  googleSearches: number;
  geminiCost: number;
  dalle3Cost: number;
  googleSearchCost: number;
  totalCost: number;
}

export function getCostSummary(): CostSummary {
  const geminiCost =
    (state.geminiInputTokens / 1_000_000) * PRICES.geminiFlashInput +
    (state.geminiOutputTokens / 1_000_000) * PRICES.geminiFlashOutput;
  const dalle3Cost = state.dalle3Images * PRICES.dalle3Image;
  const googleSearchCost = state.googleSearches * PRICES.googleSearch;

  return {
    ...state,
    geminiCost,
    dalle3Cost,
    googleSearchCost,
    totalCost: geminiCost + dalle3Cost + googleSearchCost,
  };
}
