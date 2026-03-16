/**
 * Send Feedback screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Submission is simulated (sets local state) — wire to a real endpoint (e.g. tRPC or a form service like Typeform/Linear)
 * - TODO: Attach device metadata automatically (OS version, app version, user ID) to submission payload
 * - TODO: Allow optional screenshot attachment
 * - TODO: Rate limiting — prevent duplicate submissions within a short window
 * - TODO: "Bug Report" category should optionally attach recent error logs
 */

import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

const CATEGORIES = [
  { id: "bug", label: "Bug Report", icon: "bug-outline" as const },
  { id: "feature", label: "Feature Request", icon: "bulb-outline" as const },
  { id: "content", label: "Content Issue", icon: "newspaper-outline" as const },
  { id: "other", label: "Other", icon: "chatbubble-outline" as const },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [category, setCategory] = useState("bug");
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={["top"]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.foreground }]}>Send Feedback</Text>
          <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
        </View>
        <View style={styles.thanks} lightColor="transparent" darkColor="transparent">
          <Ionicons name="checkmark-circle" size={56} color={colors.teal} />
          <Text style={[styles.thanksTitle, { color: theme.foreground }]}>Thanks!</Text>
          <Text style={[styles.thanksSub, { color: theme.textSecondary }]}>
            Your feedback helps us build a better Billion.
          </Text>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.white }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={[styles.doneBtnText, { color: colors.black }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Send Feedback</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>CATEGORY</Text>
        <View style={styles.categories} lightColor="transparent" darkColor="transparent">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: active ? colors.civicBlue : theme.card,
                    borderColor: active ? colors.civicBlue : theme.border,
                  },
                ]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={active ? colors.white : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.catLabel,
                    { color: active ? colors.white : theme.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>YOUR FEEDBACK</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Describe the issue or idea in detail…"
          placeholderTextColor={theme.mutedForeground}
          style={[
            styles.textArea,
            {
              color: theme.foreground,
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: text.trim().length > 0 ? colors.white : theme.card },
          ]}
          onPress={() => text.trim().length > 0 && setSubmitted(true)}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.submitBtnText,
              { color: text.trim().length > 0 ? colors.black : theme.mutedForeground },
            ]}
          >
            Submit Feedback
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
  },
  scroll: { flex: 1, paddingHorizontal: sp[5] },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: sp[6],
    marginBottom: sp[3],
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp[2],
    marginBottom: sp[2],
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: sp[2],
    paddingHorizontal: sp[3],
    borderRadius: rd.full,
    borderWidth: 1,
    gap: sp[1],
  },
  catLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: rd.lg,
    padding: sp[4],
    height: 160,
    textAlignVertical: "top",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: sp[5],
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: rd.full,
    paddingVertical: sp[4],
    alignItems: "center",
  },
  submitBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
  thanks: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sp[4],
    paddingHorizontal: sp[10],
  },
  thanksTitle: {
    fontFamily: "IBMPlexSerif_700Bold",
    fontSize: 32,
  },
  thanksSub: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  doneBtn: {
    borderRadius: rd.full,
    paddingVertical: sp[4],
    paddingHorizontal: sp[10],
    marginTop: sp[4],
  },
  doneBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
});
