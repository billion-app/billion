import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";

import type { IconName } from "~/components/ui";
import type { AppStringKey } from "~/i18n/app-strings";
import { Text } from "~/components/Themed";
import { GhostButton, Icon, Kicker, ScreenShell } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  colors,
  DigestHair,
  DigestRadii,
  DigestType,
  fontBody,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { getAppBuildNumber, getAppVersion } from "~/utils/app-version";
import { buildFeedbackFormUrl } from "~/utils/feedback-form";

type FeedbackCategory = "bug" | "idea" | "content";

const CATS: { id: FeedbackCategory; label: AppStringKey; icon: IconName }[] = [
  { id: "bug", label: "feedback.bug", icon: "flag" },
  { id: "idea", label: "feedback.idea", icon: "sparkle" },
  { id: "content", label: "feedback.content", icon: "doc" },
];

const CAT_COLOR: Record<FeedbackCategory, string> = {
  bug: colors.red[400],
  idea: colors.civicBlue,
  content: colors.teal,
};

export default function FeedbackScreen() {
  const { t: tx } = useAppTranslation();

  const { t } = useAppTranslation();
  const [cat, setCat] = useState<FeedbackCategory>("bug");
  const [text, setText] = useState("");
  const [lastSubmittedAt, setLastSubmittedAt] = useState(0);
  const submitMutation = useMutation(trpc.feedback.submit.mutationOptions());
  const message = text.trim();
  const canSubmit = message.length >= 5 && !submitMutation.isPending;
  const formKind = cat === "bug" ? "bug" : cat === "idea" ? "feature" : null;

  const submit = () => {
    if (!canSubmit) return;
    const now = Date.now();
    if (now - lastSubmittedAt < 30_000) {
      Alert.alert(t("feedback.alreadySent"), t("feedback.alreadySentBody"));
      return;
    }

    submitMutation.mutate(
      {
        category: cat,
        message,
        appVersion: getAppVersion(),
        buildNumber: getAppBuildNumber(),
        platform: Platform.OS,
        platformVersion: String(Platform.Version),
      },
      {
        onSuccess: () => {
          setLastSubmittedAt(Date.now());
          posthog.capture("feedback_submitted", {
            category: cat,
            message_length: message.length,
            app_version: getAppVersion(),
            platform: Platform.OS,
          });
          setText("");
          Alert.alert(t("feedback.sent"), t("feedback.sentBody"));
        },
        onError: () => {
          Alert.alert(t("feedback.sendFailed"), t("feedback.tryLater"));
        },
      },
    );
  };

  const openGuidedForm = async () => {
    if (!formKind) return;

    const details = message
      ? [
          message,
          "",
          "———",
          tx("App version: {value1} ({value2})", {
            value1: getAppVersion(),
            value2: getAppBuildNumber() ?? "—",
          }),
          tx("Platform: {value1} {value2}", {
            value1: Platform.OS,
            value2: String(Platform.Version),
          }),
        ].join("\n")
      : undefined;
    const url = buildFeedbackFormUrl(formKind, details);

    try {
      if (!(await Linking.canOpenURL(url))) throw new Error("Unsupported URL");
      await Linking.openURL(url);
      posthog.capture("feedback_form_opened", {
        category: cat,
        message_length: message.length,
        app_version: getAppVersion(),
        platform: Platform.OS,
      });
    } catch {
      Alert.alert(t("feedback.formFailed"), t("feedback.tryLater"));
    }
  };

  return (
    <ScreenShell title={t("feedback.title")}>
      <Kicker style={s.kicker}>{t("feedback.category")}</Kicker>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {CATS.map((c) => {
          const active = cat === c.id;
          const tone = CAT_COLOR[c.id];
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.8}
              onPress={() => setCat(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={t(c.label)}
              style={[
                s.catRow,
                active
                  ? { backgroundColor: `${tone}33`, borderColor: `${tone}66` }
                  : s.catRowOff,
              ]}
            >
              <Icon name={c.icon} size={19} color={active ? tone : P.quiet} />
              <Text
                style={[
                  s.catLabel,
                  { color: active ? P.inkOnNight : "rgba(247,244,238,0.7)" },
                ]}
              >
                {t(c.label)}
              </Text>
              <View
                style={[
                  s.radio,
                  { borderColor: active ? tone : DigestHair.sectionRule },
                ]}
              >
                {active && (
                  <View style={[s.radioDot, { backgroundColor: tone }]} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Kicker style={s.kicker}>{t("feedback.details")}</Kicker>
      <TextInput
        style={s.textarea}
        value={text}
        onChangeText={setText}
        placeholder={t("feedback.placeholder")}
        accessibilityLabel={t("feedback.details")}
        placeholderTextColor={P.quiet}
        multiline
        textAlignVertical="top"
      />
      <Text style={s.attached}>
        {t("feedback.attached", { version: getAppVersion() })}
      </Text>

      <TouchableOpacity
        style={[
          s.cta,
          { backgroundColor: CAT_COLOR[cat], opacity: canSubmit ? 1 : 0.55 },
        ]}
        onPress={submit}
        activeOpacity={0.85}
        disabled={!canSubmit}
      >
        <Text style={s.ctaLabel}>
          {submitMutation.isPending
            ? t("feedback.sending")
            : t("feedback.submit")}
        </Text>
      </TouchableOpacity>

      {formKind && (
        <>
          <Text style={s.orDivider}>{t("common.or")}</Text>
          <GhostButton
            label={
              formKind === "bug"
                ? t("feedback.guidedBug")
                : t("feedback.guidedFeature")
            }
            onPress={() => void openGuidedForm()}
            color={P.quiet}
            style={{ alignSelf: "center" }}
          />
        </>
      )}
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  kicker: {
    ...DigestType.sectionEyebrow,
    marginBottom: 12,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: DigestRadii.menu,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catRowOff: {
    backgroundColor: P.stone,
    borderColor: DigestHair.cardBorder,
  },
  catLabel: { flex: 1, fontFamily: fontBody.semibold, fontSize: 15 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: P.spark,
  },
  textarea: {
    minHeight: 130,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
    padding: 14,
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  attached: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: P.quiet,
    marginVertical: 10,
    marginBottom: 20,
  },
  cta: {
    height: 52,
    width: "100%",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.inkOnNight,
  },
  orDivider: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: P.quiet,
    textAlign: "center",
    marginVertical: 14,
  },
});
