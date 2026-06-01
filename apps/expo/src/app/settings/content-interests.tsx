import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { ContentTypeKey } from "~/styles";
import { Text } from "~/components/Themed";
import {
  Badge,
  Card,
  Kicker,
  Pill,
  ScreenShell,
  Toggle,
} from "~/components/ui";
import { colors, fontBody, hair } from "~/styles";
import { queryClient, trpc } from "~/utils/api";

const TOPICS = [
  "Healthcare",
  "Climate",
  "Economy",
  "Civil rights",
  "Technology",
  "Education",
  "Immigration",
  "Foreign policy",
  "Housing",
  "Criminal justice",
  "Labor",
  "Elections",
];

const CATS: { id: ContentTypeKey; label: string }[] = [
  { id: "bill", label: "Bills & resolutions" },
  { id: "exec", label: "Executive actions" },
  { id: "court", label: "Court cases" },
  { id: "local", label: "Local & state" },
];

export default function ContentInterestsScreen() {
  const prefsQuery = useQuery(trpc.user.getPreferences.queryOptions());
  const saveMutation = useMutation({
    ...trpc.user.setPreferences.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.user.getPreferences.queryKey(),
      });
    },
  });

  const [topics, setTopics] = useState(new Set<string>());
  const [cats, setCats] = useState(new Set<ContentTypeKey>());
  const [synced, setSynced] = useState(false);

  if (prefsQuery.data && !synced) {
    setTopics(new Set(prefsQuery.data.topics));
    setCats(new Set(prefsQuery.data.contentTypes as ContentTypeKey[]));
    setSynced(true);
  }

  const save = useCallback(
    (newTopics: Set<string>, newCats: Set<ContentTypeKey>) => {
      saveMutation.mutate({
        topics: [...newTopics],
        contentTypes: [...newCats],
      });
    },
    [saveMutation],
  );

  const toggleTopic = (x: string) =>
    setTopics((prev) => {
      const n = new Set(prev);
      if (n.has(x)) n.delete(x);
      else n.add(x);
      save(n, cats);
      return n;
    });
  const toggleCat = (id: ContentTypeKey) =>
    setCats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      save(topics, n);
      return n;
    });

  return (
    <ScreenShell title="Content Interests">
      <Text style={s.intro}>
        Tune what surfaces in your feed.{" "}
        <Text style={s.introEm}>{topics.size} topics</Text> selected.
      </Text>

      <Kicker>Topics</Kicker>
      <View style={s.chips}>
        {TOPICS.map((x) => (
          <Pill
            key={x}
            label={x}
            active={topics.has(x)}
            icon={topics.has(x) ? "check" : undefined}
            onPress={() => toggleTopic(x)}
          />
        ))}
      </View>

      <Kicker>Content types</Kicker>
      <Card flush>
        {CATS.map((c, i) => (
          <View key={c.id} style={[s.catRow, i < CATS.length - 1 && s.divider]}>
            <Badge type={c.id} />
            <Text style={s.catLabel}>{c.label}</Text>
            <Toggle on={cats.has(c.id)} onChange={() => toggleCat(c.id)} />
          </View>
        ))}
      </Card>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 22,
    lineHeight: 21,
  },
  introEm: { color: colors.white, fontFamily: fontBody.semibold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 28 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: hair[1] },
  catLabel: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
});
