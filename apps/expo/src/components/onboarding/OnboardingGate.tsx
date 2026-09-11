/**
 * Sends a first-time reader into the onboarding flow.
 *
 * A component rather than a redirect in the root layout: the decision depends
 * on a disk read, and the router has to be mounted before anything can be
 * replaced. Renders nothing — it only ever navigates.
 */
import { useEffect } from "react";

import { useRouter, useSegments } from "expo-router";

import { useOnboarding } from "~/hooks/useOnboarding";

export function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const { completed, isLoading } = useOnboarding();

  const inFlow = segments[0] === "(onboarding)";

  useEffect(() => {
    if (isLoading || completed || inFlow) return;
    router.replace("/(onboarding)/welcome");
  }, [completed, inFlow, isLoading, router]);

  return null;
}
