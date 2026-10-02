import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ElectionOfficeLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card } from "~/components/ui/layout";
import { NavHeader } from "~/components/ui/NavHeader";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";

/** Unavailable lookup never describes the address as having no election. */
export function BallotLookupGate({
  checking,
  failed,
  onRetry,
  onBack,
  onHome,
}: {
  checking: boolean;
  failed: boolean;
  onRetry: () => void;
  onBack: () => void;
  onHome: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <NavHeader key={fontScale} title="" onBack={onBack} />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontDisplay.bold,
            fontSize: 34,
            lineHeight: 38,
            color: P.inkOnNight,
          }}
        >
          Your ballot
        </Text>
        <Card style={{ padding: 16, gap: 16, borderRadius: 14 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fontEditorial.bold,
              fontSize: 16,
              lineHeight: 19,
              color: P.inkOnNight,
            }}
          >
            Address-specific ballots
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole={failed ? "alert" : undefined}
            style={{
              fontFamily: fontBody.regular,
              fontSize: 16,
              lineHeight: 24,
              color: P.inkOnNight,
            }}
          >
            {checking
              ? "Checking ballot lookup availability…"
              : failed
                ? "We couldn’t check lookup availability. Use your election office for your official ballot and voting options."
                : "Address-specific lookup is not available in Billion yet. We’re verifying ballot coverage against official records before opening lookup."}
          </Text>
          <Text
            style={{
              fontFamily: fontBody.regular,
              fontSize: 16,
              lineHeight: 24,
              color: P.inkOnNight,
            }}
          >
            The California guide is a statewide preview, not your ballot.
          </Text>
          <ElectionOfficeLink prominence="primary" />
          <Pressable
            accessibilityRole="button"
            disabled={checking}
            onPress={onRetry}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fontBody.bold,
                fontSize: 16,
                color: P.inkOnNight,
              }}
            >
              Check availability again
            </Text>
          </Pressable>
          <Pressable
            onPress={onHome}
            accessibilityRole="button"
            style={{
              minHeight: 48,
              padding: 12,
              borderRadius: 12,
              backgroundColor: P.canvas,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fontBody.bold,
                fontSize: 16,
                color: P.inkOnNight,
              }}
            >
              Back home
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  );
}
