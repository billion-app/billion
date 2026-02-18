// ThatXliner: I genuinely have no idea why both
// this file and the other one (in (tabs)) is required.
// Surely I'm not doing the provider twice... right??
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  IBMPlexSerif_700Bold,
  IBMPlexSerif_700Bold_Italic,
} from "@expo-google-fonts/ibm-plex-serif";
import {
  InriaSerif_700Bold,
  InriaSerif_400Regular,
} from "@expo-google-fonts/inria-serif";
import {
  AlbertSans_400Regular,
  AlbertSans_500Medium,
  AlbertSans_600SemiBold,
} from "@expo-google-fonts/albert-sans";

import { useTheme } from "~/styles";
import { queryClient } from "~/utils/api";

import "../styles.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { theme } = useTheme();

  const [fontsLoaded] = useFonts({
    IBMPlexSerif_700Bold,
    IBMPlexSerif_700Bold_Italic,
    InriaSerif_700Bold,
    InriaSerif_400Regular,
    AlbertSans_400Regular,
    AlbertSans_500Medium,
    AlbertSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
