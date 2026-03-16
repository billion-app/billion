/**
 * Content Interests screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Replace ALL_TOPICS with a real taxonomy fetched from tRPC (trpc.topics.list)
 * - TODO: Load currently-selected topics from user preferences via tRPC (trpc.user.preferences.get)
 * - TODO: Persist selection via tRPC mutation (trpc.user.preferences.setTopics)
 * - TODO: "Save Preferences" should optimistically update and show a success toast
 * - TODO: Consider grouping topics by category (civic, economic, social, etc.)
 */

import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

interface Topic {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}

// TODO: Replace with real topic taxonomy from tRPC
const ALL_TOPICS: Topic[] = [
  { id: "bills", label: "Bills & Legislation", icon: "document-text-outline", color: colors.civicBlue },
  { id: "executive", label: "Executive Actions", icon: "briefcase-outline", color: colors.deepIndigo },
  { id: "courts", label: "Court Cases", icon: "scale-outline", color: colors.teal },
  { id: "economy", label: "Economy & Finance", icon: "bar-chart-outline", color: colors.civicBlue },
  { id: "environment", label: "Environment & Climate", icon: "leaf-outline", color: colors.teal },
  { id: "healthcare", label: "Health & Healthcare", icon: "medkit-outline", color: colors.deepIndigo },
  { id: "education", label: "Education", icon: "school-outline", color: colors.civicBlue },
  { id: "immigration", label: "Immigration", icon: "globe-outline", color: colors.teal },
  { id: "defense", label: "Defense & Security", icon: "shield-outline", color: colors.deepIndigo },
  { id: "foreign", label: "Foreign Policy", icon: "earth-outline", color: colors.civicBlue },
  { id: "housing", label: "Housing & Urban", icon: "home-outline", color: colors.teal },
  { id: "tech", label: "Technology & AI", icon: "hardware-chip-outline", color: colors.deepIndigo },
  { id: "labor", label: "Labor & Employment", icon: "people-outline", color: colors.civicBlue },
  { id: "tax", label: "Tax Policy", icon: "calculator-outline", color: colors.deepIndigo },
  { id: "energy", label: "Energy & Infrastructure", icon: "flash-outline", color: colors.teal },
  { id: "civil", label: "Civil Rights", icon: "ribbon-outline", color: colors.civicBlue },
  { id: "veterans", label: "Veterans & Military", icon: "medal-outline", color: colors.deepIndigo },
  { id: "agriculture", label: "Agriculture & Food", icon: "nutrition-outline", color: colors.teal },
];

export default function ContentInterestsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  // TODO: Initialize from trpc.user.preferences.get
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["bills", "executive", "courts", "economy"]),
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_TOPICS;
    const q = query.toLowerCase();
    return ALL_TOPICS.filter((t) => t.label.toLowerCase().includes(q));
  }, [query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Content Interests</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      {/* Search bar */}
      <View
        style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}
        lightColor="transparent"
        darkColor="transparent"
      >
        <Ionicons name="search-outline" size={16} color={theme.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search topics…"
          placeholderTextColor={theme.mutedForeground}
          style={[styles.searchInput, { color: theme.foreground }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.noResults} lightColor="transparent" darkColor="transparent">
            <Ionicons name="search-outline" size={32} color={theme.mutedForeground} />
            <Text style={[styles.noResultsText, { color: theme.textSecondary }]}>
              No topics match "{query}"
            </Text>
          </View>
        ) : (
          <View style={styles.grid} lightColor="transparent" darkColor="transparent">
            {filtered.map((topic) => {
              const active = selected.has(topic.id);
              return (
                <TouchableOpacity
                  key={topic.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? topic.color : theme.card,
                      borderColor: active ? topic.color : theme.border,
                    },
                  ]}
                  onPress={() => toggle(topic.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={topic.icon}
                    size={14}
                    color={active ? colors.white : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: active ? colors.white : theme.textSecondary },
                    ]}
                  >
                    {topic.label}
                  </Text>
                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={colors.white}
                      style={{ marginLeft: 2 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={[styles.hint, { color: theme.mutedForeground }]}>
          {selected.size} topic{selected.size !== 1 ? "s" : ""} selected
        </Text>
      </ScrollView>

      {/* Save CTA */}
      <View
        style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}
      >
        {/* TODO: Wire to trpc.user.preferences.setTopics mutation */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.white }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={[styles.saveBtnText, { color: colors.black }]}>Save Preferences</Text>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
    marginHorizontal: sp[5],
    marginTop: sp[4],
    marginBottom: sp[2],
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    borderRadius: rd.full,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    padding: 0,
  },
  scroll: { flex: 1, paddingHorizontal: sp[5] },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp[3],
    marginTop: sp[4],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
    paddingVertical: sp[2],
    paddingHorizontal: sp[4],
    borderRadius: rd.full,
    borderWidth: 1,
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: sp[6],
    marginBottom: sp[4],
    textAlign: "center",
  },
  noResults: {
    alignItems: "center",
    paddingTop: 60,
    gap: sp[3],
  },
  noResultsText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  footer: {
    padding: sp[5],
    borderTopWidth: 1,
  },
  saveBtn: {
    borderRadius: rd.full,
    paddingVertical: sp[4],
    alignItems: "center",
  },
  saveBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
});
