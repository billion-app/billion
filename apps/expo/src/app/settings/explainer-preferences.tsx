import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, settings, sp, typography, useTheme } from "~/styles";
import { queryClient, trpc } from "~/utils/api";

type ExplainerLength = "concise" | "standard" | "comprehensive";
type ReadingLevel = "technical" | "accessible" | "balanced";

const LENGTH_OPTIONS: { value: ExplainerLength; label: string; description: string }[] = [
  {
    value: "concise",
    label: "Concise",
    description: "Quick overview — ~300 words",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Balanced explainer — ~800 words",
  },
  {
    value: "comprehensive",
    label: "Comprehensive",
    description: "In-depth analysis — ~1,500 words",
  },
];

const READING_LEVEL_OPTIONS: { value: ReadingLevel; label: string; description: string }[] = [
  {
    value: "accessible",
    label: "General",
    description: "Plain language, jargon defined inline",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Mix of accessible and technical detail",
  },
  {
    value: "technical",
    label: "Technical",
    description: "Policy & legal terminology, no hand-holding",
  },
];

export default function ExplainerPreferencesScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const { data: prefs, isLoading: isLoadingPrefs } = useQuery(
    trpc.user.getPreferences.queryOptions(),
  );

  const [length, setLength] = useState<ExplainerLength>(
    (prefs?.explainerLength as ExplainerLength | undefined) ?? "standard",
  );
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(
    (prefs?.readingLevel as ReadingLevel | undefined) ?? "accessible",
  );

  // Sync local state once prefs load
  const [synced, setSynced] = useState(false);
  if (prefs && !synced) {
    setLength((prefs.explainerLength as ExplainerLength) ?? "standard");
    setReadingLevel((prefs.readingLevel as ReadingLevel) ?? "accessible");
    setSynced(true);
  }

  const { mutate: savePrefs, isPending: isSaving } = useMutation({
    ...trpc.user.updatePreferences.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(trpc.user.getPreferences.queryFilter());
      router.back();
    },
  });

  const handleSave = () => {
    savePrefs({ explainerLength: length, readingLevel });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Reading Preferences
        </Text>
        <View
          style={{ width: 44 }}
          lightColor="transparent"
          darkColor="transparent"
        />
      </View>

      {isLoadingPrefs ? (
        <View
          style={styles.loadingContainer}
          lightColor="transparent"
          darkColor="transparent"
        >
          <ActivityIndicator color={theme.mutedForeground} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Article Length */}
          <Text style={[settings.sectionTitle, styles.sectionLabel, { color: theme.textSecondary }]}>
            Article Length
          </Text>
          <View
            style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.card }]}
            lightColor={theme.card}
            darkColor={theme.card}
          >
            {LENGTH_OPTIONS.map((opt, idx) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  settings.item,
                  { borderBottomColor: theme.border },
                  idx === LENGTH_OPTIONS.length - 1 && styles.lastItem,
                ]}
                onPress={() => setLength(opt.value)}
                activeOpacity={0.7}
              >
                <View
                  style={settings.itemTextContainer}
                  lightColor="transparent"
                  darkColor="transparent"
                >
                  <Text style={[settings.itemTitle, { color: theme.foreground }]}>
                    {opt.label}
                  </Text>
                  <Text style={[settings.itemSubtitle, { color: theme.textSecondary }]}>
                    {opt.description}
                  </Text>
                </View>
                {length === opt.value && (
                  <Ionicons name="checkmark" size={18} color={colors.civicBlue} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Reading Level */}
          <Text style={[settings.sectionTitle, styles.sectionLabel, { color: theme.textSecondary }]}>
            Reading Level
          </Text>
          <View
            style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.card }]}
            lightColor={theme.card}
            darkColor={theme.card}
          >
            {READING_LEVEL_OPTIONS.map((opt, idx) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  settings.item,
                  { borderBottomColor: theme.border },
                  idx === READING_LEVEL_OPTIONS.length - 1 && styles.lastItem,
                ]}
                onPress={() => setReadingLevel(opt.value)}
                activeOpacity={0.7}
              >
                <View
                  style={settings.itemTextContainer}
                  lightColor="transparent"
                  darkColor="transparent"
                >
                  <Text style={[settings.itemTitle, { color: theme.foreground }]}>
                    {opt.label}
                  </Text>
                  <Text style={[settings.itemSubtitle, { color: theme.textSecondary }]}>
                    {opt.description}
                  </Text>
                </View>
                {readingLevel === opt.value && (
                  <Ionicons name="checkmark" size={18} color={colors.civicBlue} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.civicBlue },
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[typography.body, styles.saveButtonText]}>
                Save Preferences
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    alignItems: "flex-start",
  },
  title: {
    fontFamily: "IBMPlexSerif-Bold",
    fontSize: 17,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
    paddingTop: sp[4],
  },
  sectionLabel: {
    marginHorizontal: sp[4],
    marginBottom: sp[2],
  },
  optionGroup: {
    marginHorizontal: sp[4],
    marginBottom: sp[6],
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  saveButton: {
    marginHorizontal: sp[4],
    marginBottom: sp[10],
    paddingVertical: sp[4],
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: "600",
  },
});
