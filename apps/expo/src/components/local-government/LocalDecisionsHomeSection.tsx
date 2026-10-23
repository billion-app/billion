import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useLocalJurisdictions } from "~/hooks/useLocalJurisdictions";
import { useSavedContent } from "~/hooks/useSavedContent";
import {
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { PUBLIC_CONTENT_STALE_TIME } from "~/utils/card-translation";
import {
  detectJurisdictionKey,
  localJurisdictionText,
  selectHomeDecisions,
} from "~/utils/local-government";
import { DecisionCard } from "./DecisionCard";
import { DecisionListSkeleton } from "./DecisionSkeletons";

export function LocalDecisionsHomeSection({
  address,
}: {
  address: string | null | undefined;
}) {
  const { t, language } = useAppTranslation();
  const router = useRouter();
  const active = useLocalJurisdictions();
  const detected = detectJurisdictionKey(address);
  const jurisdiction = detected && active.includes(detected) ? detected : null;
  const { savedIds } = useSavedContent();
  const query = useQuery({
    ...trpc.legistar.listDecisions.queryOptions({
      jurisdiction: jurisdiction ?? "sanjose",
      timeline: "upcoming",
      limit: 12,
    }),
    enabled: jurisdiction !== null,
    staleTime: PUBLIC_CONTENT_STALE_TIME,
  });
  if (!jurisdiction) return null;
  const city = localJurisdictionText(jurisdiction, language).name;
  const rows = selectHomeDecisions(query.data ?? [], new Set(savedIds));
  const empty = query.isSuccess && rows.length === 0;
  return (
    <View style={s.section}>
      <Text style={s.kicker}>{t("local.home.kicker", { city })}</Text>
      <Text style={s.title} accessibilityRole="header">
        {t("What {value1} is deciding", { value1: city })}
      </Text>
      <Text style={s.note}>{t("local.home.source")}</Text>
      {language !== "en" && (
        <Text style={s.note}>{t("local.sourceEnglish")}</Text>
      )}
      {query.isLoading ? (
        <DecisionListSkeleton count={2} />
      ) : query.isError && !query.data ? (
        <View>
          <Text style={s.note}>{t("local.home.error")}</Text>
          <TouchableOpacity
            style={s.action}
            accessibilityRole="button"
            onPress={() => void query.refetch()}
          >
            <Text style={s.link}>{t("common.tryAgain")}</Text>
          </TouchableOpacity>
        </View>
      ) : empty ? (
        <Text style={s.note}>{t("local.home.empty", { city })}</Text>
      ) : (
        rows.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            onPress={() =>
              router.push({
                pathname: "/local-decision-detail",
                params: { id: decision.id },
              })
            }
          />
        ))
      )}
      <TouchableOpacity
        style={s.action}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/local-decisions",
            params: { jurisdiction, timeline: empty ? "recent" : "upcoming" },
          })
        }
      >
        <Text style={s.link}>
          {t(empty ? "local.home.recent" : "local.home.all")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    marginHorizontal: DigestSpace.screenPadX,
    marginTop: 24,
    marginBottom: 12,
    gap: 12,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: P.spark,
    textTransform: "uppercase",
  },
  title: { fontFamily: fontDisplay.bold, fontSize: 25, color: P.inkOnNight },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.quiet,
  },
  action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  link: { fontFamily: fontBody.semibold, fontSize: 13, color: P.spark },
});
