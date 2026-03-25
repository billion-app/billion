import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { cards, colors, rd, sp, typography, useTheme } from "~/styles";

interface AIDisclaimerBannerProps {
  style?: object;
}

export function AIDisclaimerBanner({ style }: AIDisclaimerBannerProps) {
  const { theme, colorScheme } = useTheme();

  // Determine colors based on theme
  const backgroundColor =
    colorScheme === "dark"
      ? colors.red[500] + "20" // 20% opacity for dark mode
      : colors.red[500] + "15"; // 15% opacity for light mode

  const borderColor =
    colorScheme === "dark" ? colors.red[500] : colors.red[600];

  const iconColor = colorScheme === "dark" ? colors.red[400] : colors.red[600];

  const textColor =
    colorScheme === "dark"
      ? "#fca5a5" // red-300 equivalent — light red for dark backgrounds
      : "#b91c1c"; // red-700 equivalent — deep red for light backgrounds

  return (
    <View
      style={[
        localStyles.container,
        {
          backgroundColor,
          borderColor,
        },
        style,
      ]}
      lightColor="transparent"
      darkColor="transparent"
    >
      <View
        style={localStyles.iconContainer}
        lightColor="transparent"
        darkColor="transparent"
      >
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={iconColor}
        />
      </View>
      <View
        style={localStyles.textContainer}
        lightColor="transparent"
        darkColor="transparent"
      >
        <Text
          style={[
            typography.bodySmall,
            localStyles.disclaimerText,
            { color: textColor },
          ]}
        >
          AI summary provided for convenience. Always review original sources
          for complete accuracy.
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: sp[3],
    paddingHorizontal: sp[4],
    borderRadius: rd["md"],
    borderWidth: 1,
    gap: sp[3],
  },
  iconContainer: {
    paddingTop: 2, // Align icon with text baseline
  },
  textContainer: {
    flex: 1,
  },
  disclaimerText: {
    lineHeight: 18,
  },
});
