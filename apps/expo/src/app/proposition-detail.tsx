import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotReadingCard } from "~/components/ballot-evidence/BallotReadingCard";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";
import { trpc } from "~/utils/api";
import {
  PROPOSITION_AI_LABEL,
  propositionExplainer,
  submittedGuideArguments,
} from "~/utils/proposition-explainers";

export default function PropositionDetailScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams<{ number?: string }>();
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const measure = query.data?.measures.find((item) => item.number === number);
  const explainer = measure
    ? propositionExplainer(measure.number, measure.title, measure.sourceUrl)
    : null;
  const proArguments = submittedGuideArguments(measure?.proArguments);
  const conArguments = submittedGuideArguments(measure?.conArguments);

  return (
    <View style={s.screen}>
      <NavHeader
        title="Statewide proposition"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        {query.isPending ? (
          <View style={s.state}>
            <ActivityIndicator color={P.primary} />
            <Text style={s.body}>Loading the official proposition guide…</Text>
          </View>
        ) : query.isError ? (
          <StateCard
            title="Could not load the guide"
            detail="Check your connection and try again."
            onRetry={() => void query.refetch()}
          />
        ) : !query.data ? (
          <StateCard
            title="Official guide unavailable in Billion"
            detail="Billion cannot currently load the official guide. You can read it directly from California."
            onRetry={() => void query.refetch()}
          />
        ) : !measure ? (
          <StateCard
            title="Proposition unavailable"
            detail="This proposition is not in the current California statewide guide."
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            <View style={s.identity}>
              <Text style={s.kicker}>
                CALIFORNIA · NOVEMBER 3, 2026 · PROP {measure.number}
              </Text>
              <Text style={s.officialLabel}>OFFICIAL BALLOT TITLE</Text>
              <Text accessibilityRole="header" style={s.title}>
                {measure.title}
              </Text>
              <SourceLink
                label="Open official proposition page"
                url={measure.sourceUrl}
              />
            </View>

            {explainer ? (
              <>
                <View style={s.hero}>
                  <Text style={s.draft}>{PROPOSITION_AI_LABEL}</Text>
                  <Text accessibilityRole="header" style={s.headline}>
                    {explainer.headline}
                  </Text>
                  <Text style={s.heroBody}>
                    Independent explanation. Check the official guide and
                    analysis linked with each section.
                  </Text>
                </View>
                <View style={s.section}>
                  <Text accessibilityRole="header" style={s.heading}>
                    What changes
                  </Text>
                  <Text style={s.body}>{explainer.statusQuo}</Text>
                  <View style={s.diagram}>
                    {explainer.steps.map((step, index) => (
                      <View key={step.label} style={s.step}>
                        <View style={s.stepNumber}>
                          <Text style={s.stepNumberText}>{index + 1}</Text>
                        </View>
                        <View style={s.stepText}>
                          <Text style={s.stepLabel}>{step.label}</Text>
                          <Text style={s.body}>{step.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <SourceLink
                    label="Source: Legislative Analyst's analysis"
                    url={explainer.analysisUrl}
                  />
                </View>
                <View style={s.voteRow}>
                  <VoteCard
                    label="A Yes vote"
                    text={explainer.yes}
                    sourceUrl={measure.sourceUrl}
                  />
                  <VoteCard
                    label="A No vote"
                    text={explainer.no}
                    sourceUrl={measure.sourceUrl}
                  />
                </View>
                <View style={s.section}>
                  <Text accessibilityRole="header" style={s.heading}>
                    Who and how
                  </Text>
                  <Text style={s.body}>{explainer.affected}</Text>
                  <SourceLink
                    label="Source: Legislative Analyst's analysis"
                    url={explainer.analysisUrl}
                  />
                </View>
                <View style={s.section}>
                  <Text accessibilityRole="header" style={s.heading}>
                    Money and uncertainty
                  </Text>
                  <Text style={s.body}>{explainer.fiscal}</Text>
                  <SourceLink
                    label="Source: Legislative Analyst's fiscal analysis"
                    url={explainer.analysisUrl}
                  />
                </View>
              </>
            ) : (
              <View style={s.section}>
                <Text accessibilityRole="header" style={s.heading}>
                  Explanation in review
                </Text>
                <Text style={s.body}>
                  Billion has not published a plain-language explanation for
                  this proposition. The official material below is available
                  now.
                </Text>
              </View>
            )}

            {measure.officialSummary ? (
              <BallotReadingCard
                title="Official summary"
                text={measure.officialSummary}
              />
            ) : (
              <Text style={s.caption}>
                Official summary unavailable in Billion. Open the state guide
                above.
              </Text>
            )}
            {measure.fiscalImpact ? (
              <BallotReadingCard
                title="Official fiscal impact"
                text={measure.fiscalImpact}
              />
            ) : (
              <Text style={s.caption}>
                Official fiscal estimate unavailable in Billion. Open the state
                guide above.
              </Text>
            )}
            <View style={s.section}>
              <Text accessibilityRole="header" style={s.heading}>
                Arguments submitted to the guide
              </Text>
              <Text style={s.caption}>
                These are advocacy statements, not independent findings. Their
                presence does not indicate equal evidentiary support.
              </Text>
              {proArguments.length ? (
                proArguments.map((arg, i) => (
                  <BallotReadingCard
                    key={`pro-${i}`}
                    title="Argument for"
                    text={arg.text}
                  />
                ))
              ) : (
                <Text style={s.caption}>
                  No argument for was provided in this guide entry.
                </Text>
              )}
              {conArguments.length ? (
                conArguments.map((arg, i) => (
                  <BallotReadingCard
                    key={`con-${i}`}
                    title="Argument against"
                    text={arg.text}
                  />
                ))
              ) : (
                <Text style={s.caption}>
                  No argument against was provided in this guide entry.
                </Text>
              )}
              <SourceLink
                label="Official arguments and rebuttals"
                url={`${measure.sourceUrl}arguments-rebuttals.htm`}
              />
            </View>
            <View style={s.section}>
              <Text accessibilityRole="header" style={s.heading}>
                Check the original
              </Text>
              <Text style={s.caption}>
                Source: California Secretary of State Official Voter Information
                Guide. Retrieved{" "}
                {query.data.fetchedAt
                  ? `${query.data.fetchedAt.slice(0, 10)} UTC`
                  : "date unavailable"}
                . Billion's explanation is AI-written and has not completed
                editorial review.
              </Text>
              <SourceLink
                label="Official title and summary"
                url={`${measure.sourceUrl}title-summary.htm`}
              />
              {measure.fullTextUrl && (
                <SourceLink
                  label="Text of proposed law (PDF)"
                  url={measure.fullTextUrl}
                />
              )}
              <SourceLink
                label="Full official guide entry"
                url={measure.sourceUrl}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function VoteCard({
  label,
  text,
  sourceUrl,
}: {
  label: string;
  text: string;
  sourceUrl: string;
}) {
  return (
    <View style={s.voteCard}>
      <Text accessibilityRole="header" style={s.voteLabel}>
        {label}
      </Text>
      <Text style={s.body}>{text}</Text>
      <SourceLink label="Source: official vote meaning" url={sourceUrl} />
    </View>
  );
}

function StateCard({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <View style={s.state}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      <Text style={s.body}>{detail}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}>
        <Text style={s.retryText}>Try again</Text>
      </Pressable>
      <SourceLink
        label="California official proposition guide"
        url="https://voterguide.sos.ca.gov/propositions/"
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: 20,
    paddingTop: sp[5],
    paddingBottom: sp[12],
    gap: 18,
  },
  identity: { gap: 12 },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: P.primary,
    letterSpacing: 1,
  },
  officialLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: P.quiet,
    letterSpacing: 1,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 27,
    lineHeight: 34,
    color: P.inkOnNight,
  },
  hero: { backgroundColor: P.paper, borderRadius: 16, padding: 20, gap: 12 },
  draft: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.7,
    color: P.ink,
  },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 25,
    lineHeight: 32,
    color: P.ink,
  },
  heroBody: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.ink,
  },
  section: {
    backgroundColor: P.card,
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 13,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 25,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.quiet,
  },
  diagram: { gap: 0 },
  step: { flexDirection: "row", gap: 12, paddingVertical: 11 },
  stepNumber: {
    backgroundColor: P.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: fontBody.bold, fontSize: 14, color: P.canvas },
  stepText: { flex: 1, gap: 4 },
  stepLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.inkOnNight,
  },
  voteRow: { gap: 12 },
  voteCard: {
    backgroundColor: P.card,
    borderColor: P.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  voteLabel: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    color: P.inkOnNight,
  },
  state: { backgroundColor: P.card, borderRadius: 14, padding: 20, gap: 14 },
  retry: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: P.primary,
  },
  retryText: { fontFamily: fontBody.semibold, fontSize: 16, color: P.canvas },
});
