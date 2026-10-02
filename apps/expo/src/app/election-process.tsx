import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { ProcessExample } from "~/components/election-process/content";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { processExamples } from "~/components/election-process/content";
import { NavHeader, Segmented } from "~/components/ui";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";

export default function ElectionProcessScreen() {
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [example, setExample] = useState<ProcessExample>("president");
  const [expanded, setExpanded] = useState(false);
  const [participation, setParticipation] = useState(false);
  const [sources, setSources] = useState(false);
  const item = processExamples[example];
  return (
    <View style={s.screen}>
      <NavHeader title="How elections work" onBack={() => router.back()} />
      <ScrollView ref={scroll} contentContainerStyle={s.content}>
        <Segmented
          value={example}
          options={(Object.keys(processExamples) as ProcessExample[]).map(
            (id) => ({ id, label: processExamples[id].label }),
          )}
          onChange={(id) => {
            setExample(id);
            setExpanded(false);
            setParticipation(false);
            setSources(false);
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
        />
        <View style={s.intro}>
          <Text style={s.caption}>
            {item.year} educational example · no live updates
          </Text>
          <Text accessibilityRole="header" style={s.title}>
            {item.title}
          </Text>
          <Text style={s.body}>{item.choosing}</Text>
        </View>
        <View style={s.card}>
          {item.steps.map(([title, body], index) => (
            <View
              key={`${example}-${title}`}
              style={[
                s.step,
                index > 0 && s.stepDivider,
                example === "texas" && index === 1 && s.conditional,
              ]}
            >
              <Text accessibilityRole="header" style={s.heading}>
                {example === "texas" && index === 1
                  ? "Only if needed: Runoff"
                  : `${example === "texas" && index === 2 ? 2 : index + 1}. ${title}`}
              </Text>
              <Text style={s.body}>{body}</Text>
            </View>
          ))}
        </View>
        <SourceLink
          label="Election dates: find my election office"
          url="https://www.usa.gov/state-election-office"
        />
        <View style={s.details}>
          <Disclosure
            label="Can I participate?"
            expanded={participation}
            onPress={() => setParticipation(!participation)}
          />
          {participation && (
            <View style={s.card}>
              <Text style={s.body}>{item.participation}</Text>
              <Text style={s.caption}>
                Billion does not know your registration, party affiliation or
                eligibility.
              </Text>
              <SourceLink
                prominence="primary"
                label={item.action[0]}
                url={item.action[1]}
              />
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={s.disclosure}
          >
            <Text style={s.link}>
              {expanded ? "Hide" : "Explore"}{" "}
              {example === "president"
                ? "election exceptions and candidate status"
                : "exceptions and special elections"}{" "}
              {expanded ? "−" : "+"}
            </Text>
          </Pressable>
          {expanded && <Text style={s.body}>{item.deeper}</Text>}
          <Disclosure
            label="Sources and review status"
            expanded={sources}
            onPress={() => setSources(!sources)}
          />
          {sources && (
            <View style={s.card}>
              <Text style={s.caption}>
                Billion’s hand-authored summaries of official sources. Sources
                consulted October 2, 2026; editorial review pending. These
                examples do not verify a candidate, schedule or your
                eligibility.
              </Text>
              {item.sources.map(([label, url]) => (
                <SourceLink key={url} label={label} url={url} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
function Disclosure({
  label,
  expanded,
  onPress,
}: {
  label: string;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={s.disclosure}
    >
      <Text style={s.link}>
        {label} {expanded ? "−" : "+"}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: sp[5], gap: sp[4], paddingBottom: sp[12] },
  intro: { gap: sp[2] },
  title: { fontFamily: fontEditorial.bold, fontSize: 26, color: P.inkOnNight },
  heading: {
    fontFamily: fontEditorial.regular,
    fontSize: 21,
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
    color: P.inkOnNight,
  },
  card: {
    backgroundColor: P.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    padding: sp[4],
    gap: sp[3],
  },
  details: { gap: sp[1] },
  conditional: {
    marginLeft: sp[3],
    borderLeftWidth: 2,
    borderLeftColor: P.primary,
    paddingLeft: sp[3],
  },
  step: { gap: sp[2] },
  stepDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
    paddingTop: sp[4],
  },
  disclosure: { minHeight: 48, justifyContent: "center" },
  link: { fontFamily: fontBody.semibold, fontSize: 17, color: P.primary },
});
