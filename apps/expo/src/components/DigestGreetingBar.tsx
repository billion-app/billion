import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { B_PATHS } from "~/components/BillionMarkPaths";
import {
  PROFILE_MARK_SIZE,
  ProfileFace,
  ProfileMenu,
  useProfileIdentity,
} from "~/components/DigestProfileMark";
import { useUserAddress } from "~/hooks/useUserAddress";
import { fontBody, DigestPalette as P } from "~/styles";

const CANVAS = P.night;
const NAVY = P.night;
const INK = P.inkOnNight;
const MUTED = P.quiet;
const ELECTRIC = P.spark;
const CARD_MENU = P.stone;

/** Compact settled top bar (below safe area). */
const COMPACT_INNER = 48;
/**
 * Curtain depth below safe area while greeting plays.
 * Tall enough to cover "Today's local news" and reach into the feed cards.
 */
const CURTAIN_INNER = 300;
const CHAR_MS = 44;
const START_DELAY_MS = 500;
const DROP_MS = 720;
const HOLD_AFTER_TYPE_MS = 500;
/** Morph formation (greeting → centered B + Billion lockup). */
const FORM_MS = 1000;
/** Pause on centered lockup before slide (read location line). */
const HOLD_LOCKUP_MS = 620;
/** Slide left + curtain retract + scale-down. */
const SLIDE_MS = 780;
/** Settled compact mark / brand (quiet header geometry). */
const MARK_SIZE = 18;
const BRAND_SIZE = 17;
/** Centered hold scale (mark/brand ~1.78× settled); slides down to 1. */
const CENTER_SCALE = 1.78;
/** Generous fallback until onLayout measures the real (unscaled) lockup. */
const LOCKUP_W = 148;
const LOCKUP_H = 22;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const LOCATION_GAP = 14;

/**
 * The profile mark takes its top-right seat as part of the settle rather than
 * flying in on its own beat: the header assembles in one motion, and the
 * greeting carries the name itself when there is a session to read it from.
 */
const AVATAR_SETTLED = PROFILE_MARK_SIZE;

/**
 * GAP: no city-list / district procedure. Hardcoded East Bay city names
 * were removed — they are not real jurisdictions. Location chrome uses the
 * saved Places address via useUserAddress (set on Elections).
 */
const SLIDE_EASE = Easing.inOut(Easing.cubic);

type Period = "morning" | "afternoon" | "evening" | "night";
type Freeze = "typing" | "dropped" | "settled" | "morph" | "lockup" | null;

const PERIOD_LABEL: Record<Period, string> = {
  morning: "Good Morning",
  afternoon: "Good Afternoon",
  evening: "Good Evening",
  night: "Good Night",
};

function periodFor(date: Date): Period {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function storageKey(period: Period, date: Date): string {
  return `billion.greet.${period}.${dayKey(date)}`;
}

/** Set before leaving onboarding so the home ceremony runs on first landing. */
export const GREET_AFTER_ONBOARDING = "billion.greet.afterOnboarding";

export async function requestGreetingPlay(): Promise<void> {
  try {
    await AsyncStorage.setItem(GREET_AFTER_ONBOARDING, "1");
  } catch {
    /* ignore */
  }
}

function greetFreeze(): Freeze {
  const v = process.env.EXPO_PUBLIC_GREET_FREEZE;
  if (
    v === "typing" ||
    v === "dropped" ||
    v === "settled" ||
    v === "morph" ||
    v === "lockup"
  ) {
    return v;
  }
  return null;
}

const springDown = { damping: 18, stiffness: 120, mass: 0.9 };

const AnimatedText = Animated.createAnimatedComponent(Text);

function BillionMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {B_PATHS.map((d, i) => (
        <Path key={i} d={d} fill={color} />
      ))}
    </Svg>
  );
}

/** Best-effort city/locality from a Google Places formatted address. */
function localityFromAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  // "123 Main St, City, ST ZIP, USA" → City (second segment when street-like)
  const first = parts[0];
  if (parts.length >= 2 && first && /\d/.test(first)) {
    return parts[1] ?? null;
  }
  return first ?? null;
}

