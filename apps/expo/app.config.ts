import type { ConfigContext, ExpoConfig } from "expo/config";

// Type cast needed because @expo/config-types doesn't yet include
// newArchEnabled or android.edgeToEdgeEnabled.
type ExpoConfigExtended = ExpoConfig & {
  newArchEnabled?: boolean;
  android?: ExpoConfig["android"] & { edgeToEdgeEnabled?: boolean };
};

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    name: "billion",
    slug: "billion",
    scheme: "billion",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon-light.png",
    userInterfaceStyle: "dark",
    updates: {
      fallbackToCacheTimeout: 0,
    },
    newArchEnabled: true,
    assetBundlePatterns: ["**/*"],
    ios: {
      bundleIdentifier: "app.billion-news.billion",
      supportsTablet: true,
      icon: {
        light: "./assets/icon-light.png",
        dark: "./assets/icon-dark.png",
      },
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: "app.billion-news.billion",
      adaptiveIcon: {
        foregroundImage: "./assets/icon-light.png",
        backgroundColor: "#0E1530",
      },
      edgeToEdgeEnabled: true,
    },
    extra: {
      eas: {
        projectId: "c38bc8f8-f82c-4a45-b819-d62bd366ac8b",
      },
    },
    experiments: {
      tsconfigPaths: true,
      typedRoutes: true,
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#0E1530",
          image: "./assets/icon-dark.png",
          dark: {
            backgroundColor: "#0E1530",
            image: "./assets/icon-dark.png",
          },
        },
      ],
    ],
  }) as ExpoConfigExtended;
