/**
 * Translation and read-aloud controls above a readable measure.
 *
 * The language button stays visible in every language and names Chinese and
 * Spanish in their own scripts, so a reader who cannot read English still
 * finds it. Translated text always carries one provenance line: machine
 * translated, quotes and sources left as published, and a way back to English.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { useArticleSpeech } from "~/hooks/useArticleSpeech";
import { useLanguage } from "~/hooks/useLanguage";
import { fontBody, hair, DigestPalette as P } from "~/styles";
import { LanguageButton } from "./LanguageButton";
import { TranslationNotice } from "./TranslationNotice";
import { Icon } from "./ui/Icon";

export { LanguageButton as ReaderLanguageButton } from "./LanguageButton";

export function ReaderTools({
  speech,
  state,
  onRetry,
  showLanguage = true,
}: {
  speech: ReturnType<typeof useArticleSpeech>;
  state: "original" | "translated" | "pending" | "unavailable";
  onRetry: () => void;
  showLanguage?: boolean;
}) {
  const { t } = useLanguage();
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
        {showLanguage && <LanguageButton />}
      </View>
      <TranslationNotice state={state} onRetry={onRetry} />
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
  muted: { borderStyle: "dashed" },
  pressed: { opacity: 0.7 },
  label: { color: P.inkOnNight, fontFamily: fontBody.medium, fontSize: 14 },
  labelMuted: { color: P.quiet },
  note: {
    flex: 1,
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
  },
});
