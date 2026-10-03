import { useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import type { ProcessExample } from "~/components/election-process/content";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { processExamples } from "~/components/election-process/content";
import { Icon, NavHeader } from "~/components/ui";
import {
  colors,
  digest,
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";

export default function ElectionProcessScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
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
        <View
          accessibilityRole="tablist"
          style={[s.examples, fontScale > 1.3 && { flexDirection: "column" }]}
        >
          {(Object.keys(processExamples) as ProcessExample[]).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              aria-selected={example === id}
              style={[
                s.example,
                fontScale > 1.3 && { flex: 0 },
                example === id && s.selectedExample,
              ]}
              onPress={() => {
                setExample(id);
                setExpanded(false);
                setParticipation(false);
                setSources(false);
                setProcessDetail(false);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }}
            >
              <Text
                style={[s.exampleText, example === id && { color: planes.ink }]}
              >
                {processExamples[id].label}
              </Text>
            </Pressable>
          ))}
        </View>
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
        <OfficialLink
          primary
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
              <OfficialLink
                primary
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
                <OfficialLink key={url} label={label} url={url} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
function OfficialLink({
  label,
  url,
  primary = false,
}: {
  label: string;
  url: string;
  primary?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={[s.sourceLink, primary && s.primarySource]}
        onPress={() => {
          void Linking.openURL(url).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={[s.link, { flex: 1 }, primary && { color: colors.bill }]}>
          {label}
        </Text>
        <Icon
          name="external"
          size={16}
          color={primary ? colors.bill : colors.textSecondary}
        />
      </Pressable>
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          Could not open the link. Tap to retry.
        </Text>
      )}
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
  examples: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
  },
  example: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  selectedExample: { backgroundColor: colors.bill },
  exampleText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: "center",
    flexShrink: 1,
  },
  sourceLink: {
    minHeight: 44,
    padding: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[1],
  },
  primarySource: { backgroundColor: planes.slate },
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: sp[5], gap: sp[4], paddingBottom: sp[12] },
  intro: { gap: sp[2] },
  title: { fontFamily: fontDisplay.bold, fontSize: 24, color: P.inkOnNight },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
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
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
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
    borderColor: digest.badgeBlue,
    borderRadius: 10,
    padding: sp[3],
    marginBottom: sp[3],
  },
  bypass: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: digest.badgeBlue,
  },
  branch: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 1,
    backgroundColor: digest.badgeBlue,
  },
  rail: { width: 32, alignItems: "center" },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: digest.badgeBlue,
    alignItems: "center",
    justifyContent: "center",
  },

  connector: {
    flex: 1,
    width: 2,
    minHeight: 20,
    backgroundColor: digest.badgeBlue,
    marginTop: sp[2],
  },

  stageCopy: { flex: 1, gap: sp[1], paddingBottom: sp[3] },
  stageLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    color: colors.textSecondary,
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
  link: { fontFamily: fontBody.semibold, fontSize: 13.5, color: P.inkOnNight },
});
