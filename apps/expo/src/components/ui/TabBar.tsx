/** TabBar — blurred translucent bottom bar matching new-design. */
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import type { IconName } from "./Icon";
import { colors, fontBody, hair } from "~/styles";
import { Icon } from "./Icon";

// expo-router's Tabs accepts a custom `tabBar` render prop; derive its props
// type from there so we don't depend on @react-navigation/bottom-tabs directly.
type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const ICONS: Record<string, IconName> = {
  index: "search",
  feed: "layers",
  elections: "vote",
  settings: "settings",
};

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <BlurView
      intensity={Platform.OS === "ios" ? 40 : 0}
      tint="dark"
      style={[s.bar, { paddingBottom: insets.bottom }]}
    >
      <View style={s.inner}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          // Expo Router hides tab routes with href: null; custom tab bars need
          // to respect that option explicitly.
          if ((options as { href?: unknown }).href === null) return null;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          const color = focused ? colors.white : colors.textSecondary;
          return (
            <TouchableOpacity
              key={route.key}
              style={s.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <Icon
                name={ICONS[route.name] ?? "home"}
                size={23}
                color={color}
              />
              <Text style={[s.label, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BlurView>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: "rgba(14,21,48,0.86)",
    borderTopWidth: 1,
    borderTopColor: hair[1],
  },
  inner: {
    flexDirection: "row",
    paddingTop: 10,
    paddingHorizontal: 24,
    gap: 4,
    height: 74,
  },
  tab: { flex: 1, alignItems: "center", gap: 5, paddingTop: 4 },
  label: { fontFamily: fontBody.semibold, fontSize: 11, letterSpacing: 0.2 },
});
