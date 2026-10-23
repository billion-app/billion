import { useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { SavedRow } from "~/utils/saved-content";
import { CardTranslationNotice } from "~/components/CardTranslationNotice";
import { EmptySearchMark } from "~/components/digest/CraftMarks";
import { DecisionCard } from "~/components/local-government/DecisionCard";
import { Text } from "~/components/Themed";
import { ContentCard, NavHeader } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useCardTranslationPolling } from "~/hooks/useCardTranslationPolling";
import { useSavedContent } from "~/hooks/useSavedContent";
import {
  DigestHair,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { PUBLIC_CONTENT_STALE_TIME } from "~/utils/card-translation";
import { toCardItem } from "~/utils/content";
import { hydrateSavedRows } from "~/utils/saved-content";

function SwipeableSavedCard({
  item,
  onPress,
  onUnsave,
}: {
  item: SavedRow;
  onPress: () => void;
  onUnsave: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const { language, t } = useAppTranslation();

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      activeOffsetX={[-15, 15]}
      failOffsetY={[-12, 12]}
      renderRightActions={() => (
        <TouchableOpacity
          style={s.unsaveAction}
          activeOpacity={0.8}
          onPress={() => {
            swipeableRef.current?.close();
            onUnsave();
          }}
          accessibilityRole="button"
          accessibilityLabel={t("saved.removeA11y")}
        >
          <Text style={s.unsaveText}>{t("common.remove")}</Text>
        </TouchableOpacity>
      )}
    >
      {item.kind === "content" ? (
        <ContentCard
          saved
          item={toCardItem(item.content, { showJurisdiction: true, language })}
          onPress={onPress}
        />
      ) : item.kind === "local" ? (
        <View style={{ paddingVertical: 12 }}>
          <DecisionCard decision={item.decision} onPress={onPress} />
        </View>
      ) : (
        <View style={{ paddingVertical: 20, gap: 8 }}>
          <Text style={s.emptySub}>{t("local.saved.unavailable")}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("saved.removeA11y")}
            onPress={onUnsave}
            style={s.retry}
          >
            <Text style={s.retryText}>{t("common.remove")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Swipeable>
  );
}

export default function SavedArticlesScreen() {
  const router = useRouter();
  const { t, language } = useAppTranslation();
  const { savedIds, removeSaved } = useSavedContent();

  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.content.byIds.queryOptions({ ids: savedIds, language }),
    enabled: savedIds.length > 0,
    staleTime: PUBLIC_CONTENT_STALE_TIME,
  });

  const local = useQuery({
    ...trpc.legistar.byIds.queryOptions({ ids: savedIds }),
    enabled: savedIds.length > 0,
    staleTime: PUBLIC_CONTENT_STALE_TIME,
  });

  const translations = useCardTranslationPolling({
    data,
    language,
    refetch,
    enabled: savedIds.length > 0,
  });
  const list = hydrateSavedRows(savedIds, data?.items ?? [], local.data ?? []);

  return (
    <View style={s.screen}>
      <NavHeader title={t("saved.title")} onBack={() => router.back()} />
      {(isLoading || local.isLoading) && savedIds.length > 0 ? (
        <ActivityIndicator
          color={P.inkOnNight}
          style={{ marginTop: 40 }}
          accessibilityLabel={t("common.loading")}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            list.length > 0 ? (
              <>
                <CardTranslationNotice
                  items={data?.items ?? []}
                  isError={translations.isError}
                  onRetry={translations.retry}
                />
                {(error !== null || local.error !== null) && (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    <Text style={s.emptySub}>{t("local.saved.retry")}</Text>
                    <TouchableOpacity
                      style={s.retry}
                      accessibilityRole="button"
                      onPress={() => {
                        void refetch();
                        void local.refetch();
                      }}
                    >
                      <Text style={s.retryText}>{t("common.tryAgain")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={s.intro}>
                  {t("saved.count", { count: list.length })}
                </Text>
              </>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: DigestHair.sectionRule,
              }}
            />
          )}
          renderItem={({ item }) => (
            <SwipeableSavedCard
              item={item}
              onPress={() =>
                router.push({
                  pathname:
                    item.kind === "local"
                      ? "/local-decision-detail"
                      : "/article-detail",
                  params: { id: item.id },
                })
              }
              onUnsave={() => removeSaved(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <EmptySearchMark width={88} />
              <Text style={s.emptyTitle}>{t("saved.empty")}</Text>
              <Text style={s.emptySub}>{t("saved.emptySub")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingBottom: 48,
    flexGrow: 1,
  },
  intro: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: P.quiet,
    marginBottom: 16,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 20,
    color: P.inkOnNight,
  },
  emptySub: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: P.quiet,
  },
  retry: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
  },
  unsaveAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    marginLeft: 12,
    borderRadius: 16,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  unsaveText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.inkOnNight,
  },
});
