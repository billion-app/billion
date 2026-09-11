// ThatXliner: I genuinely have no idea why both
// this file and the other one (in (tabs)) is required.
// Surely I'm not doing the provider twice... right??
import { useEffect, useRef, useState } from "react";
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

import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { GREAT_VIBES } from "~/components/digest/staticAssets";
import { UpdatePrompt } from "~/components/UpdatePrompt";
import { posthog } from "~/config/posthog";
import { useTheme } from "~/styles";
import { queryClient } from "~/utils/api";
import { authClient } from "~/utils/auth";

import "../styles.css";

// Last line of defence: catches render errors from any screen that doesn't
// have its own boundary. Without one, React Native aborts the process.
export const ErrorBoundary = createRouteErrorBoundary("root");

// Keep splash screen visible while fonts load
void SplashScreen.preventAutoHideAsync();

/** Hide Expo Dev Client floating Tools/gear FAB — double chrome vs Settings tab. */
function hideExpoToolsFab() {
  if (!__DEV__) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => {
        setPreferencesAsync?: (s: Record<string, unknown>) => Promise<void>;
      } | null;
    };
    const prefs = requireOptionalNativeModule("DevMenuPreferences");
    void prefs?.setPreferencesAsync?.({ showFloatingActionButton: false });
  } catch {
    // release builds / missing native module
  }
}
hideExpoToolsFab();

/**
 * Routes whose top edge is the cream paper surface rather than night canvas.
 *
 * The clock and battery are drawn by iOS in one colour for the whole app —
 * this build has no per-view-controller status bar appearance — so a single
 * owner has to pick it from the route. The digest is night canvas nearly
 * everywhere and wants light glyphs; the article reader is the one cream page
 * and wants dark ones. A screen that switches to a paper surface belongs here.
 */
const PAPER_ROUTES = new Set(["/article-detail"]);

function statusBarStyleFor(pathname: string): "light" | "dark" {
  return PAPER_ROUTES.has(pathname) ? "dark" : "light";
}

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
  /**
   * Text painted before the faces register keeps the system fallback until
   * something re-renders it — which static chrome never does. Hold the tree
   * behind the splash until loading resolves so every glyph starts correct.
   */
  const [fontsReady, setFontsReady] = useState(false);

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
          "GreatVibes-Regular": GREAT_VIBES,
          GreatVibes: GREAT_VIBES,
        });
      } catch (e) {
        // Font loading failure is non-fatal — app falls back to system fonts
        console.warn("Font loading failed:", e);
      } finally {
        // Set even on failure: system fallbacks beat a stuck splash screen.
        setFontsReady(true);
        await SplashScreen.hideAsync();
      }
    }
    void loadFonts();
  }, []);

  if (!fontsReady) return null;

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
          >
            <Stack.Screen name="(tabs)" />
          </Stack>
          {/* Absolute overlay: update banner sits above Stack without affecting tab/stack layout */}
          <UpdatePrompt />
          <StatusBar style={statusBarStyleFor(pathname)} />
        </GestureHandlerRootView>
      </PostHogProvider>
    </QueryClientProvider>
  );
}
