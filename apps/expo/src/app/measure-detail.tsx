import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { MeasureArgumentRef, MeasureCitationRef } from "@acme/api";

import {
  BallotDetailEvidence,
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import {
  BallotAiDisclosure,
  BallotReadingCard,
  BallotReadingMode,
  BallotReadingText,
} from "~/components/ballot-evidence/BallotReadingCard";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { webUrl } from "~/components/ballot-evidence/model";
import { CardTranslationNotice } from "~/components/CardTranslationNotice";
import { Icon, NavHeader } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useBallotTranslation } from "~/hooks/useBallotTranslation";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";
import { ballotIdentityFromRoute } from "~/utils/ballot-translation";
import { parseRouteArray } from "~/utils/route-array";

export default function MeasureDetailScreen() {
  const { t: tx } = useAppTranslation();

  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const [mode, setMode] = useState<"overview" | "original">("overview");
  const original = useLocalSearchParams<{
    translationReference?: string;
    translationIdentity?: string;
    translationTitleField?: string;
    referendumTitle: string;
    referendumSubtitle: string;
    referendumProStatement: string;
    referendumConStatement: string;
    referendumText: string;
    referendumUrl: string;
    summary: string;
    summaryShort: string;
    summaryLong: string;
    summaryIsAiGenerated: string;
    fiscalImpact: string;
    proArguments: string;
    conArguments: string;
    citations: string;
  }>();
  const localization = useBallotTranslation(
    original.translationReference,
    ballotIdentityFromRoute(original.translationIdentity) ?? {
      kind: "measure",
      title: original.referendumTitle,
      candidates: [],
    },
  );
  const params = {
    ...original,
    referendumTitle: localization.text(
      original.translationTitleField ?? "referendumTitle",
      original.referendumTitle,
    ),
    referendumSubtitle: localization.text(
      "referendumSubtitle",
      original.referendumSubtitle,
    ),
    summary: localization.text("summary", original.summary),
    summaryShort: localization.text("summaryShort", original.summaryShort),
    summaryLong: localization.text("summaryLong", original.summaryLong),
    fiscalImpact: localization.text("fiscalImpact", original.fiscalImpact),
  };
  const proArgs = parseRouteArray<MeasureArgumentRef>(
    params.proArguments,
    ["text"],
    ["sourceName", "sourceUrl", "author"],
  ).map((arg, index) => ({
    ...arg,
    text: localization.text(`proArguments.${index}.text`, arg.text),
  }));
  const conArgs = parseRouteArray<MeasureArgumentRef>(
    params.conArguments,
    ["text"],
    ["sourceName", "sourceUrl", "author"],
  ).map((arg, index) => ({
    ...arg,
    text: localization.text(`conArguments.${index}.text`, arg.text),
  }));
  const citations = parseRouteArray<MeasureCitationRef>(
    params.citations,
    ["field", "sourceName"],
    ["sourceUrl", "tier", "fetchedAt", "verifiedAt", "verifiedBy"],
  );
  const pros = proArgs.length
    ? proArgs
    : params.referendumProStatement
      ? [{ text: params.referendumProStatement, sourceName: "" }]
      : [];
  const cons = conArgs.length
    ? conArgs
    : params.referendumConStatement
      ? [{ text: params.referendumConStatement, sourceName: "" }]
      : [];
  const summary =
    params.summaryShort ||
    params.summary ||
    params.summaryLong ||
    params.referendumSubtitle;
  const sourceUrl = webUrl(params.referendumUrl);
  const summaryIsAi =
    params.summaryIsAiGenerated === "true" ||
    citations.some(
      (citation) =>
        citation.tier === "ai_generated" &&
        ["summary", "summaryLong", "summaryShort"].includes(citation.field),
    );

  const hasContent = !!(
    summary ||
    params.fiscalImpact ||
    pros.length ||
    cons.length ||
    params.referendumText ||
    sourceUrl
  );

  const hasOverview = !!(
    summary ||
    params.fiscalImpact ||
    pros.length ||
    cons.length
  );
  const showingOriginal =
    !!params.referendumText && (!hasOverview || mode === "original");

  const isGenerated = (field: string) =>
    citations.some(
      (citation) =>
        citation.field === field && citation.tier === "ai_generated",
    );
  return (
    <View style={s.screen}>
      <NavHeader
        key={fontScale}
        title={tx("Measure")}
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        {original.translationReference && (
          <CardTranslationNotice
            items={[localization]}
            onRetry={localization.retry}
          />
        )}
        {localization.expired && (
          <Pressable onPress={() => router.replace("/ballot")}>
            <Text style={s.secondary}>{tx("Reload ballot to translate")}</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" style={s.title}>
          {params.referendumTitle}
        </Text>
        {params.referendumText && hasOverview && (
          <BallotReadingMode
            value={showingOriginal ? "original" : "overview"}
            onChange={setMode}
            options={[
              { value: "overview", label: tx("Overview") },
              { value: "original", label: tx("Original text") },
            ]}
          />
        )}
        {!showingOriginal && !params.referendumText && sourceUrl && (
          <SourceLink label={tx("Read original source")} url={sourceUrl} />
        )}
        {!hasContent ? (
          <View style={s.emptyCard}>
            <Text accessibilityRole="header" style={s.emptyTitle}>
              {tx("Measure details unavailable")}
            </Text>
            <Text style={s.emptyBody}>
              {tx(
                "Billion has no text or analysis for this measure. Check your election office for the official measure information.",
              )}
            </Text>
            <ElectionOfficeLink prominence="primary" />
          </View>
        ) : !showingOriginal ? (
          <>
            {summary ? (
              <BallotReadingCard
                inset
                title={tx("Measure overview")}
                icon={summaryIsAi ? "sparkle" : "book"}
                accent
                text={summary}
                extendedText={params.summaryLong || params.summary}
                label={summaryIsAi ? <BallotAiDisclosure /> : undefined}
              />
            ) : (
              <Text style={s.secondary}>
                {tx("A summary is unavailable to Billion.")}
              </Text>
            )}
            {params.fiscalImpact && (
              <BallotReadingCard
                inset
                title={tx("Fiscal impact")}
                icon="trendingUp"
                text={params.fiscalImpact}
                label={
                  isGenerated("fiscalImpact") ? (
                    <BallotAiDisclosure
                      label={tx("AI-generated explanation")}
                    />
                  ) : undefined
                }
              />
            )}
            {pros.length > 0 && (
              <ArgumentCard
                title={tx("Arguments in favor")}
                args={pros}
                generated={isGenerated("proArguments")}
              />
            )}
            {cons.length > 0 && (
              <ArgumentCard
                title={tx("Arguments against")}
                args={cons}
                generated={isGenerated("conArguments")}
              />
            )}
          </>
        ) : (
          <>
            {sourceUrl && (
              <SourceLink
                label={tx("Open original source")}
                url={sourceUrl}
                prominence="primary"
              />
            )}
            <BallotReadingCard
              title={tx("Original measure text")}
              text={params.referendumText}
            />
          </>
        )}
        <BallotDetailEvidence
          citations={citations}
          showOfficeLink={hasContent}
        />
      </ScrollView>
    </View>
  );
}

function ArgumentCard({
  title,
  args,
  generated,
}: {
  title: string;
  args: MeasureArgumentRef[];
  generated: boolean;
}) {
  const { t: tx } = useAppTranslation();

  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.argumentCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${tx("measure.argumentCount", { count: args.length })}`}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={s.argumentHeader}
      >
        <View style={s.iconTile}>
          <Icon name="message" size={20} color={P.inkOnNight} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.argumentTitle}>{title}</Text>
          <Text style={s.secondary}>
            {tx("measure.argumentCount", { count: args.length })}
          </Text>
        </View>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={P.inkOnNight}
        />
      </Pressable>
      {expanded && (
        <View style={s.argumentBody}>
          {generated && (
            <BallotAiDisclosure label={tx("AI-generated explanation")} />
          )}
          <View style={{ gap: sp[4] }}>
            {args.map((arg, index) => (
              <View key={index} style={{ gap: sp[2] }}>
                <BallotReadingText text={arg.text} />
                {(arg.author ?? arg.sourceName) &&
                  (arg.sourceUrl ? (
                    <SourceLink
                      label={arg.author ?? arg.sourceName}
                      url={arg.sourceUrl}
                    />
                  ) : (
                    <Text style={s.secondary}>
                      {arg.author ?? arg.sourceName}
                    </Text>
                  ))}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  emptyCard: {
    backgroundColor: P.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.border,
    padding: 20,
    gap: 12,
  },
  argumentCard: {
    backgroundColor: P.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.border,
    padding: 16,
  },
  argumentHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  argumentTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  argumentBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: P.border,
    gap: 12,
  },
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: 20,
    paddingTop: sp[5],
    paddingBottom: sp[12],
    gap: 18,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 34,
    color: P.inkOnNight,
    marginBottom: sp[2],
  },
  emptyBody: {
    fontFamily: fontBody.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  emptyTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  secondary: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.inkOnNight,
    opacity: 0.7,
  },
});
