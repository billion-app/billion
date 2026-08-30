import { APP_STORE_URL } from "../_lib/app-store";

export const TRACKED_DESTINATIONS = {
  app: {
    label: "App Store",
    target: APP_STORE_URL,
  },
  home: {
    label: "Waitlist signup",
    target: "/#waitlist",
  },
  subscribe: {
    label: "Email signup page",
    target: "/subscribe",
  },
  tf: {
    label: "TestFlight",
    // Rotates with every batch. See docs/testflight-waitlist-batches.md.
    target: "https://testflight.apple.com/join/m2ay41KF",
  },
} as const;

export type TrackedDestination = keyof typeof TRACKED_DESTINATIONS;

export function isTrackedDestination(
  value: string,
): value is TrackedDestination {
  return Object.hasOwn(TRACKED_DESTINATIONS, value);
}
