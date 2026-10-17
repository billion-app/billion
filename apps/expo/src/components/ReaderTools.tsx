/**
 * Translation and read-aloud controls above a readable measure.
 *
 * The language button stays visible in every language and names Chinese and
 * Spanish in their own scripts, so a reader who cannot read English still
 * finds it. Translated text always carries one provenance line: machine
 * translated, quotes and sources left as published, and a way back to English.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { useArticleSpeech } from "~/hooks/useArticleSpeech";
import { useLanguage } from "~/hooks/useLanguage";
import { LANGUAGE_OPTIONS } from "~/i18n/language";
import { fontBody, fontDisplay, hair, DigestPalette as P } from "~/styles";
import { Icon } from "./ui/Icon";

const SPARK_TINT = "rgba(212,175,55,0.12)";
const SPARK_EDGE = "rgba(212,175,55,0.55)";

export function ReaderLanguageButton() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGE_OPTIONS.find((option) => option.id === language);
  return (
    <>
      <Pressable
        style={({ pressed }) => [s.button, s.translate, pressed && s.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Translate · 翻译 · Traducir · ${current?.nativeName ?? "English"}`}
        testID="reader-language"
      >
        <Icon name="globe" size={17} color={P.spark} />
        <Text style={s.label} numberOfLines={1}>
          {language === "en"
            ? "中文 · Español"
            : language === "zh"
              ? "中文"
              : "Español"}
        </Text>
        <Icon name="chevD" size={14} color={P.quiet} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          />
          <View style={s.menu} accessibilityViewIsModal>
            <Text style={s.heading} accessibilityRole="header">
              Translate · 翻译 · Traducir
            </Text>
            <Text style={s.menuNote}>{t("reader.translateNote")}</Text>
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = language === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    s.option,
                    selected && s.optionSelected,
                    pressed && s.pressed,
                  ]}
                  onPress={() => {
                    setLanguage(option.id);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  testID={`reader-language-${option.id}`}
                >
                  <View style={s.optionText}>
                    <Text style={s.optionName}>{option.nativeName}</Text>
                    {option.englishName !== option.nativeName && (
                      <Text style={s.optionSub}>{option.englishName}</Text>
                    )}
                  </View>
                  {selected && <Icon name="check" size={18} color={P.spark} />}
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [s.cancel, pressed && s.pressed]}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
            >
              <Text style={s.cancelLabel}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ReaderTools({
  speech,
  state,
  onRetry,
}: {
  speech: ReturnType<typeof useArticleSpeech>;
  state: "original" | "translated" | "pending" | "unavailable";
  onRetry: () => void;
}) {
  const { t, setLanguage } = useLanguage();
  // Read aloud is missing on web and in builds without the speech module.
  // The button stays tappable so the reason appears on request instead of
  // as a permanent line above every reader.
  const [explainUnavailable, setExplainUnavailable] = useState(false);
  const listenLabel =
    speech.status === "playing"
      ? t("listen.pause")
      : speech.status === "paused"
        ? t("listen.resume")
        : t("listen.short");
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Pressable
          style={({ pressed }) => [
            s.button,
            !speech.available && s.muted,
            pressed && s.pressed,
          ]}
          onPress={
            !speech.available
              ? () => setExplainUnavailable((shown) => !shown)
              : speech.status === "playing"
                ? speech.pause
                : speech.status === "paused"
                  ? speech.resume
                  : speech.play
          }
          accessibilityRole="button"
          accessibilityLabel={
            speech.status === "idle" ? t("listen.start") : listenLabel
          }
          accessibilityHint={
            speech.available ? undefined : t("listen.unavailable")
          }
          testID="measure-listen"
        >
          <Icon
            name={speech.status === "playing" ? "pause" : "headphones"}
            size={17}
            color={speech.available ? P.inkOnNight : P.quiet}
          />
          <Text
            style={[s.label, !speech.available && s.labelMuted]}
            numberOfLines={1}
          >
            {listenLabel}
          </Text>
        </Pressable>
        <ReaderLanguageButton />
      </View>
      {state !== "original" && (
        <View style={s.notice} accessibilityLiveRegion="polite">
          {state === "pending" ? (
            <ActivityIndicator size="small" color={P.quiet} />
          ) : (
            <Icon
              name={state === "translated" ? "globe" : "info"}
              size={14}
              color={state === "translated" ? P.spark : P.quiet}
            />
          )}
          <Text style={s.note}>
            {state === "pending"
              ? t("article.translationPending")
              : state === "translated"
                ? `${t("article.translated")} · ${t("reader.originalSources")}`
                : t("article.translationUnavailable")}
          </Text>
          {state === "translated" && (
            <Pressable
              onPress={() => setLanguage("en")}
              accessibilityRole="button"
              hitSlop={8}
              style={s.textAction}
              testID="reader-show-english"
            >
              <Text style={s.textActionLabel}>{t("reader.showEnglish")}</Text>
            </Pressable>
          )}
          {state === "unavailable" && (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              hitSlop={8}
              style={s.textAction}
            >
              <Text style={s.textActionLabel}>{t("common.retry")}</Text>
            </Pressable>
          )}
        </View>
      )}
      {!speech.available && explainUnavailable && (
        <Text style={s.note} accessibilityLiveRegion="polite">
          {t("listen.unavailable")}
        </Text>
      )}
      {speech.error && (
        <Text style={s.note} accessibilityRole="alert">
          {t("listen.error")}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: P.night,
  },
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 22,
  },
  translate: {
    backgroundColor: SPARK_TINT,
    borderColor: SPARK_EDGE,
    paddingRight: 12,
  },
  muted: { borderStyle: "dashed" },
  pressed: { opacity: 0.7 },
  label: { color: P.inkOnNight, fontFamily: fontBody.medium, fontSize: 14 },
  labelMuted: { color: P.quiet },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hair[1],
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  note: {
    flex: 1,
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  textAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  textActionLabel: {
    color: P.linkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  menu: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 8,
    backgroundColor: P.night,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hair[2],
  },
  heading: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 20,
  },
  menuNote: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  option: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[2],
  },
  optionSelected: { borderColor: SPARK_EDGE, backgroundColor: SPARK_TINT },
  optionText: { gap: 1 },
  optionName: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 16,
  },
  optionSub: { color: P.quiet, fontFamily: fontBody.regular, fontSize: 12 },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelLabel: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 14 },
});
