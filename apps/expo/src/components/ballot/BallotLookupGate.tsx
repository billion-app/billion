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
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
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
  const { t: tx } = useAppTranslation();

  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <NavHeader key={fontScale} title="" onBack={onBack} />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontEditorial.bold,
            fontSize: 24,
            lineHeight: 29,
            color: P.inkOnNight,
          }}
        >
          {tx("Find your ballot")}
        </Text>
        <Card
          style={{
            padding: 16,
            gap: 13,
            borderRadius: 14,
            backgroundColor: planes.slate,
            borderWidth: 1,
            borderColor: hair[1],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: planes.surface,
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
                fontFamily: fontEditorial.bold,
                fontSize: 17,
                lineHeight: 21,
                color: P.inkOnNight,
              }}
            >
              {checking
                ? tx("Checking ballot lookup…")
                : failed
                  ? tx("We couldn’t check ballot lookup")
                  : tx("Ballot lookup unavailable")}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fontBody.regular,
              fontSize: 15,
              lineHeight: 23,
              color: P.inkOnNight,
            }}
          >
            {tx("Your election office can help you find your official ballot.")}
          </Text>
          <ElectionOfficeLink reader />
          {failed && (
            <Pressable
              accessibilityRole="button"
              disabled={checking}
              onPress={onRetry}
              style={{
                minHeight: 48,
                padding: 12,
                borderRadius: 9,
                backgroundColor: planes.surface,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fontBody.medium,
                  fontSize: 13.5,
                  color: P.inkOnNight,
                }}
              >
                {tx("Try again")}
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
              backgroundColor: planes.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fontBody.medium,
                fontSize: 13.5,
                color: P.inkOnNight,
              }}
            >
              {tx("Back to Elections")}
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  );
}
