import type { ReactNode } from "react";
import { useState } from "react";
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

import type { PropositionExplainer } from "~/utils/proposition-explainers";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { webUrl } from "~/components/ballot-evidence/model";
import { Icon, NavHeader } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  planes,
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
  const { fontScale } = useWindowDimensions();
  const headlineScale = Math.min(fontScale, 1.5);
  const headlineStyle = {
    fontSize: 22 * headlineScale,
    lineHeight: 28 * headlineScale,
  };
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
        title={fontScale >= 1.8 ? "" : `Proposition ${number ?? ""}`}
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
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
                CALIFORNIA · NOVEMBER 3, 2026 · PROP {measure.number}
              </Text>
              {explainer ? (
                <>
                  <Text style={s.question}>WHAT WOULD A YES VOTE CHANGE?</Text>
                  <Text
                    accessibilityRole="header"
                    allowFontScaling={false}
                    style={[s.headline, headlineStyle]}
                  >
                    {explainer.headline}
                  </Text>
                  <View style={s.aiRow}>
                    <View style={s.iconTile}>
                      <Icon name="sparkle" size={14} color={P.primary} />
                    </View>
                    <Text style={s.aiText}>{PROPOSITION_AI_LABEL}</Text>
                  </View>
                </>
              ) : (
                <Text
                  accessibilityRole="header"
                  allowFontScaling={false}
                  style={[s.headline, headlineStyle]}
                >
                  Proposition {measure.number}
                </Text>
              )}
              <View style={s.officialIdentity}>
                <Text style={s.metaLabel}>
                  OFFICIAL BALLOT TITLE · CALIFORNIA SOS
                </Text>
                <Text style={s.officialTitle}>{measure.title}</Text>
                <InlineSource
                  label="Official proposition guide"
                  url={measure.sourceUrl}
                />
              </View>
            </View>

            {explainer ? (
              <>
                <MechanismDiagram explainer={explainer} />
                <View style={s.surface}>
                  <SectionHeading icon="vote" title="What your vote means" />
                  <View style={s.voteRow}>
                    <Text style={s.choice}>YES</Text>
                    <Text style={[s.body, s.voteBody]}>{explainer.yes}</Text>
                  </View>
                  <View style={[s.voteRow, s.rule]}>
                    <Text style={s.choice}>NO</Text>
                    <Text style={[s.body, s.voteBody]}>{explainer.no}</Text>
                  </View>
                  <InlineSource
                    label="California SOS · What Your Vote Means"
                    url={measure.sourceUrl}
                  />
                </View>
                <View style={s.surface}>
                  <SectionHeading icon="trendingUp" title="Fiscal effect" />
                  <Text style={s.body}>{explainer.fiscal}</Text>
                  <InlineSource
                    label="Legislative Analyst · Fiscal effects"
                    url={explainer.analysisUrl}
                  />
                </View>
                <DetailDisclosure
                  title="How it would work"
                  subtitle="Implementation and people affected"
                >
                  <Text style={s.body}>{explainer.implementation}</Text>
                  <Text style={s.body}>{explainer.affected}</Text>
                  <InlineSource
                    label="Legislative Analyst · Analysis"
                    url={explainer.analysisUrl}
                  />
                </DetailDisclosure>
              </>
            ) : (
              <View style={s.surface}>
                <SectionHeading icon="info" title="Explanation in review" />
                <Text style={s.body}>
                  Billion has not published a plain-language explanation for
                  this proposition. The official material below is available
                  now.
                </Text>
              </View>
            )}

            <DetailDisclosure
              title="Read the official record"
              subtitle="Summary, fiscal statement, and submitted arguments"
              initiallyOpen={!explainer}
            >
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
              <Text style={s.metaLabel}>ARGUMENTS SUBMITTED TO THE GUIDE</Text>
              <Text style={s.caption}>
                Advocacy statements, not independent findings. Their presence
                does not indicate equal evidentiary support.
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

            <View style={s.footer}>
              <Text style={s.metaLabel}>ORIGINAL SOURCES</Text>
              <Text style={s.caption}>
                California Secretary of State Official Voter Information Guide ·
                Retrieved {query.data.fetchedAt.slice(0, 10)} UTC.
                {explainer
                  ? " Billion's AI explanation awaits editorial review."
                  : ""}
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MechanismDiagram({ explainer }: { explainer: PropositionExplainer }) {
  const mechanism = explainer.mechanism;
  return (
    <View style={s.surface}>
      <SectionHeading icon="scale" title="The change at a glance" />
      <View style={s.flowBefore}>
        <Text style={s.flowLabel}>{mechanism.beforeTitle}</Text>
        <View style={s.flowNodes}>
          {mechanism.before.map((node) => (
            <View key={node} style={s.flowNode}>
              <Text style={s.flowText}>{node}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.connector}>
        <View style={s.connectorLine} />
        <Icon name="arrowDown" size={19} color={P.primary} />
        <Text style={s.connectorLabel}>IF YES PASSES</Text>
      </View>
      <View style={s.flowAfter}>
        <Text style={s.flowLabel}>{mechanism.afterTitle}</Text>
        <View style={s.flowNodes}>
          {mechanism.after.map((node) => (
            <View key={node} style={s.flowNode}>
              <View style={s.nodeDot} />
              <Text style={s.flowText}>{node}</Text>
            </View>
          ))}
        </View>
      </View>
      <InlineSource
        label="Legislative Analyst · Background and proposal"
        url={explainer.analysisUrl}
      />
    </View>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: "scale" | "vote" | "trendingUp" | "info";
  title: string;
}) {
  return (
    <View style={s.sectionHeading}>
      <View style={s.iconTile}>
        <Icon name={icon} size={17} color={P.inkOnNight} />
      </View>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
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
    gap: 14,
  },
  lead: { gap: 8, paddingBottom: 3 },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 17,
    color: P.primary,
    letterSpacing: 0.8,
  },
  question: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 16,
    color: P.quiet,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    lineHeight: 28,
    color: P.inkOnNight,
  },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 11,
    lineHeight: 16,
    color: P.quiet,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  officialIdentity: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: P.border,
    paddingTop: 9,
    gap: 4,
  },
  metaLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.8,
    color: P.quiet,
  },
  officialTitle: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  surface: {
    backgroundColor: P.card,
    borderColor: P.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    padding: 16,
    gap: 12,
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: {
    flex: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  flowBefore: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: P.border,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  flowAfter: {
    borderWidth: 1,
    borderColor: P.primary,
    backgroundColor: `${P.primary}12`,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  flowLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 16,
    color: P.inkOnNight,
  },
  flowNodes: { gap: 5 },
  flowNode: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: P.border,
    paddingTop: 6,
  },
  flowText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  nodeDot: {
    marginTop: 7,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: P.primary,
  },
  connector: { alignItems: "center", gap: 2, marginVertical: -3 },
  connectorLine: { height: 9, width: 1, backgroundColor: P.primary },
  connectorLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.7,
    color: P.primary,
  },
  voteRow: { flexDirection: "row", gap: 14 },
  voteBody: { flex: 1 },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: P.border,
    paddingTop: 12,
  },
  choice: {
    minWidth: 36,
    fontFamily: fontBody.bold,
    fontSize: 12,
    lineHeight: 22,
    color: P.primary,
  },
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
