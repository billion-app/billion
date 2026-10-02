import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { Evidence } from "~/components/accountability/model";
import { exampleFor } from "~/components/accountability/examples";
import {
  actionsFor,
  resolveOfficeholder,
  stageCopy,
} from "~/components/accountability/model";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader } from "~/components/ui";
import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";

/** Isolated development route: never a live results or notification service. */
export default function AccountabilityPreview() {
  const router = useRouter();
  const [scenario, setScenario] = useState("historical");
  const [showScenarios, setShowScenarios] = useState(false);
  const [following, setFollowing] = useState(false);
  const [linkError, setLinkError] = useState(false);
  if (!__DEV__)
    return (
      <View style={s.screen}>
        <NavHeader
          title="Accountability"
          tone="dark"
          onBack={() => router.back()}
        />
        <Text style={s.body}>
          Accountability preview unavailable. Live results are not connected.
        </Text>
      </View>
    );
  const example = exampleFor(scenario);
  const holder = resolveOfficeholder(
    example.identity,
    example.candidates,
    example.result,
    example.entry,
  );
  const actions = holder ? actionsFor(holder, example.actions) : [];
  function source(evidence: Evidence) {
    return (
      <View key={evidence.url + evidence.locator} style={s.source}>
        <Text style={s.caption}>
          {evidence.publisher} · Published {evidence.published}
          {"\n"}
          {evidence.locator}
        </Text>
        {evidence.url ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${evidence.publisher}: ${evidence.locator}`}
            onPress={() => {
              setLinkError(false);
              void Linking.openURL(evidence.url).catch(() =>
                setLinkError(true),
              );
            }}
            style={s.button}
          >
            <Text style={s.link}>Open source record</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={s.screen}>
      <NavHeader
        title="After the election"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>DEVELOPMENT PROTOTYPE · NO LIVE UPDATES</Text>
        <Text style={s.title}>From your choice to governing power</Text>
        <Text style={s.body}>
          See who took office, then revisit campaign priorities alongside
          documented actions.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showScenarios }}
          onPress={() => setShowScenarios(!showScenarios)}
          style={s.button}
        >
          <Text style={s.link}>
            {showScenarios ? "Hide test scenarios" : "Test scenarios"}
          </Text>
        </Pressable>
        {showScenarios && (
          <View style={s.options}>
            {[
              "historical",
              "full",
              "preliminary",
              "projected",
              "disputed",
              "missing",
            ].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: scenario === value }}
                style={[s.option, scenario === value && s.selected]}
                onPress={() => {
                  setScenario(value);
                  setFollowing(false);
                  setLinkError(false);
                }}
              >
                <Text style={[s.link, scenario === value && s.selectedText]}>
                  {value === "full"
                    ? "Synthetic actions"
                    : value.charAt(0).toUpperCase() + value.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={s.heading}>{example.label}</Text>
        <Text style={s.caption}>
          {example.synthetic
            ? "All people, dates, results and actions below are fictional test records."
            : "Historical source example checked October 2, 2026. This is not your ballot or a current officeholder directory."}
        </Text>
        <Card
          title={
            holder
              ? `${holder.name} took office`
              : "Officeholder not established here"
          }
        >
          <Text style={s.body}>
            {holder
              ? `Term entry documented ${holder.tookOffice}. This evidence is separate from the election count.`
              : "A certified result, matching candidate identity and a separate taking-office record are required before actions can be attributed here."}
          </Text>
          {holder && source(holder.evidence)}
          {holder && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: following }}
              onPress={() => setFollowing(!following)}
              style={s.button}
            >
              <Text style={s.link}>
                {following
                  ? "Stop following in this preview"
                  : "Follow in this preview"}
              </Text>
            </Pressable>
          )}
          {holder && (
            <Text style={s.caption}>
              {following ? "Following for this open preview only. " : ""}No
              alerts, background refresh or saved subscription. Open the source
              records to check for changes.
            </Text>
          )}
        </Card>
        <Card title="What the result establishes">
          <Text style={s.body}>
            {example.result.disputed
              ? "Result disputed. This preview does not establish an officeholder while the dispute is unresolved."
              : stageCopy[example.result.stage]}
          </Text>
          {example.result.evidence && source(example.result.evidence)}
          {example.extraEvidence.map(source)}
          <Text style={s.caption}>
            Candidate roster:{" "}
            {example.candidates.map((candidate) => candidate.name).join(" · ")}.
            Missing candidates never imply a winner.
          </Text>
        </Card>
        <Card title="Campaign priorities and actions">
          {!holder ? (
            <Text style={s.body}>
              Actions withheld until officeholder identity is established.
            </Text>
          ) : (
            <>
              {example.priorities
                .filter(
                  (priority) => priority.candidateId === holder.candidateId,
                )
                .map((priority) => (
                  <View key={priority.id}>
                    <Text style={s.body}>
                      {priority.date} · {priority.text}
                    </Text>
                    {source(priority.evidence)}
                  </View>
                ))}
              {!example.priorities.length && (
                <Text style={s.body}>
                  No dated campaign priorities loaded. No promise comparison is
                  available.
                </Text>
              )}
              {actions.map((action) => (
                <View key={action.date + action.text} style={s.action}>
                  <Text style={s.kicker}>
                    {action.date} · {action.kind}
                  </Text>
                  <Text style={s.body}>{action.text}</Text>
                  <Text style={s.body}>{action.context}</Text>
                  {source(action.evidence)}
                </View>
              ))}
              {!actions.length && (
                <Text style={s.body}>
                  No action records loaded. That does not mean this officeholder
                  took no action.
                </Text>
              )}
            </>
          )}
          <Text style={s.caption}>
            A vote is one person’s recorded position, not the whole outcome.
            Policy effects can be uncertain and shared across institutions.
            These records do not score whether a promise was kept.
          </Text>
        </Card>
        {linkError && (
          <Text accessibilityRole="alert" style={s.body}>
            Could not open the source. Try again from its source record button.
          </Text>
        )}
        <Card title="Coverage and corrections">
          <Text style={s.body}>
            This static preview covers one historical California governor
            contest and fictional test states. No automatic refresh. Check the
            linked official records for updates or corrections. If a record
            changes, this preview will not update automatically.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    padding: sp[5],
    gap: sp[4],
    paddingBottom: sp[10],
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontFamily: fontEditorial.regular, fontSize: 30, color: P.paper },
  heading: { fontFamily: fontEditorial.regular, fontSize: 23, color: P.paper },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.paper,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.paper,
  },
  kicker: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 19,
    color: P.paper,
  },
  card: {
    backgroundColor: P.card,
    borderRadius: 16,
    padding: sp[4],
    gap: sp[3],
  },
  source: {
    gap: sp[2],
    borderTopWidth: 1,
    borderTopColor: P.border,
    paddingTop: sp[3],
  },
  action: { gap: sp[3], paddingTop: sp[4] },
  options: { flexDirection: "row", flexWrap: "wrap", gap: sp[2] },
  option: {
    padding: sp[3],
    minHeight: 48,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
  },
  selected: { backgroundColor: P.primary },
  selectedText: { color: P.ink },
  button: { minHeight: 48, justifyContent: "center", paddingVertical: sp[2] },
  link: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    color: P.paper,
    textDecorationLine: "underline",
  },
});
