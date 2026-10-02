import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type { RouterOutputs } from "@acme/api";

import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";
import { BallotText as Text } from "./BallotText";
import { webUrl } from "./model";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Analysis = NonNullable<Guide["measures"][number]["consequences"]>;
type Claim = Analysis["yes"];

export function PropositionConsequences({ analysis }: { analysis: Analysis }) {
  const section = (title: string, claims: Claim[]) => (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      {claims.map((claim, index) => (
        <View key={index} style={s.claim}>
          <Text style={s.body}>{claim.text}</Text>
          {claim.sourceIds.map((id) => {
            const source = analysis.sources.find((item) => item.id === id);
            return source ? (
              <ClaimSource
                key={id}
                context={`${title}, point ${index + 1}`}
                source={source}
              />
            ) : null;
          })}
        </View>
      ))}
    </View>
  );
  return (
    <View style={s.analysis}>
      <Text style={s.caption}>
        BILLION PLAIN-LANGUAGE ANALYSIS · AI-assisted
      </Text>
      <Text accessibilityRole="header" style={s.headline}>
        {analysis.headline.text}
      </Text>
      {analysis.headline.sourceIds.map((id) => {
        const source = analysis.sources.find((item) => item.id === id);
        return source ? (
          <ClaimSource
            key={id}
            context="Plain-language headline"
            source={source}
          />
        ) : null;
      })}
      <Text style={s.caption}>
        Reviewed by{" "}
        {analysis.review.state === "approved"
          ? analysis.review.reviewer
          : "Billion"}{" "}
        · Revision {analysis.revision}
      </Text>
      {section("The rule today", [analysis.currentRule])}
      <View style={s.flow}>
        {section("If you vote Yes", [analysis.yes])}
        <View style={s.divider} />
        {section("If you vote No", [analysis.no])}
      </View>
      {section("How the change takes effect", analysis.implementation)}
      {section("Who is affected", analysis.affected)}
      {section("Costs and funding", [analysis.costsAndFunding])}
      {section("Conditions and unknowns", [analysis.uncertainty])}
      <Text style={s.caption}>
        Billion’s explanation is separate from the official record below. Source
        retrieval dates:{" "}
        {analysis.sources
          .map(
            (source) =>
              `${source.name}: ${source.retrievedAt.slice(0, 10)} UTC`,
          )
          .join("; ")}
        .
      </Text>
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
  sourceLink: { minHeight: 44, justifyContent: "center" },
  sourceText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 21,
    color: P.primary,
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
