/**
 * React Native Card component with neumorphic styling
 * Shared component for Expo app
 */

import type { ViewProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";

import {
  darkTheme,
  lightTheme,
  radius,
  shadows,
  spacing,
} from "./theme-tokens";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  pressable?: boolean;
  onPress?: () => void;
  variant?: "default" | "elevated";
  style?: ViewStyle;
}

export function Card({
  children,
  style,
  pressable = false,
  onPress,
  variant = "default",
  ...props
}: CardProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;
  const shadowTheme = colorScheme === "dark" ? shadows.dark : shadows.light;

  const cardStyles: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: radius.lg * 16,
    padding: spacing[4] * 16,
    ...(variant === "elevated" ? shadowTheme.sm : {}),
  };

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => {
          const pressedStyle = pressed
            ? {
                ...shadowTheme.md,
                transform: [{ scale: 0.99 }],
              }
            : undefined;
          return [cardStyles, pressedStyle, style].filter(Boolean);
        }}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyles, style]} {...props}>
      {children}
    </View>
  );
}

interface CardHeaderProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardHeader({ children, style, ...props }: CardHeaderProps) {
  return (
    <View style={[styles.header, style]} {...props}>
      {children}
    </View>
  );
}

interface CardContentProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardContent({ children, style, ...props }: CardContentProps) {
  return (
    <View style={[styles.content, style]} {...props}>
      {children}
    </View>
  );
}

interface CardFooterProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardFooter({ children, style, ...props }: CardFooterProps) {
  return (
    <View style={[styles.footer, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing[3] * 16,
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: spacing[3] * 16,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2] * 16,
  },
});
