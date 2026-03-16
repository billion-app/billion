// ThatXliner: I genuinely have no idea why both
// this file and the other one (in (tabs)) is required.
// Surely I'm not doing the provider twice... right??
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Font from "expo-font";

import { useTheme } from "~/styles";
import { queryClient } from "~/utils/api";

import "../styles.css";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// This is the main layout of the app
// It wraps your pages with the providers they need
export default function RootLayout() {
  const { theme } = useTheme();

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          // IBM Plex Serif — headlines
          "IBMPlexSerif-Regular": require("../../assets/fonts/IBMPlexSerif-Regular.ttf"),
          "IBMPlexSerif-Bold": require("../../assets/fonts/IBMPlexSerif-Bold.ttf"),
          "IBMPlexSerif-Italic": require("../../assets/fonts/IBMPlexSerif-Italic.ttf"),
          "IBMPlexSerif-BoldItalic": require("../../assets/fonts/IBMPlexSerif-BoldItalic.ttf"),
          // Inria Serif — subheadings
          "InriaSerif-Regular": require("../../assets/fonts/InriaSerif-Regular.ttf"),
          "InriaSerif-Bold": require("../../assets/fonts/InriaSerif-Bold.ttf"),
          "InriaSerif-Italic": require("../../assets/fonts/InriaSerif-Italic.ttf"),
          "InriaSerif-BoldItalic": require("../../assets/fonts/InriaSerif-BoldItalic.ttf"),
          // Albert Sans — body & UI
          "AlbertSans-Regular": require("../../assets/fonts/AlbertSans-Regular.ttf"),
          "AlbertSans-Medium": require("../../assets/fonts/AlbertSans-Medium.ttf"),
          "AlbertSans-SemiBold": require("../../assets/fonts/AlbertSans-SemiBold.ttf"),
          "AlbertSans-Bold": require("../../assets/fonts/AlbertSans-Bold.ttf"),
        });
      } catch (e) {
        // Font loading failure is non-fatal — app falls back to system fonts
        console.warn("Font loading failed:", e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    void loadFonts();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.background,
          },
        }}
      />
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
