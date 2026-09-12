import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
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

function TabButton({
  label,
  focused,
  color,
  iconName,
  onPress,
}: {
  label: string;
  focused: boolean;
  color: string;
  iconName: NonNullable<(typeof TAB_ROUTE_ICON)[string]>;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const mark = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(mark, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
    if (focused) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 220,
        }),
      ]).start();
    }
  }, [focused, mark, scale]);

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.86,
      useNativeDriver: true,
      friction: 8,
      tension: 400,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 180,
    }).start();
  };

  return (
    <Pressable
      style={s.tab}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[s.iconCol, { transform: [{ scale }] }]}>
        <TabChromeIcon
          name={iconName}
          size={DigestTabBar.iconSize}
          color={color}
          strokeWidth={focused ? 1.75 : 1.55}
        />
        <Animated.View
          style={[
            s.activeMark,
            {
              backgroundColor: P.spark,
              opacity: mark,
              transform: [{ scaleX: mark }],
            },
          ]}
        />
      </Animated.View>
      <Text
        style={[s.label, { color }, focused ? s.labelOn : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
            <TabButton
              key={route.key}
              label={label}
              focused={focused}
              color={color}
              iconName={iconName}
              onPress={onPress}
            />
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
    width: 16,
    borderRadius: 1,
  },
  label: {
    ...DigestType.tabLabel,
  },
  labelOn: {
    fontFamily: DigestType.tabLabel.fontFamily,
    letterSpacing: 0.35,
  },
});
