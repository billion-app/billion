import {
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
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import {
  BallotReadingCard,
  BallotReadingText,
} from "~/components/ballot-evidence/BallotReadingCard";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { webUrl } from "~/components/ballot-evidence/model";
import { NavHeader } from "~/components/ui";
import { DigestSpace, fontBody, DigestPalette as P, sp } from "~/styles";

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
        {summary ? (
          <BallotReadingCard
            title="Overview"
            text={summary}
            label={summaryIsAi ? <AiSummaryLabel /> : undefined}
          />
        ) : (
          <Text style={s.secondary}>A summary is unavailable to Billion.</Text>
        )}
        {params.fiscalImpact && (
          <BallotReadingCard
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
        {params.referendumText && (
          <BallotReadingCard
            title="Original text"
            text={params.referendumText}
          />
        )}
        {sourceUrl && (
          <SourceLink label="Read measure source" url={sourceUrl} />
        )}
        <BallotDetailEvidence citations={citations} />
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
  return (
    <BallotReadingCard
      title={title}
      label={
        generated ? (
          <AiSummaryLabel label="AI-generated explanation" />
        ) : undefined
      }
    >
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
              <Text style={s.secondary}>{arg.author ?? arg.sourceName}</Text>
            ))}
        </View>
      ))}
    </BallotReadingCard>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: sp[5],
    paddingBottom: sp[12],
    gap: sp[4],
  },
  title: {
    fontFamily: fontBody.semibold,
    fontSize: 28,
    color: P.inkOnNight,
    marginBottom: sp[2],
  },
  secondary: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.inkOnNight,
    opacity: 0.7,
  },
});
