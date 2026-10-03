import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type { RouterOutputs } from "@acme/api";

import type { IconName } from "~/components/ui/Icon";
import { Icon } from "~/components/ui";
import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";
import { BallotText as Text } from "./BallotText";
import { webUrl } from "./model";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Analysis = NonNullable<Guide["measures"][number]["consequences"]>;
type Claim = Analysis["yes"];

export function PropositionConsequences({ analysis }: { analysis: Analysis }) {
  const [titleOpen, setTitleOpen] = useState(false);
  const section = (title: string, claims: Claim[], icon?: IconName) => (
    <View style={s.section}>
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
          If you vote {vote}
        </Text>
      </View>
      <Text style={s.mapConsequence}>{claim.text}</Text>
    </View>
  );
  return (
    <View style={s.analysis}>
      <Text style={s.caption}>
        Billion plain-language analysis · AI-assisted
      </Text>
      <Text accessibilityRole="header" style={s.headline}>
        {analysis.headline.text}
      </Text>
      <View style={s.officialTitle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Official ballot title"
          accessibilityState={{ expanded: titleOpen }}
          style={s.titleTrigger}
          onPress={() => setTitleOpen(!titleOpen)}
        >
          <Text style={s.titleText}>Official ballot title</Text>
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
              The rule today
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
            section("Also consider", [analysis.decisionNote])}
          <AnalysisDisclosure
            title="Full voting explanation"
            subtitle="Current rule, outcomes and conditions"
          >
            {section("The rule today", [analysis.currentRule])}
            {section("If you vote Yes", [analysis.yes])}
            {section("If you vote No", [analysis.no])}
          </AnalysisDisclosure>
        </View>
      ) : (
        <>
          {section("The rule today", [analysis.currentRule])}
          <View style={s.flow}>
            {section("If you vote Yes", [analysis.yes])}
            <View style={s.divider} />
            {section("If you vote No", [analysis.no])}
            {analysis.decisionNote &&
              section("Also consider", [analysis.decisionNote])}
          </View>
        </>
      )}
      {section("Who is affected", analysis.affected, "users")}
      {section("Costs and funding", [analysis.costsAndFunding])}
      {section("Limits and unknowns", [analysis.uncertainty], "help")}
      <AnalysisDisclosure
        title="How this would work"
        subtitle="What happens next"
      >
        {section("How the change takes effect", analysis.implementation)}
      </AnalysisDisclosure>
      <AnalysisDisclosure
        title="Sources and review"
        subtitle="Evidence behind this explanation"
      >
        <Text style={s.caption}>
          Billion’s AI-assisted explanation is separate from the official record
          below.
        </Text>
        <Text style={s.body}>
          Reviewed by{" "}
          {analysis.review.state === "approved"
            ? analysis.review.reviewer
            : "Billion"}
        </Text>
        <Text style={s.caption}>Revision {analysis.revision}</Text>
        {analysis.sources.map((source) => {
          const supported = [
            ["Plain-language headline", analysis.headline],
            ["The rule today", analysis.currentRule],
            ["If you vote Yes", analysis.yes],
            ["If you vote No", analysis.no],
            ...(analysis.decisionMap
              ? [
                  ["Decision map: today", analysis.decisionMap.today] as const,
                  ["Decision map: Yes", analysis.decisionMap.yes] as const,
                  ["Decision map: No", analysis.decisionMap.no] as const,
                ]
              : []),
            ...(analysis.decisionNote
              ? [["Also consider", analysis.decisionNote] as const]
              : []),
            ...analysis.implementation.map(
              (claim) => ["How this would work", claim] as const,
            ),
            ...analysis.affected.map(
              (claim) => ["Who is affected", claim] as const,
            ),
            ["Costs and funding", analysis.costsAndFunding],
            ["Limits and unknowns", analysis.uncertainty],
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
              <ClaimSource context="this explanation" source={source} />
              <Text style={s.caption}>
                Retrieved {source.retrievedAt.slice(0, 10)} UTC.
              </Text>
              <AnalysisDisclosure
                title="Cited statements"
                subtitle="Where this source is used"
                accessibilityLabel={`Cited statements from ${source.name}`}
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
          <Text style={s.heading}>{title}</Text>
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
  const [failed, setFailed] = useState(false);
  const url = webUrl(source.url);
  if (!url) return <Text style={s.caption}>Source link unavailable</Text>;
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Source for ${context}: ${source.name}`}
        style={s.sourceLink}
        onPress={() => {
          void Linking.openURL(url).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={s.sourceText}>Source: {source.name} ↗</Text>
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          Could not open source. Tap to retry.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  decisionMap: { gap: 12 },
  mapToday: { backgroundColor: P.paper, padding: 14, borderRadius: 8, gap: 5 },
  todayLabel: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 20,
    color: P.ink,
  },
  todayText: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 27,
    color: P.ink,
  },
  mapBranches: { flexDirection: "row", gap: 0, marginLeft: 16 },
  mapSpine: { width: 12, borderLeftWidth: 1, borderColor: P.quiet },
  mapChoices: { flex: 1, gap: 10 },
  mapOutcome: {
    backgroundColor: P.card,
    borderRadius: 8,
    borderLeftWidth: 3,
    padding: 12,
    gap: 5,
  },
  mapHeading: { flexDirection: "row", gap: 8, alignItems: "center" },
  mapLabel: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  mapConsequence: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 27,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: P.border,
  },
  disclosureTrigger: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  analysis: { gap: sp[4] },
  section: { gap: sp[2] },
  claim: { gap: sp[1] },
  headline: {
    fontFamily: fontEditorial.bold,
    fontSize: 27,
    lineHeight: 34,
    color: P.inkOnNight,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 27,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 20,
    color: P.quiet,
  },
  flow: {
    backgroundColor: P.card,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: P.border,
    padding: sp[4],
    gap: sp[4],
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: P.border },
});
