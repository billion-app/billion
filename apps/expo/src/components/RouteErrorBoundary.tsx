/**
 * Recovery UI for a route that threw while rendering.
 *
 * Without a boundary, React Native treats an uncaught render error as fatal:
 * it goes to RCTFatal and the app is SIGABRT'd. That turned a single bad
 * content row into a crash loop for a TestFlight user in 0.4.3. Routes that
 * export this get a retry instead, and the error reaches PostHog either way.
 */
import type { ErrorBoundaryProps } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "~/components/Themed";
import { GhostButton, PrimaryButton } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { colors, fontBody, fontDisplay, planes } from "~/styles";

/**
 * Build a route-level `ErrorBoundary` export.
 *
 * `routeName` is only used to tag the captured exception, so the same crash on
 * two different screens doesn't collapse into one issue in PostHog.
 */
export function createRouteErrorBoundary(routeName: string) {
  return function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const router = useRouter();

    // Render-phase capture is intentional: the boundary renders once per error,
    // and deferring to an effect risks losing the report if the user leaves
    // before it flushes.
    posthog.captureException(error, { route: routeName });

    return (
      <View style={s.screen}>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>
          This screen couldn&apos;t be displayed. The problem has been reported.
        </Text>
        <PrimaryButton
          label="Try again"
          onPress={() => void retry()}
          style={s.action}
        />
        {router.canGoBack() && (
          <GhostButton
            label="Go back"
            onPress={() => router.back()}
            style={s.action}
          />
        )}
      </View>
    );
  };
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: planes.navy,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    color: colors.white,
    textAlign: "center",
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  action: { width: 200, marginTop: 10 },
});
