import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui";
import { colors, digest, fontBody, hair, planes } from "~/styles";

/** Compact official links follow the content reader's source-button scale. */
export function OfficialResourceLink({
  label,
  url,
  prominence,
}: {
  label: string;
  url: string;
  prominence?: "primary";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={[s.sourceLink, prominence === "primary" && s.primaryLink]}
        onPress={() => {
          void Linking.openURL(url).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={s.sourceText}>{label}</Text>
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="external" size={14} color={colors.white} />
        </View>
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          Could not open the link. Tap to retry.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sourceLink: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hair[2],
    backgroundColor: planes.surface,
    maxWidth: "100%",
  },
  primaryLink: {
    backgroundColor: `${digest.primary}22`,
    borderColor: `${digest.primary}66`,
  },
  sourceText: {
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.white,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.white,
    opacity: 0.72,
  },
});
