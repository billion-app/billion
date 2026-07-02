import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { Icon, Kicker, PrimaryButton, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { getAppBuildNumber, getAppVersion } from "~/utils/app-version";

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

  return (
    <ScreenShell title="Send Feedback">
      <Text style={s.title}>What&apos;s on your mind?</Text>
      <Text style={s.intro}>
        We read every note — it shapes what we build next.
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
        label={submitMutation.isPending ? "Sending…" : "Submit feedback"}
        onPress={submit}
        style={{ opacity: canSubmit ? 1 : 0.55 }}
      />
    </ScreenShell>
  );
}

const s = StyleSheet.create({
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
});
