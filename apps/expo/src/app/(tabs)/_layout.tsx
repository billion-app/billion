import type React from "react";
import { Tabs } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { QueryClientProvider } from "@tanstack/react-query";

import { colors, useTheme } from "~/styles";
import { queryClient } from "~/utils/api";

import "../../styles.css";

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { theme } = useTheme();
  const tintColor = colors.white;

  return (
    <QueryClientProvider client={queryClient}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.white,
          tabBarInactiveTintColor: "rgba(255, 255, 255, 0.50)",
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "500",
          },
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: false,
        }}
      >
        {/*<SafeAreaView>*/}
        <Tabs.Screen
          name="index"
          options={{
            title: "Browse",
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="search" color={color} />
            ),
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: "Feed",
            tabBarIcon: ({ color }) => <TabBarIcon name="play" color={color} />,
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
            headerShown: false,
          }}
        />
        {/*</SafeAreaView>*/}
      </Tabs>
    </QueryClientProvider>
  );
}
