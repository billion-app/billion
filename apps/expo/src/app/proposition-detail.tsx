import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { trillionEmphasis } from "@acme/validators";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { MeasureRelationships } from "~/components/ballot-evidence/MeasureRelationships";
import { webUrl } from "~/components/ballot-evidence/model";
import { PropositionConsequences } from "~/components/ballot-evidence/PropositionConsequences";
import {
  ContextUnavailable,
  PropositionContext,
} from "~/components/ballot-evidence/PropositionContext";
import { ListenBar } from "~/components/ListenBar";
import { ReaderTools } from "~/components/ReaderTools";
import { developmentDebate } from "~/components/trillion/development/pilots";
import { TrillionLoading } from "~/components/trillion/TrillionLoading";
import { TrillionScreen } from "~/components/trillion/TrillionScreen";
import { Icon, NavHeader } from "~/components/ui";
import { useArticleSpeech } from "~/hooks/useArticleSpeech";
import { useMeasureTranslation } from "~/hooks/useMeasureTranslation";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";
import { trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { measureSpeechChunks } from "~/utils/measure-speech";
import {
  officialVoteMeaning,
  splitOfficialTitle,
  submittedGuideArguments,
} from "~/utils/proposition-explainers";

export default function PropositionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { number } = useLocalSearchParams<{ number?: string }>();
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const originalMeasure = query.data?.measures.find(
    (item) => item.number === number,
  );
  // A proposition with a debate is read as its Trillion (#455). The graph
  // appears only once it passes the server's publication gate; until then, and
  // for measures without one, the page below is the explanation.
  const debate = useQuery(
    trpc.civic.getTrillion.queryOptions(
      { number: number ?? "" },
      { enabled: !!number },
    ),
  );
  const graph =
    debate.data ??
    (originalMeasure ? developmentDebate(originalMeasure.number) : undefined);
  const translation = useMeasureTranslation(
    !graph && !debate.isPending ? number : undefined,
  );
  const measure = useMemo(
    () =>
      translation.translation && originalMeasure
        ? { ...originalMeasure, ...translation.translation.measure }
        : originalMeasure,
    [originalMeasure, translation.translation],
  );
  const proArguments = submittedGuideArguments(measure?.proArguments);
  const conArguments = submittedGuideArguments(measure?.conArguments);
  const spokenLanguage = translation.translation ? translation.language : "en";
  const chunks = useMemo(
    () => (measure ? measureSpeechChunks(measure, spokenLanguage) : []),
    [measure, spokenLanguage],
  );
  const speech = useArticleSpeech({
    chunks,
    language: spokenLanguage,
    mode: "explainer",
    contentId: number,
  });
  if (graph)
    return (
      <TrillionScreen
        graph={graph}
        ballot={query.data?.measures.map((item) => item.number)}
      />
    );

  if (query.isPending || (!!measure && debate.isPending))
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ReaderTools
            speech={speech}
            state={translation.state}
            onRetry={translation.retry}
          />
        </View>
        <TrillionLoading
          number={number}
          electionDate={query.data?.electionDate}
          onBack={() => router.back()}
        />
      </View>
    );

  return (
    <View style={s.screen}>
      <NavHeader
        title={`Proposition ${number ?? ""}`}
        tone="dark"
        onBack={() => router.back()}
      />
      <ReaderTools
        speech={speech}
        state={translation.state}
        onRetry={translation.retry}
      />
      <ScrollView contentContainerStyle={s.content}>
        {query.isError ? (
          <StateCard
            title="Could not load the guide"
            detail="Try again, or open California’s official voter guide."
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
            <View style={s.lead}>
              <Text style={s.kicker}>
                California · {ballotElectionDate(query.data.electionDate)}
              </Text>
            </View>
            {!measure.consequences &&
              (measure.displayTitle ? (
                <View style={s.lead}>
                  <Text accessibilityRole="header" style={s.displayTitle}>
                    {trillionEmphasis(measure.displayTitle).map(
                      (part, index) => (
                        <Text
                          key={index}
                          style={part.bold ? s.displayTitleBold : undefined}
                        >
                          {part.text}
                        </Text>
                      ),
                    )}
                  </Text>
                  <Text style={s.caption}>
                    {[
                      splitOfficialTitle(measure.title).kind,
                      translation.translation
                        ? "Machine-translated official title"
                        : "Official title, bold added by Billion",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              ) : (
                <Text accessibilityRole="header" style={s.recordTitle}>
                  {measure.title}
                </Text>
              ))}
            {measure.consequences ? (
              <PropositionConsequences analysis={measure.consequences} />
            ) : (
              <View style={s.lead}>
                {measure.voteMeaningYes && measure.voteMeaningNo && (
                  <Text style={s.caption}>
                    Official guide · Billion’s explanation isn’t available yet.
                  </Text>
                )}
                {!(measure.voteMeaningYes && measure.voteMeaningNo) && (
                  <>
                    <Text style={s.body}>
                      Billion’s explanation and a complete official Yes/No
                      comparison aren’t available here yet.
                    </Text>
                    <InlineSource
                      label="Open official voter guide"
                      url={measure.sourceUrl}
                    />
                  </>
                )}
              </View>
            )}
            {!measure.consequences &&
            measure.voteMeaningYes &&
            measure.voteMeaningNo ? (
              <View style={s.voteSection}>
                <Text accessibilityRole="header" style={s.heading}>
                  What your vote means
                </Text>
                <Text style={s.caption}>
                  From the official California voter guide
                </Text>
                <View style={s.voteCard}>
                  <Outcome
                    label="YES"
                    body={officialVoteMeaning(measure.voteMeaningYes, "YES")}
                  />
                  <View style={s.voteDivider} />
                  <Outcome
                    label="NO"
                    body={officialVoteMeaning(measure.voteMeaningNo, "NO")}
                  />
                </View>
              </View>
            ) : null}
            {!measure.consequences &&
              measure.voteMeaningYes &&
              measure.voteMeaningNo && (
                <InlineSource
                  label="Open official voter guide"
                  url={measure.sourceUrl}
                />
              )}
            {measure.contextualExplanation ? (
              <PropositionContext analysis={measure.contextualExplanation} />
            ) : (
              <ContextUnavailable sourceUrl={measure.sourceUrl} />
            )}
            <MeasureRelationships
              number={measure.number}
              relationships={measure.relationships}
            />

            <View style={s.record}>
              {measure.officialSummary ||
              measure.fiscalImpact ||
              measure.consequences ||
              proArguments.length ||
              conArguments.length ? (
                <Text accessibilityRole="header" style={s.heading}>
                  Official record
                </Text>
              ) : null}
              {measure.consequences &&
                measure.voteMeaningYes &&
                measure.voteMeaningNo && (
                  <DetailDisclosure
                    title="Official Yes/No descriptions"
                    subtitle="California SOS wording"
                  >
                    <Outcome
                      label="YES"
                      body={officialVoteMeaning(measure.voteMeaningYes, "YES")}
                    />
                    <Outcome
                      label="NO"
                      body={officialVoteMeaning(measure.voteMeaningNo, "NO")}
                    />
                  </DetailDisclosure>
                )}
              {measure.officialSummary && (
                <DetailDisclosure
                  title="Official summary"
                  subtitle="California SOS wording"
                >
                  <Text style={s.body}>{measure.officialSummary}</Text>
                </DetailDisclosure>
              )}
              {measure.fiscalImpact && (
                <DetailDisclosure
                  title="Official fiscal analysis"
                  subtitle="California SOS wording"
                >
                  <Text style={s.body}>{measure.fiscalImpact}</Text>
                </DetailDisclosure>
              )}
              {(proArguments.length > 0 || conArguments.length > 0) && (
                <DetailDisclosure
                  title="Submitted arguments"
                  subtitle="Advocacy statements from the official guide"
                >
                  <Text style={s.caption}>
                    Advocacy statements, not independent findings. Their
                    presence does not indicate equal evidentiary support.
                  </Text>
                  <Text style={s.argumentLabel}>For</Text>
                  {proArguments.length ? (
                    proArguments.map((arg, i) => (
                      <Text key={`pro-${i}`} style={s.body}>
                        {arg.text}
                      </Text>
                    ))
                  ) : (
                    <Text style={s.caption}>
                      No argument for was provided in this guide entry.
                    </Text>
                  )}
                  <Text style={s.argumentLabel}>Against</Text>
                  {conArguments.length ? (
                    conArguments.map((arg, i) => (
                      <Text key={`con-${i}`} style={s.body}>
                        {arg.text}
                      </Text>
                    ))
                  ) : (
                    <Text style={s.caption}>
                      No argument against was provided in this guide entry.
                    </Text>
                  )}
                  <InlineSource
                    label="California SOS · Arguments and rebuttals"
                    url={`${measure.sourceUrl}arguments-rebuttals.htm`}
                  />
                </DetailDisclosure>
              )}
              <DetailDisclosure
                title="Official sources"
                subtitle="State guide and text of the proposed law"
              >
                <Text style={s.caption}>
                  California Secretary of State Official Voter Information Guide
                  · Retrieved {query.data.fetchedAt.slice(0, 10)} UTC.
                </Text>
                <InlineSource
                  label="Official title and summary"
                  url={`${measure.sourceUrl}title-summary.htm`}
                />
                {measure.fullTextUrl && (
                  <InlineSource
                    label="Text of proposed law (PDF)"
                    url={measure.fullTextUrl}
                  />
                )}
                <InlineSource
                  label="Full official proposition page"
                  url={measure.sourceUrl}
                />
              </DetailDisclosure>
            </View>
          </>
        )}
      </ScrollView>
      <ListenBar
        status={speech.status}
        index={speech.index}
        total={speech.total}
        accent={P.spark}
        onPause={speech.pause}
        onResume={speech.resume}
        onStop={speech.stop}
      />
    </View>
  );
}

function Outcome({ label, body }: { label: "YES" | "NO"; body: string }) {
  return (
    <View style={s.outcome}>
      <View style={s.outcomeHead}>
        <Text style={s.outcomeLabel}>{label}</Text>
      </View>
      <Text style={s.outcomeBody}>{body}</Text>
    </View>
  );
}

function DetailDisclosure({
  title,
  subtitle,
  children,
  initiallyOpen = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={s.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.disclosureTrigger}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.disclosureHeading}>{title}</Text>
          <Text style={s.caption}>{subtitle}</Text>
        </View>
        <Icon name={open ? "chevD" : "chevR"} size={16} color={P.quiet} />
      </Pressable>
      {open && <View style={s.disclosureBody}>{children}</View>}
    </View>
  );
}

