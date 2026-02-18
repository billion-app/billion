/**
 * React Native Button component with neumorphic styling
 * Shared component for Expo app
 */
 
 
 
 
 
import type { PressableProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, useColorScheme } from "react-native";

import {
  darkTheme,
  fontSize,
  fontWeight,
  lightTheme,
  radius,
  shadows,
  spacing,
} from "./theme-tokens";

export type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type ButtonSize = "sm" | "default" | "lg";

interface ButtonProps extends Omit<PressableProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  variant = "default",
  size = "default",
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;
  const shadowTheme = colorScheme === "dark" ? shadows.dark : shadows.light;

  const getVariantStyles = (pressed: boolean): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: radius.full, // Pill — brand signature for all primary buttons
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      sm: {
        paddingHorizontal: spacing[4] * 16,  // 16px
        paddingVertical: spacing[2] * 16,     // 8px → ~36px total (tab pills)
      },
      default: {
        paddingHorizontal: spacing[6] * 16,  // 24px
        paddingVertical: spacing[3] * 16,    // 12px → ~48px total (min touch target)
        minHeight: 48,
      },
      lg: {
        paddingHorizontal: spacing[6] * 16,  // 24px
        paddingVertical: spacing[3] * 16,    // 12px → ~48px+
        minHeight: 52,
      },
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      default: {
        backgroundColor: theme.primary,
        ...(pressed
          ? {}
          : {
              ...shadowTheme.sm,
            }),
      },
      secondary: {
        backgroundColor: theme.secondary,
        ...(pressed
          ? {}
          : {
              ...shadowTheme.sm,
            }),
      },
      outline: {
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        ...(pressed
          ? {}
          : {
              ...shadowTheme.sm,
            }),
      },
      ghost: {
        backgroundColor: pressed ? theme.accent + "20" : "transparent",
      },
      destructive: {
        backgroundColor: theme.destructive,
        ...(pressed
          ? {}
          : {
              ...shadowTheme.sm,
            }),
      },
    };

    const pressedStyle: ViewStyle = pressed
      ? {
          transform: [{ scale: 0.98 }],
          opacity: 0.9,
        }
      : {};

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...pressedStyle,
    };
  };

  const getTextColor = (): string => {
    switch (variant) {
      case "default":
        return theme.primaryForeground;
      case "destructive":
        return theme.destructiveForeground;
      case "secondary":
        return theme.secondaryForeground;
      case "outline":
        return theme.foreground;
      case "ghost":
        return theme.foreground;
      default:
        return theme.foreground;
    }
  };

  // Brand spec: Albert Sans Medium, 16px for all button labels
  const textSize = {
    sm: fontSize.base,     // 16px minimum
    default: fontSize.base, // 16px
    lg: fontSize.base,     // 16px
  }[size];

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        const disabledStyle = disabled ? styles.disabled : undefined;
        return [variantStyles, disabledStyle, style].filter(Boolean);
      }}
    >
      <Text
        style={[
          styles.text,
          {
            color: getTextColor(),
            fontSize: textSize,
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    // Albert Sans Medium — brand spec for all button labels
    fontFamily: "AlbertSans_500Medium",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});
