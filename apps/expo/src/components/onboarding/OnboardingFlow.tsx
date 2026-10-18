/**
 * Four pages on one filmstrip. The last beat is a sheet, not a fifth page.
 */
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMutation } from "@tanstack/react-query";

import type { AppStringKey, AppTranslate } from "~/i18n/app-strings";
import type { Sector, TrackingVector } from "~/utils/onboarding-store";
import { requestGreetingPlay } from "~/components/DigestGreetingBar";
import { LanguageButton } from "~/components/LanguageButton";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useNotificationPrefs } from "~/hooks/useNotificationPrefs";
import { useOnboarding } from "~/hooks/useOnboarding";
import {
  DigestRadii,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";
import { notificationChoicesForOnboarding } from "~/utils/notification-prefs";
import { MIN_SECTORS, SECTOR_SHORT, toggleIn } from "~/utils/onboarding-store";
import { ArriveStage } from "./ArriveStage";
import { Orb } from "./Orb";
import { TopicOrb } from "./TopicOrb";
import { WelcomeStage } from "./WelcomeStage";
import { WhiteHouseSpin } from "./WhiteHouseSpin";

const PAGES = 4;
const SLIDE = Easing.bezier(0.22, 1, 0.36, 1);
const SLIDE_MS = 320;

const WATCH: { id: TrackingVector; label: AppStringKey }[] = [
  { id: "congress", label: "onboarding.watch.congress" },
  { id: "state", label: "place.ca.name" },
  { id: "executive", label: "onboarding.watch.executive" },
  { id: "courts", label: "onboarding.watch.courts" },
];

/** `SECTOR_SHORT` stays English: it is the stored topic, not the label. */
const TOPICS: { id: Sector; label: AppStringKey }[] = [
  { id: "technology", label: "onboarding.sector.technology" },
  { id: "energy", label: "onboarding.sector.energy" },
  { id: "fiscal", label: "onboarding.sector.fiscal" },
  { id: "healthcare", label: "onboarding.sector.healthcare" },
  { id: "infrastructure", label: "onboarding.sector.infrastructure" },
  { id: "defense", label: "onboarding.sector.defense" },
];

function watchLine(
  ids: TrackingVector[],
  t: AppTranslate,
  formatList: (items: string[]) => string,
) {
  const names = WATCH.filter((w) => ids.includes(w.id)).map((w) => t(w.label));
  if (names.length === 0) return t("onboarding.watchNone");
  return t("onboarding.watchList", { list: formatList(names) });
}

export function OnboardingFlow() {
  const { t, formatList } = useAppTranslation();
  const { update: updateNotificationPrefs } = useNotificationPrefs();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const router = useRouter();
  const onboarding = useOnboarding();
  const session = authClient.useSession();
  const setPrefs = useMutation(trpc.user.setPreferences.mutationOptions());

  const [index, setIndex] = useState(0);
  const [vectors, setVectors] = useState<TrackingVector[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [instant, setInstant] = useState(false);
  const [evening, setEvening] = useState(false);
  const [explore, setExplore] = useState(false);

  const page = useSharedValue(0);
  const drag = useSharedValue(0);

  const watchSize = Math.min(118, (width - 80) / 2);
  const topicSize = Math.min(96, (width - 40) / 3 - 6);

  const go = useCallback(
    (next: number) => {
      const i = Math.max(0, Math.min(PAGES - 1, next));
      setIndex(i);
      page.value = withTiming(i, {
        duration: reduce ? 0 : SLIDE_MS,
        easing: SLIDE,
      });
      drag.value = 0;
    },
    [drag, page, reduce],
  );

  const gated = (from: number, dir: number) => {
    if (dir > 0 && from === 1 && vectors.length < 1) return true;
    if (dir > 0 && from === 2 && sectors.length < MIN_SECTORS) return true;
    if (dir > 0 && from === 3 && !(instant || evening)) return true;
    return false;
  };

  const swipeTo = (next: number) => {
    if (gated(index, next - index)) return;
    if (next >= PAGES) {
      if (instant || evening) setExplore(true);
      return;
    }
    go(next);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      drag.value = e.translationX;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const current = Math.round(page.value);
      drag.value = withTiming(0, { duration: 180, easing: SLIDE });
      if (dx < -56) runOnJS(swipeTo)(current + 1);
      else if (dx > 56) runOnJS(swipeTo)(current - 1);
    });

  const track = useAnimatedStyle(() => ({
    transform: [{ translateX: -page.value * width + drag.value }],
  }));

  const progress = useAnimatedStyle(() => ({
    width: `${((page.value + 1) / PAGES) * 100}%`,
  }));

  const finish = useCallback(
    (
      deferred: boolean,
      next?: {
        vectors: TrackingVector[];
        sectors: Sector[];
        instant: boolean;
        evening: boolean;
      },
    ) => {
      const v = next?.vectors ?? vectors;
      const sec = next?.sectors ?? sectors;
      const inst = next?.instant ?? instant;
      const eve = next?.evening ?? evening;
      updateNotificationPrefs(notificationChoicesForOnboarding(v, inst, eve));
      onboarding.update({
        completed: true,
        deferredClaim: deferred,
        vectors: v,
        sectors: sec,
        topics: sec.map((id) => SECTOR_SHORT[id]),
        alerts: { instant: inst, digest: eve },
      });
      if (session.data?.user) {
        setPrefs.mutate({
          topics: sec.map((id) => SECTOR_SHORT[id]),
          contentTypes: [
            ...(v.includes("congress") || v.includes("state") ? ["bill"] : []),
            ...(v.includes("executive") ? ["exec"] : []),
            ...(v.includes("courts") ? ["court"] : []),
          ],
        });
      }
      posthog.capture("onboarding_complete", {
        vectors: v,
        sectors: sec,
        instant: inst,
        evening: eve,
      });
      void requestGreetingPlay().then(() => {
        router.replace("/(tabs)");
      });
    },
    [
      updateNotificationPrefs,
      evening,
      instant,
      onboarding,
      router,
      sectors,
      session.data?.user,
      setPrefs,
      vectors,
    ],
  );

  const pick = <T,>(list: T[], value: T, set: (n: T[]) => void) => {
    set(toggleIn(list, value));
  };

  const canGo =
    index === 0 ||
    (index === 1 && vectors.length > 0) ||
    (index === 2 && sectors.length >= MIN_SECTORS) ||
    (index === 3 && (instant || evening));

  const pad = { paddingHorizontal: 20, paddingTop: insets.top + 72 };

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[s.track, { width: width * PAGES, height }, track]}
        >
          <WelcomeStage
            key={index === 0 ? "welcome-on" : "welcome-off"}
            width={width}
            height={height}
            bottom={Math.max(insets.bottom, 16) + 88}
            active={index === 0}
          />

          <View
            style={[
              { width, height },
              pad,
              { paddingBottom: Math.max(insets.bottom, 16) + 92 },
            ]}
          >
            <Text style={s.headline} accessibilityRole="header">
              {t("onboarding.watchHeadline")}
            </Text>
            <Text style={s.dek}>{t("onboarding.watchDek")}</Text>
            <View style={s.grid2}>
              {WATCH.map((item) => (
                <View key={item.id} style={s.watchCell}>
                  <Orb
                    id={item.id}
                    label={t(item.label)}
                    selected={vectors.includes(item.id)}
                    size={watchSize}
                    onPress={() => pick(vectors, item.id, setVectors)}
                  />
                </View>
              ))}
            </View>
            <View style={s.watchEcho}>
              <Text
                style={[s.echo, vectors.length > 0 && s.echoOn]}
                accessibilityLiveRegion="polite"
              >
                {watchLine(vectors, t, formatList)}
              </Text>
            </View>
            <View style={s.watchFigure}>
              <WhiteHouseSpin
                active={index === 1}
                width={width - 40}
                watch={vectors.length}
                topics={0}
              />
            </View>
          </View>

          <View
            style={[
              { width, height },
              pad,
              { paddingBottom: Math.max(insets.bottom, 16) + 92 },
            ]}
          >
            <Text style={s.headline} accessibilityRole="header">
              {t("onboarding.followHeadline")}
            </Text>
            <Text style={s.dek} accessibilityLiveRegion="polite">
              {sectors.length >= MIN_SECTORS
                ? t("onboarding.followEnough")
                : t("onboarding.followMark", { count: MIN_SECTORS })}
            </Text>
            <View style={s.grid3}>
              {TOPICS.map((item) => (
                <TopicOrb
                  key={item.id}
                  id={item.id}
                  label={t(item.label)}
                  selected={sectors.includes(item.id)}
                  size={topicSize}
                  onPress={() => pick(sectors, item.id, setSectors)}
                />
              ))}
            </View>
            <View style={s.watchFigure}>
              <WhiteHouseSpin
                active={index === 2}
                width={width - 40}
                watch={Math.max(
                  vectors.length,
                  Math.min(4, sectors.length + 1),
                )}
                topics={sectors.length}
              />
            </View>
          </View>

          <View
            style={[
              { width, height },
              pad,
              { paddingBottom: Math.max(insets.bottom, 16) + 92 },
            ]}
          >
            <ArriveStage
              active={index === 3}
              instant={instant}
              evening={evening}
              onInstant={() => {
                setInstant((v) => !v);
              }}
              onEvening={() => {
                setEvening((v) => !v);
              }}
            />
          </View>
        </Animated.View>
      </GestureDetector>

      <View
        style={[s.progressTrack, { top: insets.top + 6 }]}
        pointerEvents="none"
      >
        <Animated.View style={[s.progress, progress]} />
      </View>

      <View
        style={{
          position: "absolute",
          top: insets.top + 14,
          right: 20,
          zIndex: 10,
        }}
      >
        <LanguageButton />
      </View>

      {!explore ? (
        <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={() => {
              if (index === 0) {
                finish(true, {
                  vectors: ["congress"],
                  sectors: ["technology", "energy", "healthcare"],
                  instant: true,
                  evening: true,
                });
                return;
              }
              go(index - 1);
            }}
            accessibilityRole="button"
          >
            <Text style={s.skip}>
              {index === 0 ? t("common.skip") : t("common.back")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!canGo) return;
              if (index === PAGES - 1) {
                setExplore(true);
                return;
              }
              go(index + 1);
            }}
            disabled={!canGo}
            style={[s.cta, !canGo && s.ctaOff]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGo }}
          >
            <Text style={[s.ctaText, !canGo && s.ctaTextOff]}>
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ExploreSheet
        visible={explore}
        onExplore={() => {
          posthog.capture("onboarding_auth", { path: "explore" });
          finish(true);
        }}
      />
    </View>
  );
}

