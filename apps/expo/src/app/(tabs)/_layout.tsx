import { Tabs } from "expo-router";

import { TabBar } from "~/components/ui/TabBar";

import "../../styles.css";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="index"
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="feed" options={{ title: "Browse" }} />
      <Tabs.Screen name="elections" options={{ title: "Elections" }} />
      {/* Feedback and Settings are reached from the profile mark in the top
          right (DigestProfileMark), not the tab bar. The routes stay mounted
          so router.push keeps working. */}
      <Tabs.Screen
        name="feedback"
        options={{ title: "Feedback", href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", href: null }}
      />
    </Tabs>
  );
}
