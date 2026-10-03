import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { ProcessExample } from "~/components/election-process/content";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { processExamples } from "~/components/election-process/content";
import { Icon, NavHeader, Segmented } from "~/components/ui";
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
  const [processDetail, setProcessDetail] = useState(false);
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
            setProcessDetail(false);
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
        <View style={[s.card, s.path]}>
          {item.steps.map(([title], index) => {
            const optional = example === "texas" && index === 1;
            const last = index === item.steps.length - 1;
            return (
              <View key={`${example}-${title}`} style={s.stageRow}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                  style={s.rail}
                >
                  {optional ? (
                    <>
                      <View style={s.bypass} />
                      <View style={s.branch} />
                    </>
                  ) : (
                    <>
                      <View style={s.marker}>
                        <Icon
                          name={last ? "vote" : index === 0 ? "user" : "users"}
                          size={18}
                          color={P.inkOnNight}
                        />
                      </View>
                      {!last && <View style={s.connector} />}
                    </>
                  )}
                </View>
                <View style={[s.stageCopy, optional && s.optionalCopy]}>
                  <Text style={s.stageLabel}>
                    {optional ? "ONLY IF NEEDED" : item.stageActors[index]}
                  </Text>
                  <Text
                    accessibilityRole="header"
                    accessibilityLabel={
                      optional ? "Runoff, only if needed" : title
                    }
                    style={s.heading}
                  >
                    {optional ? "Runoff" : title}
                  </Text>
                  <Text style={s.body}>{item.stageSummaries[index]}</Text>
                </View>
              </View>
            );
          })}
        </View>
        <Disclosure
          label="How each stage works"
          expanded={processDetail}
          onPress={() => setProcessDetail(!processDetail)}
        />
        {processDetail && (
          <View style={s.card}>
            {item.steps.map(([title, body]) => (
              <View key={title} style={s.step}>
                <Text accessibilityRole="header" style={s.heading}>
                  {title}
                </Text>
                <Text style={s.body}>{body}</Text>
              </View>
            ))}
          </View>
        )}
        <SourceLink
          prominence="primary"
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
          <Disclosure
            label={
              example === "president"
                ? "Election exceptions and candidate status"
                : "Exceptions and special elections"
            }
            expanded={expanded}
            onPress={() => setExpanded(!expanded)}
          />
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
      <Text style={[s.link, { flex: 1 }]}>{label}</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={18}
          color={P.inkOnNight}
        />
      </View>
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
  stageRow: { flexDirection: "row", gap: sp[3] },
  path: { gap: 0 },
  optionalCopy: {
    marginLeft: sp[3],
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: P.primary,
    borderRadius: DigestRadii.menuRow,
    padding: sp[3],
    marginBottom: sp[3],
  },
  bypass: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: P.primary,
  },
  branch: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 1,
    backgroundColor: P.primary,
  },
  rail: { width: 32, alignItems: "center" },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.canvas,
    borderWidth: 1,
    borderColor: P.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  connector: {
    flex: 1,
    width: 2,
    minHeight: 20,
    backgroundColor: P.primary,
    marginTop: sp[2],
  },

  stageCopy: { flex: 1, gap: sp[1], paddingBottom: sp[3] },
  stageLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    color: P.inkOnNight,
    letterSpacing: 0.8,
  },
  step: { gap: sp[2] },
  disclosure: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sp[3],
    paddingVertical: sp[2],
  },
  link: { fontFamily: fontBody.semibold, fontSize: 17, color: P.inkOnNight },
});
