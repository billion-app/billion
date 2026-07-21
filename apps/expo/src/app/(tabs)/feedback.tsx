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

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import {
  GhostButton,
  Icon,
  Kicker,
  PrimaryButton,
  TabScreen,
} from "~/components/ui";
import { posthog } from "~/config/posthog";
import { colors, fontBody, hair, planes } from "~/styles";
import { getAppBuildNumber, getAppVersion } from "~/utils/app-version";
import { buildFeedbackFormUrl } from "~/utils/feedback-form";

// Direct contact remains available as a fallback to the guided form.
const CONTACT_EMAIL = "billionnewsapp@gmail.com";

type FeedbackCategory = "bug" | "idea" | "content";

const CATS: { id: FeedbackCategory; label: string; icon: IconName }[] = [
  { id: "bug", label: "Bug report", icon: "flag" },
  { id: "idea", label: "Feature idea", icon: "sparkle" },
  { id: "content", label: "Content issue", icon: "doc" },
];

/** Build a mailto URL to the point of contact, pre-filling whatever we know. */
function buildMailto(category: FeedbackCategory, message: string): string {
  const label = CATS.find((c) => c.id === category)?.label ?? "Feedback";
  const subject = `Billion feedback — ${label}`;
  const body = [
    message,
    "",
    "———",
    `App version: ${getAppVersion()} (${getAppBuildNumber()})`,
    `Platform: ${Platform.OS} ${String(Platform.Version)}`,
  ].join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

async function openMailto(url: string): Promise<boolean> {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // fall through to the failure alert below
  }
  Alert.alert(
    "Couldn’t open your mail app",
    `Please email us directly at ${CONTACT_EMAIL}.`,
  );
  return false;
}

async function openFeedbackForm(url: string): Promise<boolean> {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // fall through to the failure alert below
  }
  Alert.alert(
    "Couldn’t open the feedback form",
    "Please try again in a moment.",
  );
  return false;
}

export default function FeedbackScreen() {
  const [cat, setCat] = useState<FeedbackCategory>("bug");
  const [text, setText] = useState("");
  const message = text.trim();
  const formKind = cat === "bug" ? "bug" : cat === "idea" ? "feature" : null;
  const canSubmit = formKind !== null || message.length >= 5;

  const submit = () => {
    if (!canSubmit) return;

    if (formKind) {
      const details = message
        ? [
            message,
            "",
            "———",
            `App version: ${getAppVersion()} (${getAppBuildNumber()})`,
            `Platform: ${Platform.OS} ${String(Platform.Version)}`,
          ].join("\n")
        : undefined;

      void openFeedbackForm(buildFeedbackFormUrl(formKind, details)).then(
        (opened) => {
          if (!opened) return;
          posthog.capture("feedback_form_opened", {
            category: cat,
            message_length: message.length,
            app_version: getAppVersion(),
            platform: Platform.OS,
          });
        },
      );
      return;
    }

    void openMailto(buildMailto(cat, message)).then((opened) => {
      if (!opened) return;
      posthog.capture("feedback_submitted", {
        category: cat,
        message_length: message.length,
        app_version: getAppVersion(),
        platform: Platform.OS,
        channel: "email",
      });
      setText("");
    });
  };

  const emailDirect = () => {
    posthog.capture("feedback_email_direct", { app_version: getAppVersion() });
    void openMailto(`mailto:${CONTACT_EMAIL}`);
  };

  return (
    <TabScreen title="Feedback">
      <View style={s.body}>
        <Text style={s.title}>What&apos;s on your mind?</Text>
        <Text style={s.intro}>
          We read every note — it shapes what we build next. Bug reports and
          feature ideas open in our guided feedback form.
        </Text>

        <Kicker>Category</Kicker>
        <View style={{ gap: 10, marginBottom: 24 }}>
          {CATS.map((c) => {
            const active = cat === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.8}
                onPress={() => setCat(c.id)}
                style={[
                  s.catRow,
                  {
                    backgroundColor: active ? planes.surface : planes.slate,
                    borderColor: active ? hair[3] : hair[1],
                  },
                ]}
              >
                <Icon
                  name={c.icon}
                  size={19}
                  color={active ? colors.white : colors.textSecondary}
                />
                <Text
                  style={[
                    s.catLabel,
                    { color: active ? colors.white : "rgba(255,255,255,0.7)" },
                  ]}
                >
                  {c.label}
                </Text>
                <View
                  style={[
                    s.radio,
                    { borderColor: active ? colors.white : hair[3] },
                  ]}
                >
                  {active && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Kicker>Details</Kicker>
        <TextInput
          style={s.textarea}
          value={text}
          onChangeText={setText}
          placeholder="Tell us what happened or what you'd love to see…"
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
        />
        <Text style={s.attached}>
          App version {getAppVersion()} attached automatically.
        </Text>

        <PrimaryButton
          label={
            cat === "bug"
              ? "Continue to bug report"
              : cat === "idea"
                ? "Continue to feature request"
                : "Send content issue via email"
          }
          onPress={submit}
          style={{ opacity: canSubmit ? 1 : 0.55 }}
        />

        <Text style={s.orDivider}>or</Text>

        <GhostButton
          label={`Email us at ${CONTACT_EMAIL}`}
          onPress={emailDirect}
          style={{ alignSelf: "center" }}
        />
      </View>
    </TabScreen>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 18 },
  title: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 19,
    color: colors.white,
    marginBottom: 6,
  },
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 22,
    lineHeight: 20,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
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
    backgroundColor: colors.white,
  },
  textarea: {
    minHeight: 130,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    padding: 14,
    color: colors.white,
    fontFamily: "AlbertSans-Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  attached: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: 10,
    marginBottom: 20,
  },
  orDivider: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginVertical: 14,
  },
});