function InlineSource({ label, url }: { label: string; url?: string }) {
  const [failed, setFailed] = useState(false);
  const href = webUrl(url);
  if (!href) return <Text style={s.caption}>{label} · Link unavailable</Text>;
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={() => {
          void Linking.openURL(href).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
        style={s.sourceLink}
      >
        <Text style={s.sourceText}>{label}</Text>
        <Icon name="external" size={14} color={P.quiet} />
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          Could not open the link. Tap to retry.
        </Text>
      )}
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
    <View style={s.surface}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      <Text style={s.body}>{detail}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}>
        <Text style={s.retryText}>Try again</Text>
      </Pressable>
      <InlineSource
        label="Open official voter guide"
        url="https://voterguide.sos.ca.gov/propositions/"
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: 20,
    paddingTop: sp[4],
    paddingBottom: sp[12],
    gap: 18,
  },
  lead: { gap: 14 },
  kicker: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  voteSection: { gap: 12 },
  voteCard: {
    backgroundColor: P.card,
    borderColor: hair[1],
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  voteDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.border,
    marginVertical: 16,
  },
  outcome: { gap: 8 },
  outcomeHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  outcomeLabel: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  outcomeBody: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  metaLabel: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  record: { gap: 14 },
  displayTitleBold: { fontFamily: fontDisplay.bold },
  displayTitle: {
    fontFamily: fontDisplay.regular,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.5,
    color: P.inkOnNight,
  },
  recordTitle: {
    fontFamily: fontBody.medium,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  surface: {
    backgroundColor: P.card,
    borderColor: hair[1],
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  heading: {
    flexShrink: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  disclosure: {
    borderTopWidth: 1,
    borderColor: hair[1],
  },
  disclosureTrigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 10,
    gap: 12,
  },
  disclosureHeading: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  disclosureBody: { paddingBottom: 16, gap: 12 },
  argumentLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 5,
    minHeight: 44,
    paddingVertical: 6,
  },
  sourceText: {
    flexShrink: 1,
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 18,
    color: P.inkOnNight,
  },
  retry: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
  },
  retryText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: P.inkOnNight,
  },
});
