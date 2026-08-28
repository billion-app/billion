import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { env } from "~/env";
import { APP_STORE_URL } from "../_lib/app-store";
import { campaignFor } from "./campaigns";

/**
 * Tracked redirect. `?dest` names where to go, `?p` optionally carries a
 * campaign code — both are recorded before the hop.
 *
 * `dest` names a destination rather than being one. A URL in the parameter
 * would make this an open redirect (a phishing link wearing our domain), and
 * destinations are baked into printed QR codes, so they have to be changeable
 * here rather than on paper.
 */
const DESTINATIONS: Record<string, string> = {
  // Rotates with every batch — see docs/testflight-waitlist-batches.md
  tf: "https://testflight.apple.com/join/m2ay41KF",
  // The public listing. Shared records send iPhone readers here.
  app: APP_STORE_URL,
  // Relative, so it picks up campaign params below. External destinations do
  // not: nothing over there reads a utm, which is why the event exists.
  home: "/",
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const dest = searchParams.get("dest") ?? "";
  const code = searchParams.get("p") ?? "";
  const campaign = campaignFor(code);

  let target: string | URL | undefined = DESTINATIONS[dest];
  if (typeof target === "string" && target.startsWith("/")) {
    const url = new URL(target, origin);
    for (const [key, value] of Object.entries(campaign)) {
      url.searchParams.set(key, value);
    }
    target = url;
  }

  // Never allowed to fail the redirect: someone standing on a doorstep gets
  // where they were going whether or not PostHog is reachable.
  try {
    const key: string | undefined = env.NEXT_PUBLIC_POSTHOG_KEY;
    const host: string | undefined = env.NEXT_PUBLIC_POSTHOG_HOST;
    if (key && host) {
      await fetch(`${host.replace(/\/$/, "")}/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(1500),
        body: JSON.stringify({
          api_key: key,
          event: "tracked_redirect",
          properties: {
            // No browser identity here, and a person profile per scan would be
            // noise — these are counted, not followed.
            distinct_id: `redirect-${crypto.randomUUID()}`,
            $process_person_profile: false,
            ...campaign,
            code,
            dest,
            destination: target?.toString() ?? null,
            resolved: Boolean(target),
          },
        }),
      });
    }
  } catch {
    // Swallowed on purpose — see above.
  }

  // An unknown dest still lands somewhere useful rather than on an error.
  return NextResponse.redirect(target ?? new URL("/", origin), 307);
}
