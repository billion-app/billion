import { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import type {
  ComparisonSource,
  ComparisonTopic,
  RaceComparison,
} from "./model";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
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
  const { t: tx } = useAppTranslation();

  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole={source.fixtureText ? "button" : "link"}
        accessibilityLabel={`${source.fixtureText ? (open ? tx("Hide") : tx("View")) : tx("Read")} source: ${source.name}, ${source.locator}`}
        accessibilityState={source.fixtureText ? { expanded: open } : undefined}
        style={[s.action, s.sourceAction]}
        onPress={() => {
          if (source.fixtureText) setOpen(!open);
          else if (source.url)
            void Linking.openURL(source.url).then(
              () => setFailed(false),
              () => setFailed(true),
            );
        }}
      >
        <View accessible={false} aria-hidden>
          <Icon name="quote" size={11} color={colors.textSecondary} />
        </View>
        <Text style={s.sourceLabel}>
          {source.fixtureText
            ? open
              ? tx("Hide source")
              : tx("View source")
            : tx("Read source")}
          {count > 1 ? ` ${number}` : ""}
          {" · "}
          {source.locator}
        </Text>
        <View
          accessible={false}
          aria-hidden
          style={open ? { transform: [{ rotate: "180deg" }] } : undefined}
        >
          <Icon
            name={source.fixtureText ? "chevD" : "external"}
            size={13}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>
      {open && (
        <View style={s.excerpt}>
          <Text style={s.status}>
            {tx("Source excerpt · Fictional source")}
          </Text>
          <Text style={s.metadata}>
            {source.name} · {source.locator}
          </Text>
          <Text selectable style={s.quoteText}>
            {source.fixtureText}
          </Text>
        </View>
      )}
      {failed && (
        <Text accessibilityRole="alert" style={s.body}>
          {tx("Could not open the source. Tap the source again to retry.")}
        </Text>
      )}
    </View>
  );
}

