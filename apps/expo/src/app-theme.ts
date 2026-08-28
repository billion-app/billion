import { darkTheme } from "@acme/ui/theme-tokens";

export type AppColorScheme = "light" | "dark";

/**
 * Keep the runtime palette aligned with app.config's dark interface style.
 * React Native can briefly report the host's light appearance on web and
 * during native startup, but this app's chrome and shared controls are dark.
 */
export function resolveAppTheme(
  _reportedColorScheme: AppColorScheme | null | undefined,
) {
  return { theme: darkTheme, colorScheme: "dark" as const, isDark: true };
}
