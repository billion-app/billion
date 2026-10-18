import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type { RouterOutputs } from "@acme/api";

import type { IconName } from "~/components/ui/Icon";
import { Icon } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";
import { BallotText as Text } from "./BallotText";
import { webUrl } from "./model";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Analysis = NonNullable<Guide["measures"][number]["consequences"]>;
type Claim = Analysis["yes"];

export function PropositionConsequences({ analysis }: { analysis: Analysis }) {
  const { t: tx } = useAppTranslation();

  const [titleOpen, setTitleOpen] = useState(false);
  const section = (
    title: string,
    claims: Claim[],
    icon?: IconName,
    card = false,
  ) => (
    <View
      style={[
        s.section,
        card && s.sectionCard,
        title === tx("Limits and unknowns") && s.unknownCard,
      ]}
    >
      <View style={s.sectionHeading}>
        {icon && (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name={icon} size={19} color={P.inkOnNight} />
          </View>
        )}
        <Text accessibilityRole="header" style={s.heading}>
          {title}
        </Text>
      </View>
      {claims.map((claim, index) => (
        <View key={index} style={s.claim}>
          <Text style={s.body}>{claim.text}</Text>
        </View>
      ))}
    </View>
  );
  const outcome = (vote: "Yes" | "No", claim: Claim) => (
    <View
      style={[
        s.mapOutcome,
        { borderLeftColor: vote === "Yes" ? P.badgeBlue : P.badgeIndigo },
      ]}
    >
      <View style={s.mapHeading}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon
            name="arrowRight"
            size={18}
            color={vote === "Yes" ? P.badgeBlue : P.badgeIndigo}
          />
        </View>
        <Text accessibilityRole="header" style={s.mapLabel}>
          {tx("If you vote {value1}", { value1: tx(vote) })}
        </Text>
      </View>
      <Text style={s.mapConsequence}>{claim.text}</Text>
    </View>
  );
  return (
    <View style={s.analysis}>
      <Text style={s.caption}>
        {tx("Billion plain-language analysis · AI-assisted")}
      </Text>
      <View style={s.summaryCard}>
        <View style={s.sectionHeading}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="sparkle" size={16} color={P.badgeBlue} />
          </View>
          <Text accessibilityRole="header" style={s.summaryTitle}>
            {tx("The short version")}
          </Text>
        </View>
        <Text style={s.headline}>{analysis.headline.text}</Text>
      </View>
      <View style={s.officialTitle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx("Official ballot title")}
          accessibilityState={{ expanded: titleOpen }}
          style={s.titleTrigger}
          onPress={() => setTitleOpen(!titleOpen)}
        >
          <Text style={s.titleText}>{tx("Official ballot title")}</Text>
          <Icon
            name={titleOpen ? "chevD" : "chevR"}
            size={14}
            color={P.inkOnNight}
          />
        </Pressable>
        {titleOpen && <Text style={s.titleText}>{analysis.officialTitle}</Text>}
      </View>
      {analysis.decisionMap ? (
        <View style={s.decisionMap}>
          <View style={s.mapToday}>
            <Text accessibilityRole="header" style={s.todayLabel}>
              {tx("The rule today")}
            </Text>
            <Text style={s.todayText}>{analysis.decisionMap.today.text}</Text>
          </View>
          <View style={s.mapBranches}>
            <View
              style={s.mapSpine}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View style={s.mapChoices}>
              {outcome("Yes", analysis.decisionMap.yes)}
              {outcome("No", analysis.decisionMap.no)}
            </View>
          </View>
          {analysis.decisionNote &&
            section(tx("Also consider"), [analysis.decisionNote])}
          <AnalysisDisclosure
            title={tx("Full voting explanation")}
            subtitle={tx("Current rule, outcomes and conditions")}
          >
            {section(tx("The rule today"), [analysis.currentRule])}
            {section(tx("If you vote Yes"), [analysis.yes])}
            {section(tx("If you vote No"), [analysis.no])}
          </AnalysisDisclosure>
        </View>
      ) : (
        <>
          {section(tx("The rule today"), [analysis.currentRule])}
          <View style={s.flow}>
            {section(tx("If you vote Yes"), [analysis.yes])}
            <View style={s.divider} />
            {section(tx("If you vote No"), [analysis.no])}
            {analysis.decisionNote &&
              section(tx("Also consider"), [analysis.decisionNote])}
          </View>
        </>
      )}
      {section(tx("Who is affected"), analysis.affected, "users", true)}
      {section(
        tx("Costs and funding"),
        [analysis.costsAndFunding],
        undefined,
        true,
      )}
      {section(tx("Limits and unknowns"), [analysis.uncertainty], "help", true)}
      <AnalysisDisclosure
        title={tx("How this would work")}
        subtitle={tx("What happens next")}
      >
        {section(tx("How the change takes effect"), analysis.implementation)}
      </AnalysisDisclosure>
      <AnalysisDisclosure
        title={tx("Sources and review")}
        subtitle={tx("Evidence behind this explanation")}
      >
        <Text style={s.caption}>
          {tx(
            "Billion’s AI-assisted explanation is separate from the official record below.",
          )}
        </Text>
        <Text style={s.body}>
          {tx("Reviewed by {value1}", {
            value1:
              analysis.review.state === "approved"
                ? analysis.review.reviewer
                : "Billion",
          })}
        </Text>
        <Text style={s.caption}>
          {tx("Revision {value1}", { value1: analysis.revision })}
        </Text>
        {analysis.sources.map((source) => {
          const supported = [
            [tx("Plain-language headline"), analysis.headline],
            [tx("The rule today"), analysis.currentRule],
            [tx("If you vote Yes"), analysis.yes],
            [tx("If you vote No"), analysis.no],
            ...(analysis.decisionMap
              ? [
                  [
                    tx("Decision map: today"),
                    analysis.decisionMap.today,
                  ] as const,
                  [tx("Decision map: Yes"), analysis.decisionMap.yes] as const,
                  [tx("Decision map: No"), analysis.decisionMap.no] as const,
                ]
              : []),
            ...(analysis.decisionNote
              ? [[tx("Also consider"), analysis.decisionNote] as const]
              : []),
            ...analysis.implementation.map(
              (claim) => [tx("How this would work"), claim] as const,
            ),
            ...analysis.affected.map(
              (claim) => [tx("Who is affected"), claim] as const,
            ),
            [tx("Costs and funding"), analysis.costsAndFunding],
            [tx("Limits and unknowns"), analysis.uncertainty],
          ] as const;
          const cited = supported.filter(([, claim]) =>
            claim.sourceIds.includes(source.id),
          );
          if (!cited.length) return null;
          return (
            <View
              key={source.id}
              testID={`proposition-source-${source.id}`}
              style={s.section}
            >
              <ClaimSource context={tx("this explanation")} source={source} />
              <Text style={s.caption}>
                {tx("Retrieved {value1} UTC.", {
                  value1: source.retrievedAt.slice(0, 10),
                })}
              </Text>
              <AnalysisDisclosure
                title={tx("Cited statements")}
                subtitle={tx("Where this source is used")}
                accessibilityLabel={tx("Cited statements from {value1}", {
                  value1: source.name,
                })}
              >
                {cited.map(([label, claim], index) => (
                  <View key={index} style={s.section}>
                    <Text style={s.caption}>{label}</Text>
                    <Text style={s.body}>{claim.text}</Text>
                  </View>
                ))}
              </AnalysisDisclosure>
            </View>
          );
        })}
      </AnalysisDisclosure>
    </View>
  );
}
function AnalysisDisclosure({
  title,
  subtitle,
  children,
  accessibilityLabel,
}: {
  accessibilityLabel?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}
        onPress={() => setOpen(!open)}
        style={s.disclosureTrigger}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.disclosureHeading}>{title}</Text>
          <Text style={s.caption}>{subtitle}</Text>
        </View>
        <Icon name={open ? "chevD" : "chevR"} size={16} color={P.inkOnNight} />
      </Pressable>
      {open && <View style={s.disclosureBody}>{children}</View>}
    </View>
  );
}
function ClaimSource({
  context,
  source,
}: {
  context: string;
  source: Analysis["sources"][number];
}) {
  const { t: tx } = useAppTranslation();

  const [failed, setFailed] = useState(false);
  const url = webUrl(source.url);
  if (!url)
    return <Text style={s.caption}>{tx("Source link unavailable")}</Text>;
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={tx("Source for {value1}: {value2}", {
          value1: context,
          value2: source.name,
        })}
        style={s.sourceLink}
        onPress={() => {
          void Linking.openURL(url).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={s.sourceText}>
          {tx("Source: {value1} ↗", { value1: source.name })}
        </Text>
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          {tx("Could not open source. Tap to retry.")}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  summaryCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderLeftColor: P.badgeBlue,
    borderRadius: 14,
    padding: 16,
    gap: 13,
  },
  summaryTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  sectionCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
  },
  unknownCard: { backgroundColor: planes.surface, borderColor: hair[2] },
  decisionMap: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 15,
    gap: 11,
  },
  mapToday: {
    backgroundColor: planes.surface,
    padding: 12,
    borderRadius: 10,
    gap: 5,
  },
  todayLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    lineHeight: 16,
    color: P.inkOnNight,
  },
  todayText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  mapBranches: { flexDirection: "row", gap: 0, marginLeft: 8 },
  mapSpine: { width: 12, borderLeftWidth: 1, borderColor: hair[2] },
  mapChoices: { flex: 1, gap: 10 },
  mapOutcome: {
    backgroundColor: P.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    padding: 12,
    gap: 5,
  },
  mapHeading: { flexDirection: "row", gap: 8, alignItems: "center" },
  mapLabel: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 11,
    lineHeight: 16,
    color: P.inkOnNight,
  },
  mapConsequence: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  officialTitle: { gap: 3 },
  titleTrigger: {
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  titleText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  disclosure: {
    borderTopWidth: 1,
    borderColor: hair[1],
  },
  disclosureTrigger: {
    minHeight: 44,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  disclosureHeading: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  disclosureBody: { paddingBottom: 16, gap: 12 },
  sourceLink: { minHeight: 44, justifyContent: "center" },
  sourceText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
    textDecorationLine: "underline",
  },
  analysis: { gap: 18 },
  section: { gap: sp[2] },
  claim: { gap: sp[1] },
  headline: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
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
    fontSize: 11.5,
    lineHeight: 17,
    color: "rgba(255,255,255,0.70)",
  },
  flow: {
    backgroundColor: P.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
    padding: sp[4],
    gap: sp[4],
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: P.border },
});
