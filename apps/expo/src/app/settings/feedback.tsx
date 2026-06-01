import { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Constants from "expo-constants";
import { useMutation } from "@tanstack/react-query";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { Icon, Kicker, PrimaryButton, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";

const CATS: { id: string; label: string; icon: IconName }[] = [
  { id: "bug", label: "Bug report", icon: "flag" },
  { id: "idea", label: "Feature idea", icon: "sparkle" },
  { id: "content", label: "Content issue", icon: "doc" },
];

export default function FeedbackScreen() {
  const [cat, setCat] = useState("bug");
  const [text, setText] = useState("");

  const submitFeedback = useMutation(trpc.user.submitFeedback.mutationOptions());

  const handleSubmit = () => {
    if (!text.trim()) return;
    submitFeedback.mutate(
      {
        category: cat as "bug" | "idea" | "content",
        message: text,
        os: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? "0.1.1",
      },
      {
        onSuccess: () => {
          setText("");
          Alert.alert("Thanks!", "Your feedback was sent to the team.");
        },
        onError: () => {
          Alert.alert("Couldn't send", "Please try again.");
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
        App version {Constants.expoConfig?.version ?? "0.1.1"} attached
        automatically.
      </Text>

      <PrimaryButton
        label={submitFeedback.isPending ? "Sending…" : "Submit feedback"}
        onPress={handleSubmit}
        disabled={submitFeedback.isPending || !text.trim()}
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