function ExploreSheet({
  visible,
  onExplore,
}: {
  visible: boolean;
  onExplore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "already" | "error"
  >("idle");
  const [error, setError] = useState("");
  const { language, t: tr } = useAppTranslation();
  const t = useSharedValue(0);

  const subscribe = async () => {
    if (status === "loading") return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setStatus("error");
      setError(tr("onboarding.invalidEmail"));
      return;
    }

    setStatus("loading");
    setError("");
    posthog.capture("mailing_list_form_submitted", {
      form_location: "onboarding",
    });

    try {
      const response = await fetch(`${getBaseUrl()}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = (await response.json().catch(() => null)) as {
        result?: "joined" | "already_joined";
        error?: string;
      } | null;
      if (!response.ok || !data?.result) {
        // The waitlist API answers in English; other languages get our copy.
        const message =
          language === "en" && data?.error
            ? data.error
            : tr("onboarding.genericError");
        setStatus("error");
        setError(message);
        posthog.capture("mailing_list_signup_error", {
          form_location: "onboarding",
          error: data?.error ?? "unknown",
        });
        return;
      }

      const alreadyJoined = data.result === "already_joined";
      setStatus(alreadyJoined ? "already" : "success");
      setEmail("");
      posthog.capture(
        alreadyJoined ? "mailing_list_already_joined" : "mailing_list_joined",
        { form_location: "onboarding" },
      );
    } catch {
      setStatus("error");
      setError(tr("onboarding.genericError"));
      posthog.capture("mailing_list_signup_error", {
        form_location: "onboarding",
        error: "network_error",
      });
    }
  };

  useEffect(() => {
    t.value = withTiming(visible ? 1 : 0, {
      duration: reduce ? 0 : visible ? 480 : 280,
      easing: SLIDE,
    });
  }, [reduce, t, visible]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0, 1]),
  }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [420, 0]) }],
  }));

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      style={s.sheetRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      pointerEvents="auto"
    >
      <Animated.View style={[s.sheetFill, backdrop]} pointerEvents="none">
        <BlurView intensity={22} tint="dark" style={s.sheetFill} />
        <View style={s.sheetScrim} />
      </Animated.View>
      <Animated.View
        style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 22) }, sheet]}
      >
        <View style={s.grabber} />
        <Text style={s.sheetKicker} accessibilityRole="header">
          {tr("onboarding.soonKicker")}
        </Text>
        <Text style={s.sheetDescription}>{tr("onboarding.mailingList")}</Text>
        {status === "success" || status === "already" ? (
          <Text
            style={s.signupSuccess}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
          >
            {status === "already"
              ? tr("onboarding.alreadyOnList")
              : tr("onboarding.onList")}
          </Text>
        ) : (
          <View>
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (status === "error") setStatus("idle");
              }}
              onSubmitEditing={() => void subscribe()}
              editable={status !== "loading"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              placeholder={tr("onboarding.emailPlaceholder")}
              placeholderTextColor={P.quiet}
              accessibilityLabel={tr("onboarding.emailA11y")}
              style={s.emailInput}
            />
            <Pressable
              onPress={() => void subscribe()}
              disabled={status === "loading"}
              accessibilityRole="button"
              accessibilityState={{
                disabled: status === "loading",
                busy: status === "loading",
              }}
              style={[s.subscribeBtn, status === "loading" && s.ctaOff]}
            >
              <Text style={s.subscribeText}>
                {status === "loading"
                  ? tr("onboarding.submitting")
                  : tr("onboarding.subscribe")}
              </Text>
            </Pressable>
            {status === "error" ? (
              <Text style={s.signupError} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </View>
        )}
        <Pressable
          onPress={onExplore}
          accessibilityRole="button"
          accessibilityLabel={tr("onboarding.startExploring")}
          style={s.exploreBtn}
        >
          <Text style={s.exploreText}>{tr("onboarding.startExploring")}</Text>
          <Text style={s.exploreArrow}>→</Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.night, overflow: "hidden" },
  track: { flexDirection: "row" },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: P.inkOnNight,
  },
  dek: {
    marginTop: 10,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 22,
    color: P.quiet,
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    rowGap: 10,
  },
  watchCell: {
    width: "50%",
    alignItems: "center",
  },
  watchEcho: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  watchFigure: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  echo: {
    fontFamily: fontDisplay.regular,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: "rgba(247,244,238,0.32)",
  },
  echoOn: { color: P.inkOnNight },
  grid3: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginTop: 16,
    rowGap: 12,
  },
  progressTrack: {
    position: "absolute",
    left: 20,
    right: 20,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(247,244,238,0.16)",
  },
  progress: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.spark,
  },
  bar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skip: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: P.quiet,
    paddingVertical: 14,
    paddingRight: 8,
  },
  cta: {
    flex: 1,
    backgroundColor: P.paper,
    borderRadius: DigestRadii.menu,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaOff: { backgroundColor: P.stone },
  ctaText: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.ink,
  },
  ctaTextOff: { color: P.quiet },
  sheetRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 60,
  },
  sheetFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(14,21,48,0.28)",
  },
  sheet: {
    backgroundColor: P.paper,
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22,19,26,0.14)",
    marginBottom: 22,
  },
  sheetKicker: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: P.ink,
  },
  sheetDescription: {
    marginTop: 10,
    marginBottom: 18,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 21,
    color: P.stone,
  },
  emailInput: {
    height: 52,
    borderRadius: DigestRadii.menu,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 18,
    fontFamily: fontBody.regular,
    fontSize: 16,
    color: P.ink,
  },
  subscribeBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: DigestRadii.menu,
    backgroundColor: P.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeText: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.paper,
  },
  signupSuccess: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: DigestRadii.menu,
    backgroundColor: "rgba(74,124,255,0.12)",
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: P.primary,
  },
  signupError: {
    marginTop: 8,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: "#B42318",
  },
  exploreBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: P.night,
    borderRadius: DigestRadii.menu,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  exploreText: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.paper,
  },
  exploreArrow: {
    fontFamily: fontDisplay.regular,
    fontSize: 22,
    color: P.spark,
  },
});
