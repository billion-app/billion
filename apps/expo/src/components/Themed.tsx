/**
 * Theme-aware Text and View components
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text as DefaultText, View as RNView } from "react-native";

import type { Theme } from "~/styles";
import { useTheme } from "~/styles";

interface ThemeProps {
  lightColor?: string;
  darkColor?: string;
}
const DefaultView = RNView;
export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & React.ComponentProps<typeof DefaultView>;

type ThemeColorKey = keyof Theme;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ThemeColorKey,
) {
  const { theme, isDark } = useTheme();
  const colorFromProps = isDark ? props.dark : props.light;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme[colorName];
  }
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background",
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
