import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { webUrl } from "~/components/ballot-evidence/model";
import { Icon, NavHeader } from "~/components/ui";
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
  const scroll = useRef<ScrollView>(null);
  const { fontScale } = useWindowDimensions();
  const headlineScale = Math.min(fontScale, 1.5);
  const headlineStyle = {
    fontSize: 28 * headlineScale,
    lineHeight: 34 * headlineScale,
  };
  const { number } = useLocalSearchParams<{ number?: string }>();
  const [modeState, setModeState] = useState<{
    number: string | undefined;
    mode: "explanation" | "official";
  }>({ number, mode: "explanation" });
  const mode = modeState.number === number ? modeState.mode : "explanation";
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const measure = query.data?.measures.find((item) => item.number === number);
  const explainer = measure
    ? propositionExplainer(measure.number, measure.title, measure.sourceUrl)
    : null;
  const proArguments = submittedGuideArguments(measure?.proArguments);
  const conArguments = submittedGuideArguments(measure?.conArguments);
  const recordMode = !explainer || mode === "official";

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [number]);

  function switchMode(next: "explanation" | "official") {
    setModeState({ number, mode: next });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  return (
    <View style={s.screen}>
      <NavHeader
        title={fontScale >= 1.8 ? "" : `Proposition ${number ?? ""}`}
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView ref={scroll} contentContainerStyle={s.content}>
        {query.isPending ? (
          <View style={s.surface}>
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
            <View style={s.lead}>
              <Text style={s.kicker}>
                {fontScale >= 1.8 ? `Proposition ${measure.number} · ` : ""}
                California · November 3, 2026
              </Text>
              {explainer && (
                <View style={s.modeRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !recordMode }}
                    onPress={() => switchMode("explanation")}
                    style={[s.modeButton, !recordMode && s.modeSelected]}
                  >
                    <Text
                      style={[s.modeText, !recordMode && s.modeTextSelected]}
                    >
                      Explanation
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: recordMode }}
                    onPress={() => switchMode("official")}
                    style={[s.modeButton, recordMode && s.modeSelected]}
                  >
                    <Text
                      style={[s.modeText, recordMode && s.modeTextSelected]}
                    >
                      Official record
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {explainer && !recordMode ? (
              <>
                <View style={s.explainerLead}>
                  <Text
                    accessibilityRole="header"
                    allowFontScaling={false}
                    style={[s.headline, headlineStyle]}
                  >
                    {explainer.headline}
                  </Text>
                  <View style={s.summaryCard}>
                    <View style={s.summaryHead}>
                      <View style={s.summaryIcon}>
                        <Icon name="sparkle" size={16} color={P.primary} />
                      </View>
                      <Text style={s.summaryTitle}>The short version</Text>
                    </View>
                    <Text style={s.takeaway}>{explainer.takeaway}</Text>
                    <Text style={s.aiText}>{PROPOSITION_AI_LABEL}</Text>
                  </View>
                </View>
                <View style={s.voteSection}>
                  <Text accessibilityRole="header" style={s.heading}>
                    What your vote means
                  </Text>
                  <View style={s.voteCard}>
                    <Outcome
                      label="YES"
                      title={explainer.voteTitleYes}
                      body={explainer.voteBriefYes}
                    />
                    <View style={s.voteDivider} />
                    <Outcome
                      label="NO"
                      title={explainer.voteTitleNo}
                      body={explainer.voteBriefNo}
                    />
                  </View>
                </View>
                {explainer.caveat && (
                  <Text style={s.caveat}>{explainer.caveat}</Text>
                )}
                <DetailDisclosure
                  title={explainer.detailTitle}
                  subtitle="What happens if Yes passes"
                >
                  {explainer.detailRows.map((row) => (
                    <View key={row.label} style={s.detailRow}>
                      <Text style={s.detailLabel}>{row.label}</Text>
                      <Text style={s.body}>{row.text}</Text>
                    </View>
                  ))}
                  <InlineSource
                    label="Legislative Analyst · Analysis"
                    url={explainer.analysisUrl}
                  />
                </DetailDisclosure>
                <View style={s.fiscal}>
                  <Text accessibilityRole="header" style={s.heading}>
                    Fiscal effect
                  </Text>
                  <Text style={s.body}>{explainer.fiscal}</Text>
                  <InlineSource
                    label="Legislative Analyst · Fiscal effects"
                    url={explainer.analysisUrl}
                  />
                </View>
                <View style={s.footer}>
                  <Text style={s.metaLabel}>OFFICIAL SOURCES</Text>
                  <InlineSource
                    label="California official proposition guide"
                    url={measure.sourceUrl}
                  />
                  <InlineSource
                    label="Legislative Analyst · Full analysis"
                    url={explainer.analysisUrl}
                  />
                </View>
              </>
            ) : (
              <View style={s.record}>
                {!explainer && (
                  <Text style={s.caption}>
                    Billion has not published an explanation for this
                    proposition. The official material is available below.
                  </Text>
                )}
                <Text style={s.metaLabel}>
                  OFFICIAL BALLOT TITLE · CALIFORNIA SOS
                </Text>
                <Text accessibilityRole="header" style={s.recordTitle}>
                  {measure.title}
                </Text>
                <Text style={s.metaLabel}>OFFICIAL SUMMARY</Text>
                <Text style={s.body}>
                  {measure.officialSummary ??
                    "Not available in Billion. Open the state guide."}
                </Text>
                <Text style={s.metaLabel}>OFFICIAL FISCAL IMPACT</Text>
                <Text style={s.body}>
                  {measure.fiscalImpact ??
                    "Not available in Billion. Open the state guide."}
                </Text>
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
                <Text style={s.metaLabel}>ORIGINAL SOURCES</Text>
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
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Outcome({
  label,
  title,
  body,
}: {
  label: "YES" | "NO";
  title: string;
  body: string;
}) {
  return (
    <View style={s.outcome}>
      <View style={s.outcomeHead}>
        <Text style={s.outcomeLabel}>{label}</Text>
        <Text accessibilityRole="header" style={s.outcomeTitle}>
          {title}
        </Text>
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
          <Text style={s.heading}>{title}</Text>
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
        onPress={() => {
          void Linking.openURL(href).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
        style={s.sourceLink}
      >
        <Text style={s.sourceText}>{label}</Text>
        <Icon name="external" size={14} color={P.primary} />
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
    paddingTop: sp[4],
    paddingBottom: sp[12],
    gap: 24,
  },
  lead: { gap: 14 },
  kicker: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  modeRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modeSelected: { borderBottomColor: P.primary },
  modeText: {
    color: P.quiet,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  modeTextSelected: { color: P.inkOnNight },
  explainerLead: { gap: 16 },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 34,
    color: P.inkOnNight,
  },
  summaryCard: {
    backgroundColor: P.card,
    borderColor: P.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderLeftColor: P.primary,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${P.primary}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    flex: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  takeaway: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  aiText: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    color: P.quiet,
  },
  voteSection: { gap: 12 },
  voteCard: {
    backgroundColor: P.card,
    borderColor: P.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
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
    color: P.primary,
  },
  outcomeTitle: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  outcomeBody: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  caveat: {
    color: P.quiet,
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  metaLabel: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  record: { gap: 14 },
  recordTitle: {
    fontFamily: fontBody.medium,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  surface: {
    backgroundColor: P.card,
    borderColor: P.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 26,
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
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  detailRow: { gap: 3 },
  detailLabel: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  fiscal: { gap: 8 },
  disclosure: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: P.border,
  },
  disclosureTrigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingVertical: 10,
    gap: 12,
  },
  disclosureBody: { paddingBottom: 16, gap: 12 },
  argumentLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  footer: { gap: 8, paddingTop: 7 },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 5,
    minHeight: 40,
    paddingVertical: 6,
  },
  sourceText: {
    flexShrink: 1,
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 18,
    color: P.primary,
  },
  retry: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: P.primary,
  },
  retryText: { fontFamily: fontBody.semibold, fontSize: 15, color: P.canvas },
});
