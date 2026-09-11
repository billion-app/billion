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
import { Text } from "~/components/Themed";
import {
  GhostButton,
  Icon,
  Kicker,
  ScreenShell,
} from "~/components/ui";
import { posthog } from "~/config/posthog";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette as P,
  DigestRadii,
  DigestType,
} from "~/styles";
import { trpc } from "~/utils/api";
import { getAppBuildNumber, getAppVersion } from "~/utils/app-version";
import { buildFeedbackFormUrl } from "~/utils/feedback-form";

type FeedbackCategory = "bug" | "idea" | "content";

const CATS: { id: FeedbackCategory; label: string; icon: IconName }[] = [
  { id: "bug", label: "Bug report", icon: "flag" },
  { id: "idea", label: "Feature idea", icon: "sparkle" },
  { id: "content", label: "Content issue", icon: "doc" },
];

export default function FeedbackScreen() {
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
      Alert.alert("Already sent", "Give us a moment before sending another.");
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
          Alert.alert("Feedback sent", "Thanks. We read every note.");
        },
        onError: () => {
          Alert.alert(
            "Couldn’t send feedback",
            "Please try again in a moment.",
          );
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
          `App version: ${getAppVersion()} (${getAppBuildNumber()})`,
          `Platform: ${Platform.OS} ${String(Platform.Version)}`,
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
      Alert.alert(
        "Couldn’t open the feedback form",
        "Please try again in a moment.",
      );
    }
  };

  return (
    <ScreenShell title="Send Feedback">
      <Text style={s.title}>What&apos;s on your mind?</Text>
      <Text style={s.intro}>
        We read every note — it shapes what we build next.
      </Text>

      <Kicker style={s.kicker}>Category</Kicker>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {CATS.map((c) => {
          const active = cat === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.8}
              onPress={() => setCat(c.id)}
              style={[s.catRow, active ? s.catRowOn : s.catRowOff]}
            >
              <Icon
                name={c.icon}
                size={19}
                color={active ? P.spark : P.quiet}
              />
              <Text
                style={[
                  s.catLabel,
                  { color: active ? P.inkOnNight : "rgba(247,244,238,0.7)" },
                ]}
              >
                {c.label}
              </Text>
              <View
                style={[
                  s.radio,
                  { borderColor: active ? P.spark : DigestHair.sectionRule },
                ]}
              >
                {active && <View style={s.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Kicker style={s.kicker}>Details</Kicker>
      <TextInput
        style={s.textarea}
        value={text}
        onChangeText={setText}
        placeholder="Tell us what happened or what you'd love to see…"
        placeholderTextColor={P.quiet}
        multiline
        textAlignVertical="top"
      />
      <Text style={s.attached}>
        App version {getAppVersion()} attached automatically.
      </Text>

      <TouchableOpacity
        style={[s.cta, { opacity: canSubmit ? 1 : 0.55 }]}
        onPress={submit}
        activeOpacity={0.85}
        disabled={!canSubmit}
      >
        <Text style={s.ctaLabel}>
          {submitMutation.isPending ? "Sending…" : "Submit feedback"}
        </Text>
      </TouchableOpacity>

      {formKind && (
        <>
          <Text style={s.orDivider}>or</Text>
          <GhostButton
            label={
              formKind === "bug"
                ? "Use guided bug report form"
                : "Use guided feature request form"
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
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: P.inkOnNight,
    marginBottom: 6,
  },
  intro: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: P.quiet,
    marginBottom: 22,
    lineHeight: 20,
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
  catRowOn: {
    backgroundColor: DigestHair.tabActivePill,
    borderColor: DigestHair.menuBorder,
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
    backgroundColor: P.spark,
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
