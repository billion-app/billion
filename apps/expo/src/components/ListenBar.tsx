/**
 * The article reader's audio controls, pinned above the bottom inset while
 * an article is being read aloud. Hidden when nothing is playing or paused.
 *
 * iPhones mute speech in Silent Mode with no other cue, so iOS readers get a
 * sound hint as soon as playback starts.
 */
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SpeechStatus } from "~/hooks/useArticleSpeech";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { useLanguage } from "~/hooks/useLanguage";
import { colors, fontBody, hair, planes } from "~/styles";

export function ListenBar(props: {
  status: SpeechStatus;
  index: number;
  total: number;
  accent: string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const { status, index, total, accent, onPause, onResume, onStop } = props;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  if (status === "idle") return null;
  const playing = status === "playing";

  return (
    <View
      style={[s.bar, { bottom: Math.max(insets.bottom, 12) + 8 }]}
      accessibilityRole="toolbar"
      testID="article-listen-bar"
    >
      <View style={s.controls}>
        <TouchableOpacity
          style={[s.primary, { backgroundColor: accent }]}
          onPress={playing ? onPause : onResume}
          accessibilityRole="button"
          accessibilityLabel={playing ? t("listen.pause") : t("listen.resume")}
          hitSlop={6}
        >
          <Icon
            name={playing ? "pause" : "play"}
            size={18}
            color={planes.navy}
          />
        </TouchableOpacity>
        <View style={s.body}>
          <Text style={s.state}>
            {playing ? t("listen.listening") : t("listen.paused")}
          </Text>
          <Text style={s.progress}>
            {t("listen.progress", { current: index + 1, total })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel={t("listen.stop")}
          hitSlop={10}
          style={s.stop}
        >
          <Icon name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {Platform.OS === "ios" && (
        <View style={s.hint} testID="article-listen-silent-hint">
          <Icon name="info" size={14} color={accent} />
          <Text style={s.hintText} accessibilityLiveRegion="polite">
            {t("listen.silentHint")}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[3],
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  controls: { flexDirection: "row", alignItems: "center", gap: 12 },
  primary: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  state: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  progress: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  stop: { padding: 4 },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[3],
  },
  hintText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.white,
  },
});
