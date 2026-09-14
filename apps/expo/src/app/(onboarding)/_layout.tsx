import { Stack } from "expo-router";

import { DigestPalette } from "~/styles";

/**
 * One route: the whole flow is a single publication, so there is nothing
 * to navigate between. No header, no swipe-back — the reader moves forward by
 * answering.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: DigestPalette.canvas },
      }}
    >
      {/* The gate is `welcome`, not `index`: an index route in this group would
          claim "/" alongside the dashboard and make that path ambiguous. */}
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
