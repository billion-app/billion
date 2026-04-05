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
      bundleIdentifier: "dev.thatxliner.billion",
      supportsTablet: true,
      icon: {
        light: "./assets/icon-light.png",
        dark: "./assets/icon-dark.png",
      },
    },
    android: {
      package: "dev.thatxliner.billion",
      adaptiveIcon: {
        foregroundImage: "./assets/icon-light.png",
        backgroundColor: "#0E1530",
      },
      edgeToEdgeEnabled: true,
    },
    // extra: {
    //   eas: {
    //     projectId: "your-eas-project-id",
    //   },
    // },
    experiments: {
      tsconfigPaths: true,
      typedRoutes: true,
      reactCanary: true,
      reactCompiler: true,
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
