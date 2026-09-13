import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { ContentTypeKey } from "~/styles";
import { Text } from "~/components/Themed";
import { Kicker, Pill, ScreenShell, Toggle } from "~/components/ui";
import { posthog } from "~/config/posthog";
import {
  contentType,
  DigestHair,
  fontBody,
  DigestPalette as P,
} from "~/styles";
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
      posthog.capture("content_interests_updated", {
        topic_count: newTopics.size,
        topics: [...newTopics],
        content_types: [...newCats],
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
    <ScreenShell title="Interests">
      <Kicker>{`${topics.size} topics`}</Kicker>
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

      <Kicker>Types</Kicker>
      {CATS.map((c, i) => (
        <View key={c.id} style={[s.catRow, i < CATS.length - 1 && s.divider]}>
          <Text style={s.catKicker}>{contentType[c.id].label}</Text>
          <Text style={s.catLabel}>{c.label}</Text>
          <Toggle on={cats.has(c.id)} onChange={() => toggleCat(c.id)} />
        </View>
      ))}
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 32,
    marginTop: 4,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  catKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
  },
  catLabel: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: P.inkOnNight,
  },
});
