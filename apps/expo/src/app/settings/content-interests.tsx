import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { AppStringKey } from "~/i18n/app-strings";
import type { ContentTypeKey } from "~/styles";
import { Text } from "~/components/Themed";
import { Kicker, Pill, ScreenShell, Toggle } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { hasAppString } from "~/i18n/app-strings";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";
import { queryClient, trpc } from "~/utils/api";

/** Stored preference values stay English; only the chip label translates. */
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

const CATS: { id: ContentTypeKey; label: AppStringKey }[] = [
  { id: "bill", label: "interests.bills" },
  { id: "exec", label: "interests.exec" },
  { id: "court", label: "interests.court" },
  { id: "local", label: "interests.local" },
];

export default function ContentInterestsScreen() {
  const { t } = useAppTranslation();
  const topicLabel = (topic: string) => {
    const key = `topic.${topic}`;
    return hasAppString(key) ? t(key) : topic;
  };
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
    <ScreenShell title={t("interests.title")}>
      <Kicker>{t("interests.topicCount", { count: topics.size })}</Kicker>
      <View style={s.chips}>
        {TOPICS.map((x) => (
          <Pill
            key={x}
            label={topicLabel(x)}
            active={topics.has(x)}
            icon={topics.has(x) ? "check" : undefined}
            onPress={() => toggleTopic(x)}
          />
        ))}
      </View>

      <Kicker>{t("interests.types")}</Kicker>
      {CATS.map((c, i) => (
        <View key={c.id} style={[s.catRow, i < CATS.length - 1 && s.divider]}>
          <Text style={s.catKicker}>{t(`contentType.${c.id}`)}</Text>
          <Text style={s.catLabel}>{t(c.label)}</Text>
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
