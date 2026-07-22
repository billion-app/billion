// ThatXliner: I genuinely have no idea why both
// this file and the other one (in (tabs)) is required.
// Surely I'm not doing the provider twice... right??
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Font from "expo-font";
import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
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
import { PostHogProvider } from "posthog-react-native";

import { posthog } from "~/config/posthog";
import { useTheme } from "~/styles";
import { queryClient } from "~/utils/api";
import { authClient } from "~/utils/auth";

import "../styles.css";

// Keep splash screen visible while fonts load
void SplashScreen.preventAutoHideAsync();

function PostHogAuthSync() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        $set: { name: user.name },
        $set_once: { first_seen_at: new Date().toISOString() },
      });
    }
  }, [user]);
  return null;
}

// This is the main layout of the app
// It wraps your pages with the providers they need
export default function RootLayout() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      void posthog.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
        ...params,
      });
      previousPathname.current = pathname;
    }
  }, [pathname, params]);

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
      <PostHogProvider
        client={posthog}
        autocapture={{
          captureScreens: false,
          captureTouches: true,
          propsToCapture: ["testID"],
          maxElementsCaptured: 20,
        }}
      >
        <PostHogAuthSync />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: theme.background,
              },
            }}
          />
          <StatusBar style="light" />
        </GestureHandlerRootView>
      </PostHogProvider>
    </QueryClientProvider>
  );
}
