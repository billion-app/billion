/**
 * Page 4 — notifications, not photographs.
 * Two cadence cards. The stage above shows an iOS banner so the
 * tap has a consequence you can see.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

import { GoldBillionMark } from "~/components/GoldBillionMark";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestRadii,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";

const SLIDE = Easing.bezier(0.22, 1, 0.36, 1);
const SPRING = { dampingRatio: 0.78, duration: 520 } as const;

/** The evening brief's delivery hour, shown in the reader's clock format. */
const EVENING_HOUR = 19;
const EVENING_SAMPLE_COUNT = 3;

export function ArriveStage({
  active,
  instant,
  evening,
  onInstant,
  onEvening,
}: {
  active: boolean;
  instant: boolean;
  evening: boolean;
  onInstant: () => void;
  onEvening: () => void;
}) {
  const { t, formatTime } = useAppTranslation();
  const idle = !instant && !evening;
  const eveningAt = new Date(2000, 0, 1, EVENING_HOUR, 0);
  const instantBanners = [
    {
      time: t("onboarding.arriveNow"),
      title: t("onboarding.arriveSavedTitle"),
      body: t("onboarding.arriveSavedBody"),
    },
    {
      time: t("onboarding.arriveNow"),
      title: t("onboarding.arrivePlaceTitle", { place: t("place.ca.name") }),
      body: t("onboarding.arrivePlaceBody"),
    },
  ];
  const eveningBanner = {
    time: formatTime(eveningAt),
    title: t("onboarding.arriveEveningTitle"),
    body: t("onboarding.arriveEveningBody", { count: EVENING_SAMPLE_COUNT }),
  };

  return (
    <View style={s.root}>
      <Text style={s.headline} accessibilityRole="header">
        {t("onboarding.arriveHeadline")}
      </Text>
      <Text style={s.dek}>{t("onboarding.arriveDek")}</Text>

      <View style={s.stage}>
        {idle ? (
          <View style={s.ghost} accessibilityElementsHidden>
            <View style={s.mark}>
              <GoldBillionMark size={14} />
            </View>
            <View style={s.copy}>
              <View style={s.top}>
                <Text style={s.app}>BILLION</Text>
                <Text style={s.time}>{t("onboarding.arriveHere")}</Text>
              </View>
              <Text style={s.ghostTitle}>
                {t("onboarding.arriveGhostTitle")}
              </Text>
              <Text style={s.body}>{t("onboarding.arriveGhostBody")}</Text>
            </View>
          </View>
        ) : null}
        {instantBanners.map((n, i) => (
          <Banner
            key={`i-${i}`}
            show={active && instant}
            delay={i * 160}
            stack={i}
            time={n.time}
            title={n.title}
            body={n.body}
          />
        ))}
        <Banner
          show={active && evening}
          delay={instant ? 380 : 80}
          stack={instant ? 2 : 0}
          time={eveningBanner.time}
          title={eveningBanner.title}
          body={eveningBanner.body}
        />
      </View>

      <Choice
        title={t("onboarding.instantTitle")}
        hint={t("onboarding.instantHint")}
        selected={instant}
        onPress={onInstant}
      />
      <Choice
        title={t("onboarding.eveningTitle", {
          time: formatTime(eveningAt, { hour: "numeric" }),
        })}
        hint={t("onboarding.eveningHint")}
        selected={evening}
        onPress={onEvening}
      />
    </View>
  );
}

function Choice({
  title,
  hint,
  selected,
  onPress,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`${title}. ${hint}`}
      accessibilityState={{ checked: selected }}
      style={[s.card, selected && s.cardOn]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.choice, selected && s.choiceOn]}>{title}</Text>
        <Text style={[s.hint, selected && s.hintOn]}>{hint}</Text>
      </View>
      <View style={[s.tick, selected && s.tickOn]} />
    </Pressable>
  );
}

function Banner({
  show,
  delay,
  stack,
  time,
  title,
  body,
}: {
  show: boolean;
  delay: number;
  stack: number;
  time: string;
  title: string;
  body: string;
}) {
  const reduce = useReducedMotion();
  const y = useSharedValue(-28);
  const o = useSharedValue(0);

  useEffect(() => {
    if (show) {
      if (reduce) {
        y.value = stack * 76;
        o.value = 1;
        return;
      }
      y.value = -120;
      o.value = 0;
      y.value = withDelay(delay, withSpring(stack * 76, SPRING));
      o.value = withDelay(delay, withTiming(1, { duration: 180 }));
      return;
    }
    y.value = withTiming(-120, { duration: 280, easing: SLIDE });
    o.value = withTiming(0, { duration: 200 });
  }, [delay, o, reduce, show, stack, y]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View style={[s.bannerWrap, { zIndex: 4 - stack }, style]}>
      <BlurView intensity={36} tint="dark" style={s.banner}>
        <View style={s.mark}>
          <GoldBillionMark size={14} />
        </View>
        <View style={s.copy}>
          <View style={s.top}>
            <Text style={s.app}>BILLION</Text>
            <Text style={s.time}>{time}</Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body} numberOfLines={1}>
            {body}
          </Text>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
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
  stage: {
    flex: 1,
    marginTop: 24,
    marginBottom: 12,
    minHeight: 160,
  },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DigestRadii.menu,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.16)",
    borderStyle: "dashed",
  },
  ghostTitle: {
    marginTop: 2,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.quiet,
  },
  bannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: DigestRadii.menu,
    overflow: "hidden",
    backgroundColor: "rgba(39,45,60,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.14)",
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: P.night,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  app: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: P.quiet,
  },
  time: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: P.quiet,
  },
  title: {
    marginTop: 2,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
  },
  body: {
    marginTop: 1,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: DigestRadii.menu,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.14)",
  },
  cardOn: {
    borderWidth: 1.5,
    borderColor: P.spark,
  },
  choice: {
    fontFamily: fontDisplay.regular,
    fontSize: 20,
    letterSpacing: -0.3,
    color: P.inkOnNight,
  },
  choiceOn: { color: P.inkOnNight },
  hint: {
    marginTop: 3,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
  },
  hintOn: { color: P.quiet },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,244,238,0.28)",
  },
  tickOn: {
    borderWidth: 0,
    backgroundColor: P.spark,
  },
});
