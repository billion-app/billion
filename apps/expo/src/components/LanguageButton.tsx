import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "~/components/ui/Icon";
import { useLanguage } from "~/hooks/useLanguage";
import { LANGUAGE_OPTIONS } from "~/i18n/language";
import {
  BillReaderPalette,
  fontBody,
  fontDisplay,
  hair,
  DigestPalette as P,
} from "~/styles";
import { whenSplashHidden } from "~/utils/splash-gate";

// One introduction per cold launch, shared across header mounts and navigation.
let introductionEndsAt: number | undefined;
const INTRODUCTION_MS = 2400;
const AnimatedLanguageButton =
  Animated.createAnimatedComponent(TouchableOpacity);

/** For standalone recovery screens without a navigation header. */
export function LanguageCorner() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: "absolute", top: insets.top + 8, right: 16 }}>
      <LanguageButton compact />
    </View>
  );
}

/** Shared by headers and readers; choosing a language never navigates away. */
export function LanguageButton({
  compact = false,
  tone = "dark",
}: {
  compact?: boolean;
  tone?: "dark" | "paper" | "reader";
}) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const [textWidth, setTextWidth] = useState(0);
  const labelWidth = textWidth > 0 ? textWidth + 6 + (compact ? 0 : 20) : 0;
  const reveal = useSharedValue(
    !reduceMotion &&
      (introductionEndsAt === undefined || Date.now() < introductionEndsAt)
      ? 1
      : 0,
  );
  useEffect(() => {
    let disposed = false;
    if (labelWidth === 0) return;
    void whenSplashHidden().then(() => {
      if (disposed) return;
      introductionEndsAt ??= Date.now() + INTRODUCTION_MS;
      if (reduceMotion) {
        reveal.value = 0;
        return;
      }
      const remaining = introductionEndsAt - Date.now();
      if (remaining <= 0) {
        reveal.value = 0;
        return;
      }
      reveal.value = withDelay(
        remaining,
        withTiming(0, {
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
    });
    return () => {
      disposed = true;
      cancelAnimation(reveal);
    };
  }, [labelWidth, reduceMotion, reveal]);
  const labelStyle = useAnimatedStyle(() => ({
    width: labelWidth * reveal.value,
    opacity: reveal.value,
    transform: [{ translateX: 8 * (1 - reveal.value) }],
  }));
  const reader = tone === "reader";
  const buttonStyle = useAnimatedStyle(() => ({
    width: 44 + labelWidth * reveal.value,
    backgroundColor: reader
      ? "transparent"
      : interpolateColor(
          reveal.value,
          [0, 1],
          tone === "paper"
            ? ["rgba(134,105,24,0)", "rgba(134,105,24,0.08)"]
            : ["rgba(212,175,55,0)", "rgba(212,175,55,0.12)"],
        ),
    borderColor: reader
      ? "transparent"
      : interpolateColor(
          reveal.value,
          [0, 1],
          tone === "paper"
            ? ["rgba(134,105,24,0)", "rgba(134,105,24,0.45)"]
            : ["rgba(212,175,55,0)", "rgba(212,175,55,0.55)"],
        ),
  }));
  const current = LANGUAGE_OPTIONS.find((option) => option.id === language);
  const label =
    language === "zh"
      ? "中文"
      : language === "es"
        ? "Español"
        : "中文 · Español";
  return (
    <>
      <AnimatedLanguageButton
        activeOpacity={0.7}
        style={[
          s.button,
          tone === "paper" && s.paper,
          reader && s.reader,
          buttonStyle,
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("language.change", {
          language: current?.nativeName ?? "English",
        })}
        accessibilityState={{ expanded: open }}
        accessibilityHint="English · 中文 · Español"
        testID="reader-language"
      >
        <View style={s.globe} pointerEvents="none">
          <Icon
            name="globe"
            size={17}
            color={
              tone === "paper"
                ? P.ink
                : reader
                  ? BillReaderPalette.muted
                  : P.spark
            }
          />
        </View>
        <Animated.View
          style={[s.labelClip, labelStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <View style={[s.labelRow, { width: labelWidth }]}>
            <Text
              style={[
                s.label,
                { width: textWidth },
                tone === "paper" && s.paperLabel,
                reader && { color: BillReaderPalette.text },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {!compact && (
              <Icon
                name="chevD"
                size={14}
                color={tone === "paper" ? P.ink : P.quiet}
              />
            )}
          </View>
        </Animated.View>
        <Text
          style={[s.label, s.measureLabel, { width: screenWidth }]}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          numberOfLines={1}
          onTextLayout={(event) => {
            const measured = Math.ceil(event.nativeEvent.lines[0]?.width ?? 0);
            if (measured > 0 && measured !== textWidth) setTextWidth(measured);
          }}
        >
          {label}
        </Text>
      </AnimatedLanguageButton>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            s.overlay,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          />
          <View style={s.menu} accessibilityViewIsModal>
            <ScrollView
              contentContainerStyle={s.menuContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.heading} accessibilityRole="header">
                {t("language.choose")}
              </Text>
              <Text style={s.note}>{t("language.appNote")}</Text>
              <View accessibilityRole="radiogroup" style={s.options}>
                {LANGUAGE_OPTIONS.map((option) => {
                  const selected = language === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      style={({ pressed }) => [
                        s.option,
                        selected && s.selected,
                        pressed && s.pressed,
                      ]}
                      onPress={() => {
                        setLanguage(option.id);
                        setOpen(false);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      accessibilityLabel={option.nativeName}
                      testID={`reader-language-${option.id}`}
                    >
                      <Text style={s.optionName}>{option.nativeName}</Text>
                      {selected && (
                        <Icon name="check" size={18} color={P.spark} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={s.cancel}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
              >
                <Text style={s.cancelLabel}>{t("common.cancel")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    borderRadius: 22,
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  globe: { position: "absolute", right: 12 },
  measureLabel: { position: "absolute", opacity: 0 },
  labelClip: { position: "absolute", left: 12, overflow: "hidden" },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 6,
    gap: 6,
  },
  reader: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  paper: {
    backgroundColor: "rgba(134,105,24,0.08)",
    borderColor: "rgba(134,105,24,0.45)",
  },
  label: { color: P.inkOnNight, fontFamily: fontBody.medium, fontSize: 14 },
  paperLabel: { color: P.ink },
  pressed: { opacity: 0.7 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  menu: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: P.night,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hair[2],
    overflow: "hidden",
  },
  menuContent: { padding: 20, gap: 12 },
  heading: { color: P.inkOnNight, fontFamily: fontDisplay.bold, fontSize: 20 },
  note: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  options: { gap: 8 },
  option: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[2],
  },
  selected: {
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  optionName: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 16,
  },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelLabel: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 14 },
});
