import type { Href } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { SettingsCrest } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { Kicker, SettingsRow, TabScreen } from "~/components/ui";
import { useOnboarding } from "~/hooks/useOnboarding";
import {
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { getAppVersion } from "~/utils/app-version";

interface Item {
  icon: IconName;
  label: string;
  sub?: string;
  route: Href;
}

function buildGroups(): { title: string; items: Item[] }[] {
  return [
    {
      title: "Library",
      items: [
        {
          icon: "bookmark",
          label: "Saved",
          route: "/settings/saved-articles",
        },
      ],
    },
    {
      title: "Privacy",
      items: [
        {
          icon: "shield",
          label: "Privacy",
          route: "/settings/privacy",
        },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help", label: "Help", route: "/settings/help" },
        {
          icon: "message",
          label: "Feedback",
          route: "/settings/feedback",
        },
        {
          icon: "info",
          label: "About",
          sub: getAppVersion(),
          route: "/settings/about",
        },
      ],
    },
  ];
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onboarding = useOnboarding();

  const confirmResetPreferences = () => {
    Alert.alert(
      "Reset preferences?",
      "This clears your current topics, government choices, and alert preferences, then starts onboarding again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: onboarding.reset,
        },
      ],
    );
  };

  return (
    <TabScreen title="Settings" contentStyle={{ gap: 8 }}>
      <View style={s.section}>
        <View
          style={s.identity}
          accessibilityRole="text"
          accessibilityLabel="Guest account. No account features yet"
        >
          <SettingsCrest size={56} />
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>Guest</Text>
            <Text style={s.profileMeta}>No account features yet</Text>
          </View>
        </View>
      </View>

      {buildGroups().map((g) => (
        <View key={g.title} style={s.section}>
          <Kicker style={s.sectionKicker}>{g.title}</Kicker>
          {g.items.map((it, i) => (
            <SettingsRow
              key={it.label}
              icon={it.icon}
              label={it.label}
              sub={it.sub}
              last={i === g.items.length - 1}
              onPress={() => router.push(it.route)}
            />
          ))}
        </View>
      ))}

      <View style={s.section}>
        <Kicker style={s.sectionKicker}>Preferences</Kicker>
        <SettingsRow
          icon="undo"
          label="Reset preferences"
          sub="Start onboarding again"
          danger
          last
          onPress={confirmResetPreferences}
        />
      </View>

      <View style={{ height: 48 + insets.bottom }} />
    </TabScreen>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: DigestSpace.screenPadX },
  sectionKicker: {
    color: P.quiet,
    paddingLeft: 4,
    marginTop: 18,
    marginBottom: 4,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  profileName: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: P.inkOnNight,
  },
  profileMeta: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: P.quiet,
    marginTop: 4,
  },
});
