import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type {
  ComparisonSource,
  ComparisonTopic,
  RaceComparison,
} from "./model";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Segmented } from "~/components/ui/Segmented";
import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import {
  comparisonRows,
  comparisonTopics,
  gapCopy,
  validateComparison,
} from "./model";

function SourceLink({ source }: { source: ComparisonSource }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole={source.fixtureText ? "button" : "link"}
        accessibilityLabel={`${source.fixtureText ? (open ? "Hide" : "Show") : "Read"} source: ${source.name}, ${source.locator}`}
        accessibilityState={source.fixtureText ? { expanded: open } : undefined}
        style={s.action}
        onPress={() => {
          if (source.fixtureText) setOpen(!open);
          else if (source.url)
            void Linking.openURL(source.url).then(
              () => setFailed(false),
              () => setFailed(true),
            );
        }}
      >
        <Text style={s.link}>
          {source.fixtureText
            ? open
              ? "Hide source"
              : "Show source"
            : "Read source"}
          : {source.name} · {source.locator}
          {source.fixtureText ? " · Fictional record" : ""}
        </Text>
      </Pressable>
      {open && (
        <View style={s.excerpt}>
          <Text style={s.status}>Source excerpt · Fictional record</Text>
          <Text selectable style={s.body}>
            {source.fixtureText}
          </Text>
        </View>
      )}
      {failed && (
        <Text accessibilityRole="alert" style={s.body}>
          Could not open the source. Tap the source again to retry.
        </Text>
      )}
    </View>
  );
}

/** Topic-first, vertically reflowing rows avoid horizontal scrolling at large text. */
export function RaceComparisonView({ race }: { race: RaceComparison }) {
  const [topic, setTopic] = useState<ComparisonTopic>("priorities");
  if (!__DEV__ || !race.fixture)
    return (
      <Text style={s.body}>
        Candidate comparisons are unpublished pending editorial approval.
      </Text>
    );
  const errors = validateComparison(race);
  if (errors.length)
    return (
      <Text accessibilityRole="alert" style={s.body}>
        Comparison unavailable: the evidence or candidate identities could not
        be verified.
      </Text>
    );
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>
        {race.office}
      </Text>
      <Text style={s.body}>{race.election}</Text>
      <View style={s.notice}>
        <Text style={s.status}>
          Unpublished fictional example · Not voting advice
        </Text>
        <Text style={s.body}>Publication requires editorial approval.</Text>
      </View>
      <Text style={s.body}>
        Same topic, every candidate. Evidence varies; gaps are not negative
        findings.
      </Text>
      <Text style={s.body}>
        {race.candidates.length} candidates · Full example roster
      </Text>
      <Segmented
        options={comparisonTopics}
        value={topic}
        onChange={setTopic}
        wrap
      />
      <Text accessibilityRole="header" style={s.heading}>
        {comparisonTopics.find((item) => item.id === topic)?.label}
      </Text>
      {topic === "priorities" && (
        <Text style={s.body}>
          Different priorities do not establish disagreement. Check each source.
        </Text>
      )}
      {topic === "effects" && (
        <Text style={s.body}>
          How a proposal could work, its limits, and its tradeoffs require
          reviewed analysis. Campaign promises alone do not establish effects.
        </Text>
      )}
      {topic === "questionnaire" && (
        <Text style={s.body}>
          Responses remain candidate-authored and separate from independent
          evidence. This prototype does not invite or collect responses.
        </Text>
      )}
      {!race.candidates.length && (
        <Text style={s.body}>
          Candidate roster unavailable. A comparison cannot establish who is on
          your ballot.
        </Text>
      )}
      {comparisonRows(race, topic).map(({ candidate, cell }) => (
        <View key={`${topic}-${candidate.id}`} style={s.card}>
          <Text accessibilityRole="header" style={s.name}>
            {candidate.name}
          </Text>
          <Text style={s.body}>{candidate.identity}</Text>
          {candidate.ballotStatus === "withdrawn-still-on-ballot" && (
            <Text style={s.status}>
              Withdrawn · Still listed on this example ballot
            </Text>
          )}
          {cell.status !== "available" ? (
            <Text style={s.body}>{gapCopy[cell.status]}</Text>
          ) : (
            cell.claims.map((claim, index) => (
              <View key={index} style={s.section}>
                <Text style={s.status}>{claim.attribution}</Text>
                <Text selectable style={s.body}>
                  {claim.text}
                </Text>
                {claim.sourceIds.map((id) => {
                  const source = race.sources.find((item) => item.id === id);
                  return source ? (
                    <SourceLink key={id} source={source} />
                  ) : null;
                })}
              </View>
            ))
          )}
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: DigestSpace.railGap },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 28,
    lineHeight: 36,
    color: P.inkOnNight,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  name: {
    fontFamily: fontEditorial.bold,
    fontSize: 22,
    lineHeight: 30,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 25,
    color: P.inkOnNight,
  },
  status: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  notice: {
    backgroundColor: P.card,
    borderColor: P.primary,
    borderWidth: 1,
    borderRadius: DigestRadii.menu,
    padding: 16,
    gap: 8,
  },
  card: {
    backgroundColor: P.card,
    borderColor: DigestHair.cardBorder,
    borderWidth: 1,
    borderRadius: DigestRadii.menu,
    padding: 18,
    gap: 12,
  },
  excerpt: {
    backgroundColor: P.canvas,
    borderRadius: DigestRadii.menuRow,
    padding: 14,
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: P.inkOnNight,
  },
  action: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  link: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 22,
    color: P.inkOnNight,
    textDecorationLine: "underline",
  },
});
