import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useLanguage } from "~/hooks/useLanguage";
import { fontBody, hair, DigestPalette as P } from "~/styles";
import { Icon } from "./ui/Icon";

export function TranslationNotice({
  state,
  onRetry,
  hideEnglish = false,
}: {
  state: "original" | "translated" | "pending" | "unavailable" | "source";
  onRetry: () => void;
  hideEnglish?: boolean;
}) {
  const { language, setLanguage, t } = useLanguage();
  if (state === "original") return null;
  const pending = state === "pending";
  const failed = state === "unavailable";
  return (
    <View
      style={[s.notice, (pending || failed) && s.prominent]}
      accessibilityLiveRegion="polite"
      testID={`translation-${state}`}
    >
      <View style={s.row}>
        {pending ? (
          <ActivityIndicator
            size="small"
            color={P.spark}
            accessibilityLabel={t(
              language === "zh"
                ? "readerUi.translatingZh"
                : "readerUi.translatingEs",
            )}
          />
        ) : (
          <Icon
            name={failed ? "info" : "globe"}
            size={17}
            color={P.linkOnNight}
          />
        )}
        <View style={s.copy}>
          {(pending || failed) && (
            <Text style={s.title}>
              {failed
                ? t("readerUi.translationFailed")
                : t(
                    language === "zh"
                      ? "readerUi.translatingZh"
                      : "readerUi.translatingEs",
                  )}
            </Text>
          )}
          <Text style={[s.text, (pending || failed) && s.body]}>
            {pending
              ? t(
                  hideEnglish
                    ? "readerUi.preparingTranslation"
                    : "readerUi.translationWait",
                )
              : failed
                ? t(
                    hideEnglish
                      ? "readerUi.retryTranslation"
                      : "readerUi.translationRetry",
                  )
                : state === "source"
                  ? t("article.sourceStaysEnglish")
                  : `${t("article.translated")} · ${t("reader.originalSources")}`}
          </Text>
        </View>
      </View>
      {state !== "source" && (
        <View style={s.actions}>
          {failed && (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={s.action}
              testID="translation-retry"
            >
              <Text style={s.actionText}>{t("common.retry")}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => setLanguage("en")}
            style={s.action}
            testID="reader-show-english"
          >
            <Text style={s.actionText}>
              {t(
                pending || failed
                  ? "readerUi.useEnglish"
                  : "reader.showEnglish",
              )}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: P.night,
  },
  prominent: { borderColor: P.spark, backgroundColor: "rgba(212,175,55,0.08)" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 8,
  },
  copy: { flex: 1, gap: 4 },
  title: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  text: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    color: P.quiet,
  },
  body: { fontSize: 13, lineHeight: 19, color: P.inkOnNight },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  action: { minHeight: 44, justifyContent: "center" },
  actionText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.linkOnNight,
  },
});
