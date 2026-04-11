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
  // Imagen 3 — $/image (1:1 aspect ratio)
  imagenImage: Number(process.env.IMAGEN_IMAGE_PRICE) || 0.03,
  // Google Custom Search — $/query (after free tier)
  googleSearch: Number(process.env.GOOGLE_SEARCH_PRICE) || 0.005,
};

interface CostState {
  geminiInputTokens: number;
  geminiOutputTokens: number;
  imagenImages: number;
  googleSearches: number;
}

let state: CostState = {
  geminiInputTokens: 0,
  geminiOutputTokens: 0,
  imagenImages: 0,
  googleSearches: 0,
};

export function resetCosts(): void {
  state = {
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    imagenImages: 0,
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

export function trackImagenImage(): void {
  state.imagenImages++;
}

export function trackGoogleSearch(): void {
  state.googleSearches++;
}

export interface CostSummary {
  geminiInputTokens: number;
  geminiOutputTokens: number;
  imagenImages: number;
  googleSearches: number;
  geminiCost: number;
  imagenCost: number;
  googleSearchCost: number;
  totalCost: number;
}

export function getCostSummary(): CostSummary {
  const geminiCost =
    (state.geminiInputTokens / 1_000_000) * PRICES.geminiFlashInput +
    (state.geminiOutputTokens / 1_000_000) * PRICES.geminiFlashOutput;
  const imagenCost = state.imagenImages * PRICES.imagenImage;
  const googleSearchCost = state.googleSearches * PRICES.googleSearch;

  return {
    ...state,
    geminiCost,
    imagenCost,
    googleSearchCost,
    totalCost: geminiCost + imagenCost + googleSearchCost,
  };
}
