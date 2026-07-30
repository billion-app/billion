import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { campaignFor } from "../r/campaigns";

const INSTAGRAM_CAMPAIGN = campaignFor("instagram_bio");

/**
 * Stable Instagram-bio entry point.
 *
 * Instagram referrers are not reliable across its in-app browser, privacy
 * settings, and handoffs to a device browser. Landing on the homepage with
 * explicit UTMs lets PostHog associate the source with the same anonymous
 * visitor (and with the user later if that visitor is identified).
 */
export function GET(request: NextRequest) {
  const target = new URL("/", request.nextUrl.origin);

  // Keep harmless parameters Instagram or a specific promotion may append.
  // The attribution fields themselves stay canonical for this entry point.
  for (const [key, value] of request.nextUrl.searchParams) {
    if (!(key in INSTAGRAM_CAMPAIGN)) {
      target.searchParams.append(key, value);
    }
  }

  for (const [key, value] of Object.entries(INSTAGRAM_CAMPAIGN)) {
    target.searchParams.set(key, value);
  }

  return NextResponse.redirect(target, 307);
}
