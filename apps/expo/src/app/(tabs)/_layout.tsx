import { Tabs } from "expo-router";

import { TabBar } from "~/components/ui/TabBar";

import "../../styles.css";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Browse" }} />
      <Tabs.Screen name="feed" options={{ title: "Feed" }} />
      <Tabs.Screen name="elections" options={{ title: "Elections" }} />
      {/* Temporary: routes feedback to email while server-side intake is pending. */}
      <Tabs.Screen name="feedback" options={{ title: "Feedback" }} />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", href: __DEV__ ? undefined : null }}
      />
    </Tabs>
  );
}