function SectionChoices({
  options,
  value,
  onChange,
}: {
  options: { id: ComparisonTopic; label: string }[];
  value: ComparisonTopic;
  onChange: (value: ComparisonTopic) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={{ gap: 6 }}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="tab"
          aria-selected={value === option.id}
          accessibilityState={{ selected: value === option.id }}
          style={s.choice}
          onPress={() => onChange(option.id)}
        >
          <Text style={[s.link, { flex: 1 }]}>{option.label}</Text>
          <View accessible={false} aria-hidden>
            <Icon
              name={value === option.id ? "check" : "chevR"}
              size={14}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** One shared question, then directly attributed answers in roster order. */
export function RaceComparisonView({ race }: { race: RaceComparison }) {
  const { t: tx } = useAppTranslation();

  const { fontScale } = useWindowDimensions();
  const [topic, setTopic] = useState<ComparisonTopic>("priorities");
  const [choosingSection, setChoosingSection] = useState(false);
  const [choosingFromEmpty, setChoosingFromEmpty] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  if (!__DEV__ || !race.fixture)
    return (
      <Text style={s.body}>
        {tx(
          "Candidate comparisons are unpublished pending editorial approval.",
        )}
      </Text>
    );
  if (validateComparison(race).length)
    return (
      <Text accessibilityRole="alert" style={s.body}>
        {tx(
          "Comparison unavailable: the evidence or candidate identities could not be verified.",
        )}
      </Text>
    );
  const rows = comparisonRows(race, topic);
  const allEmpty =
    rows.length > 0 && rows.every(({ cell }) => cell.status !== "available");
  const hasGaps = rows.some(({ cell }) => cell.status !== "available");
  const claims = rows.flatMap(({ cell }) =>
    cell.status === "available" ? cell.claims : [],
  );
  // Collapse only identical, explicitly attributed context, never infer agreement.
  const firstClaim = claims[0];
  const sharedContext =
    claims.length > 1 &&
    firstClaim &&
    claims.every(
      (claim) =>
        claim.pictogram &&
        claim.attribution === "Candidate statement" &&
        claim.text === firstClaim.text,
    )
      ? firstClaim.text
      : undefined;
  const topicLabel = comparisonTopics.find((item) => item.id === topic)?.label;
  const emptyHeading =
    topic === "effects"
      ? tx("Reviewed analysis isn’t available for this race.")
      : topic === "questionnaire"
        ? tx("No questionnaire responses are available.")
        : tx("We don’t have evidence for this question yet.");
  return (
    <View style={s.section}>
      <Text style={s.metadata}>
        {tx("Fictional preview · Unpublished · {value1} candidates", {
          value1: race.candidates.length,
        })}
      </Text>
      <Text accessibilityRole="header" style={s.title}>
        {race.office}
      </Text>
      <Text style={s.metadata}>{race.election}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: choosingSection }}
        style={[s.action, s.sectionAction]}
        onPress={() => {
          setChoosingSection(!choosingSection);
          setChoosingFromEmpty(false);
        }}
      >
        <Text style={[s.link, { flex: 1 }]}>
          {topicLabel ? tx(topicLabel) : ""} ·{" "}
          {choosingSection ? tx("Close sections") : tx("Change section")}
        </Text>
        <View
          accessible={false}
          aria-hidden
          style={
            choosingSection ? { transform: [{ rotate: "180deg" }] } : undefined
          }
        >
          <Icon name="chevD" size={13} color={colors.textSecondary} />
        </View>
      </Pressable>
      {choosingSection && (
        <SectionChoices
          options={comparisonTopics.map((item) => ({
            ...item,
            label: tx(item.label),
          }))}
          value={topic}
          onChange={(next) => {
            setTopic(next);
            setChoosingSection(false);
            setChoosingFromEmpty(false);
          }}
        />
      )}
      <Text accessibilityRole="header" style={s.heading}>
        {race.questions[topic]}
      </Text>
      {sharedContext && (
        <View style={s.proposalContext}>
          <View accessible={false} aria-hidden>
            <Icon name="users" size={14} color={colors.textSecondary} />
          </View>
          <Text style={[s.metadata, { flex: 1 }]}>
            {tx("Statements shown share: {value1}", { value1: sharedContext })}
          </Text>
        </View>
      )}
      {allEmpty && (
        <View style={s.empty}>
          <Text style={s.body}>{emptyHeading}</Text>
          <Text style={s.metadata}>
            {tx(
              "Missing information doesn’t tell us what a candidate supports or has done.",
            )}
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
              {choosingFromEmpty
                ? tx("Close sections")
                : tx("Choose another section")}
            </Text>
          </Pressable>
          {choosingFromEmpty && (
            <SectionChoices
              options={comparisonTopics.map((item) => ({
                ...item,
                label: tx(item.label),
              }))}
              value={topic}
              onChange={(next) => {
                setTopic(next);
                setChoosingFromEmpty(false);
              }}
            />
          )}
        </View>
      )}
      {!rows.length && (
        <Text style={s.body}>
          {tx(
            "Candidate roster unavailable. A comparison cannot establish who is on your ballot.",
          )}
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
                {tx("Withdrawn · Still on this example ballot")}
              </Text>
            )}
            {cell.status !== "available" ? (
              <Text style={s.metadata}>{gapCopy[cell.status]}</Text>
            ) : (
              cell.claims.map((claim, index) => (
                <View key={index} style={{ gap: 6 }}>
                  {claim.headline && (
                    <View style={s.answerRow}>
                      {claim.pictogram && (
                        <View
                          style={s.pictogram}
                          accessible={false}
                          aria-hidden
                        >
                          <Icon
                            name={claim.pictogram}
                            size={16}
                            color={P.inkOnNight}
                          />
                        </View>
                      )}
                      <Text
                        selectable
                        style={[
                          s.answer,
                          {
                            flexBasis: 140 * fontScale,
                            flexGrow: 1,
                            flexShrink: 1,
                          },
                        ]}
                      >
                        {claim.headline}
                      </Text>
                    </View>
                  )}
                  {sharedContext ? null : claim.pictogram ? (
                    <View style={s.proposalContext}>
                      <View accessible={false} aria-hidden>
                        <Icon name="users" size={14} color={P.inkOnNight} />
                      </View>
                      <Text selectable style={[s.metadata, { flex: 1 }]}>
                        {claim.text}
                      </Text>
                    </View>
                  ) : (
                    <Text selectable style={claim.headline ? s.body : s.answer}>
                      {claim.text}
                    </Text>
                  )}
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
          {tx(
            "Missing information doesn’t tell us what a candidate supports or has done.",
          )}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aboutOpen }}
        style={[s.action, s.sectionAction]}
        onPress={() => setAboutOpen(!aboutOpen)}
      >
        <Text style={[s.link, { flex: 1 }]}>
          {tx("About this comparison · {value1}", {
            value1: aboutOpen ? tx("Hide") : tx("Read more"),
          })}
        </Text>
        <View
          accessible={false}
          aria-hidden
          style={aboutOpen ? { transform: [{ rotate: "180deg" }] } : undefined}
        >
          <Icon name="chevD" size={13} color={colors.textSecondary} />
        </View>
      </Pressable>
      {aboutOpen && (
        <View style={s.excerpt}>
          <Text style={s.body}>
            {tx(
              "These candidates and records are fictional, not voting advice. Publication requires editorial approval and reviewed evidence.",
            )}
          </Text>
          <Text style={s.body}>
            {tx(
              "Every candidate gets the same question. Similar layouts do not mean equally strong evidence. Different stated priorities do not by themselves establish disagreement.",
            )}
          </Text>
          <Text style={s.body}>
            {tx(
              "Candidate statements and questionnaire answers are candidate-authored. They are separate from documented records and Billion analysis. Promises alone do not establish how a plan would work or its tradeoffs.",
            )}
          </Text>
          <Text style={s.body}>
            {tx(
              "Questionnaire responses are optional evidence. No response does not establish a position. This prototype does not invite or collect responses.",
            )}
          </Text>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 14 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 25,
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
    fontSize: 17,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  answerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  pictogram: {
    backgroundColor: planes.surface,
    borderRadius: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  proposalContext: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopColor: hair[1],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attribution: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  quoteText: {
    fontFamily: fontEditorial.italic,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.white,
  },
  sourceAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "stretch",
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingVertical: 4,
  },
  sourceLabel: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  choice: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[1],
  },
  metadata: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  status: {
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
    lineHeight: 17,
    color: P.inkOnNight,
  },
  empty: { gap: 8 },
  card: {
    backgroundColor: P.card,
    borderColor: hair[1],
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  gapRow: {
    padding: 14,
    borderColor: hair[1],
    borderWidth: 1,
    borderRadius: 14,
    gap: 6,
  },
  roster: {
    backgroundColor: P.card,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  rosterRow: {
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hair[1],
  },
  excerpt: {
    backgroundColor: planes.ink,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
  },
  recovery: {
    paddingHorizontal: 14,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 10,
  },
  recoveryText: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: colors.white,
  },
  link: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
  },
});
