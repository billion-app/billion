import { Tabs } from "expo-router";

import { TabBar } from "~/components/ui/TabBar";
import { useLanguage } from "~/hooks/useLanguage";

import "../../styles.css";

export default function TabLayout() {
  const { t } = useLanguage();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="index"
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.feed") }} />
      <Tabs.Screen name="feed" options={{ title: t("tabs.browse") }} />
      <Tabs.Screen name="elections" options={{ title: t("tabs.elections") }} />
      {/* Feedback and Settings are reached from the profile mark in the top
          right (DigestProfileMark), not the tab bar. The routes stay mounted
          so router.push keeps working. */}
      <Tabs.Screen
        name="feedback"
        options={{ title: t("settings.feedback"), href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("tabs.settings"), href: null }}
      />
    </Tabs>
  );
}