export function DigestGreetingBar() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const period = useMemo(() => periodFor(now), [now]);
  const freeze = greetFreeze();
  const screenW = Dimensions.get("window").width;

  const [ready, setReady] = useState(false);
  const [playCeremony, setPlayCeremony] = useState(false);
  const [typed, setTyped] = useState("");
  const [settledUI, setSettledUI] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [locationOpen, setLocationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const {
    name: profileName,
    firstName,
    initials: profileInitials,
  } = useProfileIdentity();
  /** Personalised only when a session actually supplies a name. */
  const greeting = firstName
    ? `${PERIOD_LABEL[period]}, ${firstName}`
    : PERIOD_LABEL[period];
  const router = useRouter();
  const { address, isLoading: addressLoading } = useUserAddress();
  const location =
    localityFromAddress(address) ?? (addressLoading ? "…" : "Set your address");
  const runIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const coordsFrozenRef = useRef(false);
  const measuredWRef = useRef(LOCKUP_W);
  const measuredHRef = useRef(LOCKUP_H);

  const drop = useSharedValue(0);
  const expand = useSharedValue(0);
  const morph = useSharedValue(0);
  const slide = useSharedValue(0);

  const lockupWSV = useSharedValue(LOCKUP_W);
  const lockupHSV = useSharedValue(LOCKUP_H);
  const startLeftSV = useSharedValue(Math.max(0, (screenW - LOCKUP_W) / 2));
  const startTopSV = useSharedValue(0);
  const endLeftSV = useSharedValue(PAD_LEFT);
  const endTopSV = useSharedValue(0);

  const compactH = insets.top + COMPACT_INNER;
  const curtainH = insets.top + CURTAIN_INNER;

  // Re-evaluate the period when the app returns from the background and
  // periodically while it remains open. Without this, a session opened in
  // the morning could never transition into the afternoon greeting.
  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshNow();
    });
    const timer = setInterval(refreshNow, 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  const writeCoords = (w: number, h: number) => {
    startLeftSV.value = Math.max(0, (screenW - w) / 2);
    startTopSV.value = insets.top + Math.max(0, (CURTAIN_INNER - h) / 2);
    endLeftSV.value = PAD_LEFT;
    endTopSV.value = insets.top + (COMPACT_INNER - h) / 2;
    lockupWSV.value = w;
    lockupHSV.value = h;
  };

  // Seed end/start tops once insets/curtain known (pre-measure).
  useEffect(() => {
    if (coordsFrozenRef.current) return;
    writeCoords(measuredWRef.current, measuredHRef.current);
    // writeCoords mutates shared values; stable for the bar lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional layout seed
  }, [screenW, curtainH, insets.top]);

  const clearTimers = () => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  };

  const schedule = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const freezeCoords = () => {
    coordsFrozenRef.current = true;
    writeCoords(measuredWRef.current, measuredHRef.current);
  };

  const beginMorph = (runId: number) => {
    if (runIdRef.current !== runId) return;
    morph.value = withTiming(1, {
      duration: FORM_MS,
      easing: Easing.inOut(Easing.cubic),
    });
    schedule(
      () => {
        if (runIdRef.current !== runId) return;
        setShowGreeting(false);
      },
      Math.round(FORM_MS * 0.38),
    );
    schedule(() => {
      if (runIdRef.current !== runId) return;
      freezeCoords();
      const slideCfg = { duration: SLIDE_MS, easing: SLIDE_EASE };
      slide.value = withTiming(1, slideCfg);
      expand.value = withTiming(0, slideCfg);
      schedule(() => {
        if (runIdRef.current !== runId) return;
        setSettledUI(true);
      }, SLIDE_MS + 20);
    }, FORM_MS + HOLD_LOCKUP_MS);
  };

  const typeNext = (full: string, i: number, runId: number) => {
    if (runIdRef.current !== runId) return;
    if (i >= full.length) {
      schedule(() => beginMorph(runId), HOLD_AFTER_TYPE_MS);
      return;
    }
    setTyped(full.slice(0, i + 1));
    schedule(() => typeNext(full, i + 1, runId), CHAR_MS);
  };

  const day = dayKey(now);

  useEffect(() => {
    let cancelled = false;

    async function decide() {
      let play: boolean;
      try {
        const pending = await AsyncStorage.getItem(GREET_AFTER_ONBOARDING);
        if (pending) {
          play = true;
          await AsyncStorage.removeItem(GREET_AFTER_ONBOARDING);
        } else {
          const seen = await AsyncStorage.getItem(storageKey(period, now));
          play = seen == null;
        }
      } catch {
        play = true;
      }
      if (cancelled) return;
      setPlayCeremony(play);
      setReady(true);
      if (play) {
        try {
          await AsyncStorage.setItem(storageKey(period, now), "1");
        } catch {
          /* ignore */
        }
      }
    }

    void decide();
    return () => {
      cancelled = true;
    };
  }, [period, day, now]);

  useEffect(() => {
    if (!ready) return;

    runIdRef.current += 1;
    const runId = runIdRef.current;
    clearTimers();
    coordsFrozenRef.current = false;
    writeCoords(measuredWRef.current, measuredHRef.current);

    const applyFreezeFrame = (
      nextSettled: boolean,
      nextShowGreeting: boolean,
      nextTyped: string,
    ) => {
      // Defer so we don't trip react-hooks/set-state-in-effect on sync paths.
      queueMicrotask(() => {
        if (runIdRef.current !== runId) return;
        setSettledUI(nextSettled);
        setShowGreeting(nextShowGreeting);
        setTyped(nextTyped);
      });
    };

    if (freeze === "typing" || freeze === "dropped") {
      drop.value = 1;
      expand.value = 1;
      morph.value = 0;
      slide.value = 0;
      const mid = Math.max(4, Math.floor(greeting.length * 0.55));
      applyFreezeFrame(false, true, greeting.slice(0, mid));
      return () => {
        runIdRef.current += 1;
        clearTimers();
      };
    }
    if (freeze === "morph") {
      drop.value = 1;
      expand.value = 1;
      morph.value = 0.45;
      slide.value = 0;
      applyFreezeFrame(false, false, greeting);
      return () => {
        runIdRef.current += 1;
        clearTimers();
      };
    }
    if (freeze === "lockup") {
      drop.value = 1;
      expand.value = 1;
      morph.value = 1;
      slide.value = 0;
      applyFreezeFrame(false, false, greeting);
      return () => {
        runIdRef.current += 1;
        clearTimers();
      };
    }
    if (freeze === "settled") {
      freezeCoords();
      drop.value = 1;
      expand.value = 0;
      morph.value = 1;
      slide.value = 1;
      applyFreezeFrame(true, false, greeting);
      return () => {
        runIdRef.current += 1;
        clearTimers();
      };
    }

    if (!playCeremony || reduceMotion) {
      freezeCoords();
      drop.value = 1;
      expand.value = 0;
      morph.value = 1;
      slide.value = 1;
      applyFreezeFrame(true, false, greeting);
      return () => {
        runIdRef.current += 1;
        clearTimers();
      };
    }

    drop.value = 0;
    expand.value = 1;
    morph.value = 0;
    slide.value = 0;
    applyFreezeFrame(false, true, "");

    schedule(() => {
      if (runIdRef.current !== runId) return;
      drop.value = withSpring(1, springDown);
    }, START_DELAY_MS);

    schedule(() => {
      if (runIdRef.current !== runId) return;
      typeNext(greeting, 0, runId);
    }, START_DELAY_MS + DROP_MS);

    return () => {
      runIdRef.current += 1;
      clearTimers();
    };
    // Ceremony shared values / helpers are stable for the bar lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional ceremony deps
  }, [ready, playCeremony, reduceMotion, greeting, freeze]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      clearTimers();
    },
    [],
  );

  const ceremonyMode =
    (playCeremony && !reduceMotion) ||
    freeze === "typing" ||
    freeze === "dropped" ||
    freeze === "morph" ||
    freeze === "lockup";

  const sheetStyle = useAnimatedStyle(() => {
    const height = interpolate(expand.value, [0, 1], [compactH, curtainH]);
    const slideIn = interpolate(drop.value, [0, 1], [-curtainH - 24, 0]);
    return {
      height,
      transform: [{ translateY: slideIn }],
      opacity: interpolate(drop.value, [0, 0.2, 1], [0, 1, 1]),
    };
  });

  const greetingStyle = useAnimatedStyle(() => {
    const t = morph.value;
    const scale = interpolate(
      t,
      [0, 0.2, 0.36],
      [1, 0.86, 0.7],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      t,
      [0, 0.12, 0.28, 0.36],
      [1, 0.85, 0.25, 0],
      Extrapolation.CLAMP,
    );
    const letterSpacing = interpolate(
      t,
      [0, 0.2, 0.36],
      [0.2, -1.2, -2.4],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      letterSpacing,
      transform: [{ scale }],
    };
  });

  const lockupStyle = useAnimatedStyle(() => {
    const t = morph.value;
    const s = slide.value;
    const opacity = interpolate(
      t,
      [0, 0.36, 0.48, 0.72, 1],
      [0, 0, 0.55, 1, 1],
      Extrapolation.CLAMP,
    );
    const formScale = interpolate(
      t,
      [0.36, 0.5, 0.75, 1],
      [0.78, 0.92, 1.02, 1],
      Extrapolation.CLAMP,
    );
    const holdOrSettled = interpolate(
      s,
      [0, 1],
      [CENTER_SCALE, 1],
      Extrapolation.CLAMP,
    );
    const scale = formScale * holdOrSettled;
    const left = interpolate(
      s,
      [0, 1],
      [startLeftSV.value, endLeftSV.value],
      Extrapolation.CLAMP,
    );
    const top = interpolate(
      s,
      [0, 1],
      [startTopSV.value, endTopSV.value],
      Extrapolation.CLAMP,
    );
    return {
      position: "absolute" as const,
      left,
      top,
      opacity,
      transform: [{ scale }],
    };
  });

  const locationStyle = useAnimatedStyle(() => {
    const t = morph.value;
    const s = slide.value;
    const fadeIn = interpolate(
      t,
      [0.7, 0.85, 1],
      [0, 0.7, 1],
      Extrapolation.CLAMP,
    );
    const fadeOut = interpolate(
      s,
      [0, 0.25, 0.55],
      [1, 0.45, 0],
      Extrapolation.CLAMP,
    );
    const h = lockupHSV.value;
    const centerY = insets.top + CURTAIN_INNER / 2;
    const top = centerY + (h * CENTER_SCALE) / 2 + LOCATION_GAP;
    return {
      opacity: fadeIn * fadeOut,
      top,
    };
  });

  /**
   * The mark holds its settled seat and simply resolves with the slide, so the
   * header arrives as one piece instead of two separate entrances.
   */
  const avatarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      slide.value,
      [0, 0.45, 1],
      [0, 0.15, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      slide.value,
      [0, 0.6, 1],
      [0.82, 0.97, 1],
      Extrapolation.CLAMP,
    );
    return {
      position: "absolute" as const,
      left: screenW - PAD_RIGHT - AVATAR_SETTLED,
      top: insets.top + (COMPACT_INNER - AVATAR_SETTLED) / 2,
      opacity,
      transform: [{ scale }],
    };
  });

  const markStyle = useAnimatedStyle(() => {
    const t = morph.value;
    const scale = interpolate(
      t,
      [0.36, 0.48, 0.7, 0.9],
      [0.25, 0.7, 1.06, 1],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      t,
      [0.36, 0.45, 0.58],
      [0, 0.7, 1],
      Extrapolation.CLAMP,
    );
    const rotate = interpolate(t, [0.4, 0.75], [-10, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const wordStyle = useAnimatedStyle(() => {
    const t = morph.value;
    const opacity = interpolate(
      t,
      [0.5, 0.65, 0.85],
      [0, 0.75, 1],
      Extrapolation.CLAMP,
    );
    const x = interpolate(t, [0.5, 0.7, 0.9], [14, 4, 0], Extrapolation.CLAMP);
    const scale = interpolate(
      t,
      [0.5, 0.7, 0.9],
      [0.84, 1.02, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateX: x }, { scale }],
    };
  });

  return (
    <>
      {/* In-flow spacer so feed sits under the compact bar */}
      <View
        style={{ height: compactH, backgroundColor: CANVAS }}
        pointerEvents="none"
      />
      {!ready ? null : (
        <Animated.View
          style={[styles.sheet, sheetStyle]}
          pointerEvents={settledUI || ceremonyMode ? "auto" : "none"}
          accessibilityRole="header"
        >
          <View style={styles.stage} pointerEvents="box-none">
            {showGreeting ? (
              <Animated.View
                style={[
                  styles.greetingLayer,
                  { top: insets.top, bottom: 0 },
                  greetingStyle,
                ]}
                pointerEvents="none"
              >
                <AnimatedText style={styles.greeting}>{typed}</AnimatedText>
              </Animated.View>
            ) : null}

            <Animated.View
              style={avatarStyle}
              pointerEvents={settledUI ? "auto" : "none"}
            >
              <Pressable
                disabled={!settledUI}
                onPress={() => {
                  if (settledUI) setProfileOpen(true);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  profileName
                    ? `Account: ${profileName}. Open feedback and settings`
                    : "Account. Open feedback and settings"
                }
                accessibilityState={{ expanded: profileOpen }}
                testID="digest-profile-mark"
              >
                <ProfileFace initials={profileInitials} size={AVATAR_SETTLED} />
              </Pressable>
            </Animated.View>

            <Animated.View
              style={lockupStyle}
              pointerEvents={settledUI ? "auto" : "none"}
            >
              <Pressable
                style={styles.lockup}
                disabled={!settledUI}
                onPress={() => {
                  if (settledUI) setLocationOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Billion, location ${location}. Change location`}
                accessibilityState={{ expanded: locationOpen }}
                testID="digest-location-lockup"
                onLayout={(e) => {
                  if (coordsFrozenRef.current) return;
                  const { width, height } = e.nativeEvent.layout;
                  const w = Math.ceil(width);
                  const h = Math.ceil(height);
                  if (w <= 0 || h <= 0) return;
                  if (
                    Math.abs(w - measuredWRef.current) < 1 &&
                    Math.abs(h - measuredHRef.current) < 1
                  ) {
                    return;
                  }
                  measuredWRef.current = w;
                  measuredHRef.current = h;
                  writeCoords(w, h);
                }}
              >
                <Animated.View style={[styles.markWrap, markStyle]}>
                  <BillionMark size={MARK_SIZE} color={ELECTRIC} />
                </Animated.View>
                <Animated.View style={[styles.wordRow, wordStyle]}>
                  <Text style={styles.brand}>Billion</Text>
                  <Text style={styles.caret}>▾</Text>
                </Animated.View>
              </Pressable>
            </Animated.View>

            <Animated.View
              style={[styles.locationLayer, locationStyle]}
              pointerEvents="none"
            >
              <Text style={styles.locationText}>
                Location set to:{" "}
                <Text style={styles.locationPlace}>{location}</Text>
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      <Modal
        visible={locationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationOpen(false)}
      >
        <View style={styles.menuRoot} pointerEvents="box-none">
          <Pressable
            style={styles.menuScrim}
            onPress={() => setLocationOpen(false)}
            accessibilityLabel="Close location menu"
          />
          <View
            style={[styles.menuCard, { top: compactH + 6, left: PAD_LEFT }]}
            accessibilityRole="menu"
          >
            <Text style={styles.menuTitle}>Location</Text>
            <View style={[styles.menuRow, styles.menuRowOn]}>
              <Text style={[styles.menuRowText, styles.menuRowTextOn]}>
                {address ? location : "No address saved"}
              </Text>
              {address ? <Text style={styles.menuCheck}>✓</Text> : null}
            </View>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setLocationOpen(false);
                router.push("/elections" as Href);
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Set address on Elections"
            >
              <Text style={styles.menuRowText}>
                {address ? "Change address…" : "Set address on Elections…"}
              </Text>
            </Pressable>
            {/* GAP: Places autocomplete lives on Elections; greeting does not
                invent a city/district picker. */}
          </View>
        </View>
      </Modal>

      <ProfileMenu
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        top={compactH + 6}
        name={profileName}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 40,
    backgroundColor: CANVAS,
    overflow: "hidden",
  },
  stage: {
    flex: 1,
  },
  greetingLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontFamily: Platform.select({
      ios: "Snell Roundhand",
      default: "GreatVibes-Regular",
    }),
    fontSize: 42,
    color: ELECTRIC,
    letterSpacing: 0.2,
    fontWeight: Platform.OS === "ios" ? "400" : undefined,
    textAlign: "center",
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
  },
  markWrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  brand: {
    fontFamily: fontBody.bold,
    fontSize: BRAND_SIZE,
    letterSpacing: -0.3,
    color: INK,
    flexShrink: 0,
  },
  caret: {
    fontFamily: fontBody.bold,
    fontSize: 12,
    color: MUTED,
    marginTop: 1,
  },
  locationLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  locationText: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: MUTED,
    letterSpacing: 0.1,
    textAlign: "center",
  },
  locationPlace: {
    fontFamily: fontBody.semibold,
    color: P.inkOnNight,
  },
  menuRoot: {
    flex: 1,
  },
  menuScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  menuCard: {
    position: "absolute",
    minWidth: 220,
    backgroundColor: CARD_MENU,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(247,244,238,0.12)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: NAVY,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  menuTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: MUTED,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuRowOn: {
    backgroundColor: "rgba(196,163,90,0.14)",
  },
  menuRowText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: INK,
  },
  menuRowTextOn: {
    color: ELECTRIC,
  },
  menuCheck: {
    fontFamily: fontBody.bold,
    fontSize: 14,
    color: ELECTRIC,
  },
});
