import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ElectionOfficeLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import { Card } from "~/components/ui/layout";
import { NavHeader } from "~/components/ui/NavHeader";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";

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
          Find your ballot
        </Text>
        <Card style={{ padding: 16, gap: 16, borderRadius: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: P.canvas,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {checking ? (
                <ActivityIndicator color={P.inkOnNight} />
              ) : (
                <Icon name="info" size={20} color={P.inkOnNight} />
              )}
            </View>
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole={failed ? "alert" : undefined}
              style={{
                flex: 1,
                fontFamily: fontBody.bold,
                fontSize: 14,
                lineHeight: 21,
                color: P.inkOnNight,
              }}
            >
              {checking
                ? "Checking ballot lookup…"
                : failed
                  ? "We couldn’t check ballot lookup"
                  : "Ballot lookup unavailable"}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fontBody.regular,
              fontSize: 16,
              lineHeight: 24,
              color: P.inkOnNight,
            }}
          >
            Your election office can help you find your official ballot.
          </Text>
          <ElectionOfficeLink prominence="primary" />
          {failed && (
            <Pressable
              accessibilityRole="button"
              disabled={checking}
              onPress={onRetry}
              style={{
                minHeight: 48,
                padding: 12,
                borderRadius: 12,
                backgroundColor: P.canvas,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fontBody.bold,
                  fontSize: 16,
                  color: P.inkOnNight,
                }}
              >
                Try again
              </Text>
            </Pressable>
          )}
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
              Back to Elections
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  );
}
