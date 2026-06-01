/**
 * Google Places Autocomplete (New) — address suggestions for the ballot
 * address lookup. Predictions are biased to US addresses so they feed cleanly
 * into Civic's getVoterInfo({ address }).
 *
 * Reuses the existing Google Cloud key (GOOGLE_API_KEY, falling back to the
 * Civic key) — both live on the same project. When no key is configured we
 * return a small mock list so the dropdown still works in local dev, mirroring
 * the mock-fallback pattern in civic.ts.
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/autocomplete
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

function getApiKey(): string | null {
  return (
    process.env.GOOGLE_PLACES_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_CIVIC_API_KEY ??
    null
  );
}

/** A single address prediction. `placeId` lets callers resolve details later. */
export interface AddressSuggestion {
  /** Full formatted prediction, e.g. "200 E Santa Clara St, San Jose, CA, USA". */
  description: string;
  /** Google place ID, stable identifier for the predicted address. */
  placeId: string;
}

// --- Places Autocomplete (New) response shapes (only the fields we mask in) ---
interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
    };
  }[];
}

const MOCK_SUGGESTIONS: AddressSuggestion[] = [
  {
    description: "1414 K Street, Sacramento, CA, USA",
    placeId: "mock-sacramento",
  },
  {
    description: "200 E Santa Clara St, San Jose, CA, USA",
    placeId: "mock-san-jose",
  },
  {
    description: "1 Dr Carlton B Goodlett Pl, San Francisco, CA, USA",
    placeId: "mock-sf",
  },
];

/**
 * Return US-address suggestions for a partial query string. Empty/short
 * queries short-circuit to an empty list (no point hitting the API for one
 * character). Throws on a non-OK API response so the tRPC layer can surface it.
 *
 * Pass a `sessionToken` (a UUID stable across one address-entry) to bundle all
 * the keystroke calls into a single billed session; the matching getPlaceDetails
 * call closes it. See https://developers.google.com/maps/documentation/places/web-service/using-session-tokens
 */
export async function getAddressSuggestions(
  query: string,
  sessionToken?: string,
): Promise<AddressSuggestion[]> {
  const input = query.trim();
  if (input.length < 3) return [];

  const apiKey = getApiKey();
  if (!apiKey) {
    // Local-dev fallback: filter the mock list so the UI behaves realistically.
    const q = input.toLowerCase();
    return MOCK_SUGGESTIONS.filter((s) =>
      s.description.toLowerCase().includes(q),
    );
  }

  const response = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Only request the fields we use — keeps the response (and billing) lean.
      "X-Goog-FieldMask":
        "suggestions.placePrediction.text,suggestions.placePrediction.placeId",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["us"],
      // Street addresses + ranges; excludes businesses/landmarks/cities-only.
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      ...(sessionToken ? { sessionToken } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(
      `Places Autocomplete error: ${response.status} ${response.statusText} - ${error}`,
    );
  }

  const data = (await response.json()) as AutocompleteResponse;
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> =>
      Boolean(p?.text?.text && p.placeId),
    )
    .map((p) => ({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      description: p.text!.text!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      placeId: p.placeId!,
    }));
}

interface PlaceDetailsResponse {
  formattedAddress?: string;
}

/**
 * Resolve a placeId to its full formatted address (incl. ZIP, which the
 * autocomplete prediction omits — and which Civic wants). Passing the same
 * `sessionToken` used for the autocomplete calls closes that billing session,
 * so the keystroke requests are charged as one unit rather than individually.
 *
 * Returns null when no key is configured (local-dev mock path): callers fall
 * back to the suggestion's own description string.
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "formattedAddress",
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(
      `Place Details error: ${response.status} ${response.statusText} - ${error}`,
    );
  }

  const data = (await response.json()) as PlaceDetailsResponse;
  return data.formattedAddress ?? null;
}
