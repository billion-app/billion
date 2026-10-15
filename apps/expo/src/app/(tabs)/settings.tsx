import type { Href } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import type { StringKey } from "~/i18n/strings";
import { SettingsCrest } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { Kicker, SettingsRow, TabScreen } from "~/components/ui";
import { useLanguage } from "~/hooks/useLanguage";
import { useOnboarding } from "~/hooks/useOnboarding";
import { LANGUAGE_OPTIONS } from "~/i18n/language";
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

function buildGroups(
  t: (key: StringKey) => string,
): { title: string; items: Item[] }[] {
  return [
    {
      title: t("settings.alerts"),
      items: [
        {
          icon: "bell",
          label: t("settings.notifications"),
          sub: t("settings.notificationsSub"),
          route: "/settings/notifications" as Href,
        },
      ],
    },
    {
      title: t("settings.library"),
      items: [
        {
          icon: "bookmark",
          label: t("settings.saved"),
          route: "/settings/saved-articles",
        },
      ],
    },
    {
      title: t("settings.privacy"),
      items: [
        {
          icon: "shield",
          label: t("settings.privacy"),
          route: "/settings/privacy",
        },
      ],
    },
    {
      title: t("settings.support"),
      items: [
        { icon: "help", label: t("settings.help"), route: "/settings/help" },
        {
          icon: "message",
          label: t("settings.feedback"),
          route: "/settings/feedback",
        },
        {
          icon: "info",
          label: t("settings.about"),
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
  const { language, t } = useLanguage();
  const languageName =
    LANGUAGE_OPTIONS.find((option) => option.id === language)?.nativeName ??
    "English";

  const confirmResetPreferences = () => {
    Alert.alert(t("settings.resetTitle"), t("settings.resetBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.reset"),
        style: "destructive",
        onPress: onboarding.reset,
      },
    ]);
  };

  return (
    <TabScreen title={t("settings.title")} contentStyle={{ gap: 8 }}>
      <View style={s.section}>
        <View
          style={s.identity}
          accessibilityRole="text"
          accessibilityLabel={`${t("settings.guest")}. ${t("settings.guestMeta")}`}
        >
          <SettingsCrest size={56} />
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{t("settings.guest")}</Text>
            <Text style={s.profileMeta}>{t("settings.guestMeta")}</Text>
          </View>
        </View>
      </View>

      {buildGroups(t).map((g) => (
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
        <Kicker style={s.sectionKicker}>{t("settings.preferences")}</Kicker>
        <SettingsRow
          icon="globe"
          label={t("settings.language")}
          sub={languageName}
          onPress={() => router.push("/settings/language" as Href)}
        />
        <SettingsRow
          icon="undo"
          label={t("settings.resetPreferences")}
          sub={t("settings.resetPreferencesSub")}
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
