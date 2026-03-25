// ThatXliner: I genuinely have no idea why both
// this file and the other one (in (tabs)) is required.
// Surely I'm not doing the provider twice... right??
import { useEffect } from "react";
import * as Font from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
// Albert Sans fonts
import {
  AlbertSans_400Regular,
  AlbertSans_500Medium,
  AlbertSans_600SemiBold,
  AlbertSans_700Bold,
} from "@expo-google-fonts/albert-sans";
// IBM Plex Serif fonts
import {
  IBMPlexSerif_400Regular,
  IBMPlexSerif_400Regular_Italic,
  IBMPlexSerif_700Bold,
  IBMPlexSerif_700Bold_Italic,
} from "@expo-google-fonts/ibm-plex-serif";
// Inria Serif fonts
import {
  InriaSerif_400Regular,
  InriaSerif_400Regular_Italic,
  InriaSerif_700Bold,
  InriaSerif_700Bold_Italic,
} from "@expo-google-fonts/inria-serif";
import { QueryClientProvider } from "@tanstack/react-query";

import { useTheme } from "~/styles";
import { queryClient } from "~/utils/api";

import "../styles.css";

// Keep splash screen visible while fonts load
void SplashScreen.preventAutoHideAsync();

// This is the main layout of the app
// It wraps your pages with the providers they need
export default function RootLayout() {
  const { theme } = useTheme();

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          // IBM Plex Serif — headlines (hyphenated)
          "IBMPlexSerif-Regular": IBMPlexSerif_400Regular,
          "IBMPlexSerif-Bold": IBMPlexSerif_700Bold,
          "IBMPlexSerif-Italic": IBMPlexSerif_400Regular_Italic,
          "IBMPlexSerif-BoldItalic": IBMPlexSerif_700Bold_Italic,
          // IBM Plex Serif — underscored (used in some components)
          IBMPlexSerif_400Regular: IBMPlexSerif_400Regular,
          IBMPlexSerif_400Regular_Italic: IBMPlexSerif_400Regular_Italic,
          IBMPlexSerif_700Bold: IBMPlexSerif_700Bold,
          IBMPlexSerif_700Bold_Italic: IBMPlexSerif_700Bold_Italic,
          // Inria Serif — subheadings (hyphenated)
          "InriaSerif-Regular": InriaSerif_400Regular,
          "InriaSerif-Bold": InriaSerif_700Bold,
          "InriaSerif-Italic": InriaSerif_400Regular_Italic,
          "InriaSerif-BoldItalic": InriaSerif_700Bold_Italic,
          // Inria Serif — underscored
          InriaSerif_400Regular: InriaSerif_400Regular,
          InriaSerif_400Regular_Italic: InriaSerif_400Regular_Italic,
          InriaSerif_700Bold: InriaSerif_700Bold,
          InriaSerif_700Bold_Italic: InriaSerif_700Bold_Italic,
          // Albert Sans — body & UI (hyphenated)
          "AlbertSans-Regular": AlbertSans_400Regular,
          "AlbertSans-Medium": AlbertSans_500Medium,
          "AlbertSans-SemiBold": AlbertSans_600SemiBold,
          "AlbertSans-Bold": AlbertSans_700Bold,
          // Albert Sans — underscored (used in many components)
          AlbertSans_400Regular: AlbertSans_400Regular,
          AlbertSans_500Medium: AlbertSans_500Medium,
          AlbertSans_600SemiBold: AlbertSans_600SemiBold,
          AlbertSans_700Bold: AlbertSans_700Bold,
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
