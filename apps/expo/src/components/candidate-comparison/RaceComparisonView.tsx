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

function SourceLink({
  source,
  number,
  count,
}: {
  source: ComparisonSource;
  number: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole={source.fixtureText ? "button" : "link"}
        accessibilityLabel={`${source.fixtureText ? (open ? "Hide" : "View") : "Read"} source: ${source.name}, ${source.locator}`}
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
              : "View source"
            : "Read source"}
          {count > 1 ? ` ${number}` : ""}
        </Text>
      </Pressable>
      {open && (
        <View style={s.excerpt}>
          <Text style={s.status}>Source excerpt · Fictional source</Text>
          <Text style={s.metadata}>
            {source.name} · {source.locator}
          </Text>
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

/** One shared question, then directly attributed answers in roster order. */
export function RaceComparisonView({ race }: { race: RaceComparison }) {
  const [topic, setTopic] = useState<ComparisonTopic>("priorities");
  const [choosingSection, setChoosingSection] = useState(false);
  const [choosingFromEmpty, setChoosingFromEmpty] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  if (!__DEV__ || !race.fixture)
    return (
      <Text style={s.body}>
        Candidate comparisons are unpublished pending editorial approval.
      </Text>
    );
  if (validateComparison(race).length)
    return (
      <Text accessibilityRole="alert" style={s.body}>
        Comparison unavailable: the evidence or candidate identities could not
        be verified.
      </Text>
    );
  const rows = comparisonRows(race, topic);
  const allEmpty =
    rows.length > 0 && rows.every(({ cell }) => cell.status !== "available");
  const hasGaps = rows.some(({ cell }) => cell.status !== "available");
  const topicLabel = comparisonTopics.find((item) => item.id === topic)?.label;
  const emptyHeading =
    topic === "effects"
      ? "Reviewed analysis isn’t available for this race."
      : topic === "questionnaire"
        ? "No questionnaire responses are available."
        : "We don’t have evidence for this question yet.";
  return (
    <View style={s.section}>
      <Text style={s.metadata}>
        Fictional preview · Unpublished · {race.candidates.length} candidates
      </Text>
      <Text accessibilityRole="header" style={s.title}>
        {race.office}
      </Text>
      <Text style={s.metadata}>{race.election}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: choosingSection }}
        style={s.action}
        onPress={() => {
          setChoosingSection(!choosingSection);
          setChoosingFromEmpty(false);
        }}
      >
        <Text style={s.link}>
          {topicLabel} · {choosingSection ? "Close sections" : "Change section"}
        </Text>
      </Pressable>
      {choosingSection && (
        <Segmented
          options={comparisonTopics}
          value={topic}
          onChange={(next) => {
            setTopic(next);
            setChoosingSection(false);
            setChoosingFromEmpty(false);
          }}
          wrap
        />
      )}
      <Text accessibilityRole="header" style={s.heading}>
        {race.questions[topic]}
      </Text>
      {allEmpty && (
        <View style={s.empty}>
          <Text style={s.body}>{emptyHeading}</Text>
          <Text style={s.metadata}>
            Missing information doesn’t tell us what a candidate supports or has
            done.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: choosingFromEmpty }}
            style={[s.action, s.recovery]}
            onPress={() => {
              setChoosingFromEmpty(!choosingFromEmpty);
              setChoosingSection(false);
            }}
          >
            <Text style={s.recoveryText}>
              {choosingFromEmpty ? "Close sections" : "Choose another section"}
            </Text>
          </Pressable>
          {choosingFromEmpty && (
            <Segmented
              options={comparisonTopics}
              value={topic}
              onChange={(next) => {
                setTopic(next);
                setChoosingFromEmpty(false);
              }}
              wrap
            />
          )}
        </View>
      )}
      {!rows.length && (
        <Text style={s.body}>
          Candidate roster unavailable. A comparison cannot establish who is on
          your ballot.
        </Text>
      )}
      <View style={allEmpty ? s.roster : s.section}>
        {rows.map(({ candidate, cell }) => (
          <View
            key={`${topic}-${candidate.id}`}
            style={
              allEmpty
                ? s.rosterRow
                : cell.status === "available"
                  ? s.card
                  : s.gapRow
            }
          >
            <Text accessibilityRole="header" style={s.name}>
              {candidate.name}
            </Text>
            <Text style={s.metadata}>{candidate.identity}</Text>
            {candidate.ballotStatus === "withdrawn-still-on-ballot" && (
              <Text style={s.status}>
                Withdrawn · Still on this example ballot
              </Text>
            )}
            {cell.status !== "available" ? (
              <Text style={s.metadata}>{gapCopy[cell.status]}</Text>
            ) : (
              cell.claims.map((claim, index) => (
                <View key={index} style={{ gap: 6 }}>
                  {claim.headline && (
                    <Text selectable style={s.answer}>
                      {claim.headline}
                    </Text>
                  )}
                  <Text selectable style={claim.headline ? s.body : s.answer}>
                    {claim.text}
                  </Text>
                  <Text style={s.attribution}>{claim.attribution}</Text>
                  {claim.sourceIds.map((id, sourceIndex) => {
                    const source = race.sources.find((item) => item.id === id);
                    return source ? (
                      <SourceLink
                        key={id}
                        source={source}
                        number={sourceIndex + 1}
                        count={claim.sourceIds.length}
                      />
                    ) : null;
                  })}
                </View>
              ))
            )}
          </View>
        ))}
      </View>
      {hasGaps && !allEmpty && (
        <Text style={s.metadata}>
          Missing information doesn’t tell us what a candidate supports or has
          done.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aboutOpen }}
        style={s.action}
        onPress={() => setAboutOpen(!aboutOpen)}
      >
        <Text style={s.link}>
          About this comparison · {aboutOpen ? "Hide" : "Read more"}
        </Text>
      </Pressable>
      {aboutOpen && (
        <View style={s.excerpt}>
          <Text style={s.body}>
            These candidates and records are fictional, not voting advice.
            Publication requires editorial approval and reviewed evidence.
          </Text>
          <Text style={s.body}>
            Every candidate gets the same question. Similar layouts do not mean
            equally strong evidence. Different stated priorities do not by
            themselves establish disagreement.
          </Text>
          <Text style={s.body}>
            Candidate statements and questionnaire answers are
            candidate-authored. They are separate from documented records and
            Billion analysis. Promises alone do not establish how a plan would
            work or its tradeoffs.
          </Text>
          <Text style={s.body}>
            Questionnaire responses are optional evidence. No response does not
            establish a position. This prototype does not invite or collect
            responses.
          </Text>
        </View>
      )}
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
    fontSize: 20,
    lineHeight: 28,
    color: P.inkOnNight,
  },
  name: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  answer: {
    fontFamily: fontEditorial.bold,
    fontSize: 22,
    lineHeight: 30,
    color: P.inkOnNight,
  },
  attribution: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 25,
    color: P.inkOnNight,
  },
  metadata: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  status: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  empty: { gap: 8 },
  card: {
    backgroundColor: P.card,
    borderColor: DigestHair.cardBorder,
    borderWidth: 1,
    borderRadius: DigestRadii.menu,
    padding: 14,
    gap: 6,
  },
  gapRow: {
    padding: 14,
    borderColor: DigestHair.cardBorder,
    borderWidth: 1,
    borderRadius: DigestRadii.menu,
    gap: 6,
  },
  roster: {
    backgroundColor: P.card,
    borderRadius: DigestRadii.menu,
    paddingHorizontal: 14,
  },
  rosterRow: {
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  excerpt: {
    backgroundColor: P.card,
    borderRadius: DigestRadii.menuRow,
    padding: 14,
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: P.inkOnNight,
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  recovery: {
    paddingHorizontal: 14,
    backgroundColor: P.primary,
    borderRadius: DigestRadii.menuRow,
  },
  recoveryText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 22,
    color: P.canvas,
  },
  link: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 22,
    color: P.inkOnNight,
    textDecorationLine: "underline",
  },
});
