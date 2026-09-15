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
  AiSummaryLabel,
  BallotDetailEvidence,
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import {
  BallotReadingCard,
  BallotReadingMode,
  BallotReadingText,
} from "~/components/ballot-evidence/BallotReadingCard";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { webUrl } from "~/components/ballot-evidence/model";
import { Icon, NavHeader } from "~/components/ui";
import {
  DigestSpace,
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function MeasureDetailScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const [mode, setMode] = useState<"overview" | "original">("overview");
  const params = useLocalSearchParams<{
    referendumTitle: string;
    referendumSubtitle: string;
    referendumProStatement: string;
    referendumConStatement: string;
    referendumText: string;
    referendumUrl: string;
    summary: string;
    summaryLong: string;
    summaryIsAiGenerated: string;
    fiscalImpact: string;
    proArguments: string;
    conArguments: string;
    citations: string;
  }>();
  const proArgs = parseJson<MeasureArgumentRef[]>(params.proArguments, []);
  const conArgs = parseJson<MeasureArgumentRef[]>(params.conArguments, []);
  const citations = parseJson<MeasureCitationRef[]>(params.citations, []);
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
    params.summaryLong || params.summary || params.referendumSubtitle;
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

  const showingOriginal = mode === "original" && !!params.referendumText;

  const isGenerated = (field: string) =>
    citations.some(
      (citation) =>
        citation.field === field && citation.tier === "ai_generated",
    );
  return (
    <View style={s.screen}>
      <NavHeader
        key={fontScale}
        title="Measure"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>
          {params.referendumTitle}
        </Text>
        {params.referendumText && (
          <BallotReadingMode
            value={showingOriginal ? "original" : "overview"}
            onChange={setMode}
            options={[
              { value: "overview", label: "Overview" },
              { value: "original", label: "Original text" },
            ]}
          />
        )}
        {!showingOriginal && !params.referendumText && sourceUrl && (
          <SourceLink label="Read original source" url={sourceUrl} />
        )}
        {!hasContent ? (
          <View style={s.emptyCard}>
            <Text accessibilityRole="header" style={s.emptyTitle}>
              Measure details unavailable
            </Text>
            <Text style={s.emptyBody}>
              Billion has no text or analysis for this measure. Check your
              election office for the official measure information.
            </Text>
            <ElectionOfficeLink prominence="primary" />
          </View>
        ) : !showingOriginal ? (
          <>
            {summary ? (
              <BallotReadingCard
                title="Measure overview"
                text={summary}
                label={summaryIsAi ? <AiSummaryLabel /> : undefined}
              />
            ) : (
              <Text style={s.secondary}>
                A summary is unavailable to Billion.
              </Text>
            )}
            {params.fiscalImpact && (
              <BallotReadingCard
                inset
                title="Fiscal impact"
                text={params.fiscalImpact}
                label={
                  isGenerated("fiscalImpact") ? (
                    <AiSummaryLabel label="AI-generated explanation" />
                  ) : undefined
                }
              />
            )}
            {pros.length > 0 && (
              <ArgumentCard
                title="Arguments in favor"
                args={pros}
                generated={isGenerated("proArguments")}
              />
            )}
            {cons.length > 0 && (
              <ArgumentCard
                title="Arguments against"
                args={cons}
                generated={isGenerated("conArguments")}
              />
            )}
          </>
        ) : (
          <BallotReadingCard
            title="Original measure text"
            text={params.referendumText}
          >
            {sourceUrl && (
              <SourceLink label="Open original source" url={sourceUrl} />
            )}
          </BallotReadingCard>
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
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.argumentCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${args.length} ${args.length === 1 ? "argument" : "arguments"}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.argumentHeader}
      >
        <View style={s.iconTile}>
          <Icon name="message" size={20} color={P.inkOnNight} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.argumentTitle}>{title}</Text>
          <Text style={s.secondary}>
            {args.length} {args.length === 1 ? "argument" : "arguments"}
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
          {generated && <AiSummaryLabel label="AI-generated explanation" />}
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
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  argumentTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 23,
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
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: sp[5],
    paddingBottom: sp[12],
    gap: sp[6],
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 40,
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
    fontSize: 22,
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
