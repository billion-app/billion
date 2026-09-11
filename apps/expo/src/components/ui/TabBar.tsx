/**
 * TabBar — Billion Digest editorial chrome.
 * Quiet luxury: canvas night, spark active signal, hairline top rule,
 * hand-crafted stroke icons, underline active mark (no soft AI pill blob).
 */
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DigestPalette as P,
  DigestSpace,
  DigestTabBar,
  DigestType,
} from "~/styles";
import {
  getTabBarItemDisplay,
  isTabRouteHidden,
} from "./tab-bar-visibility";
import { TAB_ROUTE_ICON, TabChromeIcon } from "./TabChromeIcons";

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: DigestTabBar.background,
        },
      ]}
    >
      <View style={s.rule} />
      <View style={s.inner}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          const itemStyle = StyleSheet.flatten(options.tabBarItemStyle);
          if (
            isTabRouteHidden({
              routeName: route.name,
              isDev: __DEV__,
              href: (options as { href?: unknown }).href,
              itemDisplay: getTabBarItemDisplay(itemStyle),
            })
          ) {
            return null;
          }
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
          const color = focused ? DigestTabBar.active : DigestTabBar.inactive;
          const iconName = TAB_ROUTE_ICON[route.name] ?? "home";
          return (
            <TouchableOpacity
              key={route.key}
              style={s.tab}
              onPress={onPress}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
            >
              <View style={s.iconCol}>
                <TabChromeIcon
                  name={iconName}
                  size={DigestTabBar.iconSize}
                  color={color}
                  strokeWidth={focused ? 1.75 : 1.55}
                />
                <View
                  style={[
                    s.activeMark,
                    focused ? s.activeMarkOn : s.activeMarkOff,
                  ]}
                />
              </View>
              <Text
                style={[
                  s.label,
                  { color },
                  focused ? s.labelOn : null,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    borderTopWidth: 0,
  },
  /** Explicit hairline so density reads intentional on night canvas. */
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DigestTabBar.borderTop,
  },
  inner: {
    flexDirection: "row",
    paddingTop: DigestSpace.tabBarPadTop,
    paddingHorizontal: DigestSpace.tabBarPadX,
    height: DigestSpace.tabBarInnerHeight,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    paddingTop: 2,
  },
  iconCol: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  activeMark: {
    marginTop: 4,
    height: 2,
    borderRadius: 1,
  },
  activeMarkOn: {
    width: 16,
    backgroundColor: P.spark,
  },
  activeMarkOff: {
    width: 16,
    backgroundColor: "transparent",
  },
  label: {
    ...DigestType.tabLabel,
  },
  labelOn: {
    fontFamily: DigestType.tabLabel.fontFamily,
    letterSpacing: 0.35,
  },
});
