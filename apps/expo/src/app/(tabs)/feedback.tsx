import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { GhostButton, Icon, Kicker } from "~/components/ui";
import { posthog } from "~/config/posthog";
import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  DigestType,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { getAppBuildNumber, getAppVersion } from "~/utils/app-version";
import { buildFeedbackFormUrl } from "~/utils/feedback-form";

// Direct contact remains available as a fallback to the guided form.
const CONTACT_EMAIL = "thatxliner@gmail.com";

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      {/* Pinned title — never eaten by refresh chrome */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: DigestSpace.screenPadX,
        }}
      >
        <Text style={s.screenTitle}>Feedback</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
      >
        <View style={s.body}>
          <Kicker style={s.kicker}>Category</Kicker>
          <View style={{ gap: 8, marginBottom: 14 }}>
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
                      {
                        color: active ? P.inkOnNight : "rgba(247,244,238,0.7)",
                      },
                    ]}
                  >
                    {c.label}
                  </Text>
                  <View
                    style={[
                      s.radio,
                      {
                        borderColor: active ? P.spark : DigestHair.sectionRule,
                      },
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
              {cat === "bug"
                ? "Continue to bug report"
                : cat === "idea"
                  ? "Continue to feature request"
                  : "Send content issue via email"}
            </Text>
          </TouchableOpacity>

          <Text style={s.orDivider}>or</Text>

          <GhostButton
            label={`Email us at ${CONTACT_EMAIL}`}
            onPress={emailDirect}
            color={P.quiet}
            style={{ alignSelf: "center" }}
          />
        </View>
      </ScrollView>

      {/* Docked legal footer — sits above tab bar, never soft-clipped. */}
      <View
        style={[
          s.legalDock,
          // Tab bar overlays bottom — pad dock so Terms sits fully above it.
          { paddingBottom: 72 + Math.max(insets.bottom, 8) },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.push("/settings/terms")}
          activeOpacity={0.7}
          style={s.legalLink}
          accessibilityRole="link"
          accessibilityLabel="Terms and Privacy Policy"
        >
          <Text style={s.legalLinkText}>Terms and Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screenTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: P.inkOnNight,
  },
  legalDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
    paddingTop: 6,
    paddingHorizontal: DigestSpace.screenPadX,
    backgroundColor: P.canvas,
  },
  body: {
    paddingHorizontal: DigestSpace.screenPadX + 4,
    paddingTop: 10,
    paddingBottom: 8,
  },
  kicker: {
    ...DigestType.sectionEyebrow,
    color: P.quiet,
    marginBottom: 10,
  },
  legalLink: {
    alignSelf: "center",
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 6,
  },
  legalLinkText: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: P.quiet,
    textDecorationLine: "underline",
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
    minHeight: 96,
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
    color: P.ink,
  },
  orDivider: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: P.quiet,
    textAlign: "center",
    marginVertical: 10,
  },
});
