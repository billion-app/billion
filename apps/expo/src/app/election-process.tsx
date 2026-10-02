import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { ProcessExample } from "~/components/election-process/content";
import {
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
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
  const [example, setExample] = useState<ProcessExample>("president");
  const [expanded, setExpanded] = useState(false);
  const item = processExamples[example];
  return (
    <View style={s.screen}>
      <NavHeader title="How elections work" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>
          How does a candidate become an officeholder?
        </Text>
        <Text style={s.body}>
          The path depends on the office and state. Explore an example below.
        </Text>
        <Segmented
          value={example}
          options={(Object.keys(processExamples) as ProcessExample[]).map(
            (id) => ({ id, label: processExamples[id].label }),
          )}
          onChange={(id) => {
            setExample(id);
            setExpanded(false);
          }}
        />
        <View style={s.card}>
          <Text style={s.caption}>EDUCATIONAL EXAMPLE · NOT YOUR BALLOT</Text>
          <Text accessibilityRole="header" style={s.heading}>
            {item.context}
          </Text>
          <Text style={s.body}>{item.choosing}</Text>
        </View>
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.heading}>
            Can I participate?
          </Text>
          <Text style={s.body}>{item.participation}</Text>
          <Text style={s.body}>
            Billion does not know your registration, party affiliation or
            eligibility.
          </Text>
          <SourceLink
            prominence="primary"
            label={item.action[0]}
            url={item.action[1]}
          />
        </View>
        <Text accessibilityRole="header" style={s.heading}>
          How this path works
        </Text>
        {item.steps.map(([title, body], index) => (
          <View key={`${example}-${title}`} style={s.card}>
            <Text accessibilityRole="header" style={s.heading}>
              {index + 1}. {title}
            </Text>
            <Text style={s.body}>{body}</Text>
          </View>
        ))}
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.heading}>
            What is happening now?
          </Text>
          <Text style={s.body}>
            Current contest stage and next verified milestone are unavailable in
            this example. It has no live election schedule. Check the election
            office for your contest’s dates and rules.
          </Text>
          <ElectionOfficeLink />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={s.disclosure}
        >
          <Text style={s.link}>
            {expanded ? "Hide" : "Explore"}{" "}
            {example === "president"
              ? "candidate status and evidence"
              : "exceptions and special elections"}{" "}
            {expanded ? "−" : "+"}
          </Text>
        </Pressable>
        {expanded && <Text style={s.body}>{item.deeper}</Text>}
        <Text accessibilityRole="header" style={s.heading}>
          Read the official explanations
        </Text>
        <Text style={s.caption}>
          Billion’s hand-authored summaries of these sources · sources consulted
          October 2, 2026; editorial review pending. This is not verification of
          a candidate, schedule or your eligibility.
        </Text>
        {item.sources.map(([label, url]) => (
          <SourceLink key={url} label={label} url={url} />
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: sp[5], gap: sp[4], paddingBottom: sp[12] },
  title: { fontFamily: fontEditorial.bold, fontSize: 30, color: P.inkOnNight },
  heading: {
    fontFamily: fontEditorial.regular,
    fontSize: 23,
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
  card: {
    backgroundColor: P.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    padding: sp[4],
    gap: sp[3],
  },
  disclosure: { minHeight: 48, justifyContent: "center" },
  link: { fontFamily: fontBody.semibold, fontSize: 17, color: P.primary },
});
