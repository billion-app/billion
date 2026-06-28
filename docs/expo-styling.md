# Expo App Styling

All styling in the Expo app is consolidated into a single location: `apps/expo/src/styles.ts` (although more work is on the way to further consolidate it into the ui package?)

**Import everything from `~/styles`** — no need to import from `@acme/ui/theme-tokens` directly.

## What's Available

```tsx
import type {
  Theme, // Type for theme object
} from "~/styles";
import {
  actions, // container, button, icon, text (for like/comment/share)
  badges, // base, text
  buttons, // tab, tabText, floating, floatingLarge
  cards, // base, bordered, elevated, content
  // Re-exported from theme-tokens
  colors, // Color palette (colors.cyan[600], colors.purple[500], etc.)
  createHeaderStyles, // createHeaderStyles(theme, insetTop) → header styles
  createSearchStyles, // createSearchStyles(theme) → search input styles
  createTabContainerStyles, // createTabContainerStyles(theme) → tab bar styles
  darkTheme, // Dark mode semantic colors
  fontSize, // Font sizes (fontSize.base, fontSize.xl, etc.)
  fontWeight, // Font weights (fontWeight.bold, fontWeight.medium, etc.)
  // Helper functions
  getMarkdownStyles, // getMarkdownStyles(theme) → Markdown component styles
  getShadow, // getShadow("md", isDark) → shadow style object
  getTypeBadgeColor, // getTypeBadgeColor("bill") → purple color
  // Pre-built StyleSheet objects
  layout, // container, fullCenter, row, center, etc.
  lightTheme, // Light mode semantic colors
  radius, // Border radius scale in rem
  rd, // rd("lg") → radius.lg * 16 → 12px
  settings, // section, sectionTitle, item, itemTitle, etc.
  shadows, // Shadow presets for light/dark modes
  // Pixel conversion helpers
  sp, // sp[5] → spacing[5] * 16 → 20px
  spacing, // Spacing scale in rem
  typography, // h1, h2, h3, h4, body, bodySmall, caption, bold, etc.
  // Theme hook
  useTheme, // Returns { theme, colorScheme, isDark }
} from "~/styles";
```

## Usage Example

```tsx
import { Text, View } from "~/components/Themed";
import { cards, layout, sp, typography, useTheme } from "~/styles";

export default function MyScreen() {
  const { theme } = useTheme();

  return (
    <View style={[layout.container, { backgroundColor: theme.background }]}>
      <Text style={[typography.h1, { color: theme.foreground }]}>
        Hello World
      </Text>
      <View
        style={[
          cards.bordered,
          { marginTop: sp[4], backgroundColor: theme.card },
        ]}
      >
        <Text style={[typography.body, { color: theme.textSecondary }]}>
          Card content
        </Text>
      </View>
    </View>
  );
}
```

## The `sp()` and `rd()` Functions

The spacing and radius tokens in `theme-tokens.ts` are defined in rem units (for web compatibility). The `sp()` and `rd()` helpers convert them to pixels for React Native:

```tsx
// spacing tokens are rem values
spacing[5] = 1.25  // 1.25rem

// sp() multiplies by 16 to get pixels
sp[5] = 1.25 * 16 = 20  // 20px

// Same for radius
radius.lg = 0.75  // 0.75rem
rd("lg") = 0.75 * 16 = 12  // 12px
```
