import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { Evidence } from "~/components/accountability/model";
import { exampleFor } from "~/components/accountability/examples";
import {
  actionsFor,
  confirmedResultCandidate,
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
  const priorities = holder
    ? example.priorities.filter(
        (priority) => priority.candidateId === holder.candidateId,
      )
    : [];
  const resultCandidate = confirmedResultCandidate(
    example.identity,
    example.candidates,
    example.result,
  );
  const resultSummary = example.result.disputed
    ? "The result is disputed. We can’t confirm who took office while the dispute remains unresolved."
    : example.result.stage === "missing"
      ? "Results are unavailable in this preview. Missing records do not mean nobody won."
      : example.result.stage === "certified" && resultCandidate
        ? `${resultCandidate.name} won this election. The result is certified; taking office has its own record.`
        : example.result.stage === "certified"
          ? "We can’t verify a result for this contest."
          : stageCopy[example.result.stage];
  return (
    <View style={s.screen}>
      <NavHeader
        title="After the election"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.lead}>
          <Text style={s.kicker}>
            {example.synthetic ? "FICTIONAL EXAMPLE" : "HISTORICAL PREVIEW"} ·
            NO LIVE UPDATES
          </Text>
          <Text style={s.contest}>{example.label}</Text>
          <Text accessibilityRole="header" style={s.title}>
            {holder
              ? `${holder.name} took office`
              : "We can’t confirm who took office"}
          </Text>
          {holder ? (
            <>
              <Text style={s.body}>
                Took office {formatDate(holder.tookOffice)}. Election result
                certified.
              </Text>
              <Text style={s.caption}>
                {example.synthetic
                  ? "The people, dates and records on this page are fictional."
                  : "Historical term entry, not a current officeholder lookup."}
              </Text>
              <Source
                evidence={holder.evidence}
                label="Read inauguration record"
              />
            </>
          ) : (
            <>
              <Text style={s.body}>{resultSummary}</Text>
              {example.synthetic && (
                <Text style={s.caption}>
                  The people, dates and records on this page are fictional.
                </Text>
              )}
              {example.result.evidence && (
                <Source
                  evidence={example.result.evidence}
                  label="Read election result"
                />
              )}
            </>
          )}
        </View>
        <Card
          title={
            actions.length || priorities.length
              ? (priorities[0]?.topic ??
                actions[0]?.topic ??
                "Priorities and actions")
              : "Action history unavailable"
          }
        >
          {!holder ? (
            <Text style={s.body}>
              We can’t connect actions to an officeholder until their identity
              is confirmed.
            </Text>
          ) : actions.length || priorities.length ? (
            <>
              {priorities.map((priority) => (
                <View key={priority.id} style={s.block}>
                  <Text style={s.label}>Campaign priority</Text>
                  <Text style={s.body}>
                    {priority.text.replace(/^Campaign priority: /, "")}
                  </Text>
                  <Text style={s.caption}>
                    {formatDate(priority.date)} · Candidate statement
                  </Text>
                  <Source
                    evidence={priority.evidence}
                    label="Read campaign statement"
                  />
                </View>
              ))}
              {!actions.length && (
                <Text style={s.body}>
                  No action records are included yet. That doesn’t mean no
                  action was taken.
                </Text>
              )}
              {actions.map((action, index) => (
                <View key={action.date + action.text} style={s.block}>
                  <Text style={s.label}>Recorded action</Text>
                  <Text style={s.body}>{action.text}</Text>
                  <Text style={s.caption}>
                    {formatDate(action.date)} ·{" "}
                    {action.kind === "sponsorship"
                      ? "Proposal introduced"
                      : action.kind === "vote"
                        ? "Individual vote"
                        : "Documented decision"}
                  </Text>
                  <Text style={s.label}>What this tells us</Text>
                  <Text style={s.body}>{action.context}</Text>
                  {!priorities.length && index === 0 && (
                    <Text style={s.caption}>
                      No campaign statement is included, so a promise comparison
                      is unavailable.
                    </Text>
                  )}
                  <Source
                    evidence={action.evidence}
                    label="Read action record"
                  />
                </View>
              ))}
            </>
          ) : (
            <Text style={s.body}>
              This preview has no campaign statements or action records for this
              term. That doesn’t tell us what this officeholder did.
            </Text>
          )}
        </Card>
        {holder && (
          <View style={s.result}>
            <Text style={s.body}>{resultSummary}</Text>
            {example.result.evidence && (
              <Source
                evidence={example.result.evidence}
                label="Read election result"
              />
            )}
          </View>
        )}

        <Disclosure
          key={`results-${scenario}`}
          title="Result details and sources"
        >
          <Text style={s.body}>
            {holder
              ? "Certification confirms the election result. The separate inauguration record above confirms taking office."
              : "A final result and a separate taking-office record are needed before we can connect this contest to an officeholder."}
          </Text>
          <Text style={s.caption}>
            Candidates:{" "}
            {example.candidates.map((candidate) => candidate.name).join(" · ")}.
          </Text>
          {example.result.evidence && (
            <EvidenceDetails evidence={example.result.evidence} />
          )}
          {example.extraEvidence.map((evidence) => (
            <EvidenceDetails key={evidence.url} evidence={evidence} />
          ))}
        </Disclosure>
        <Disclosure title="About this preview">
          <Text style={s.body}>
            One historical California governor contest and fictional examples.
            Records were checked October 2, 2026. There are no alerts, saved
            follows or automatic updates. Check linked official records for
            changes or corrections.
          </Text>
          {actions.length > 0 && (
            <Text style={s.body}>
              An individual vote is not the whole outcome. Policy effects can be
              uncertain and shared across institutions. This preview does not
              score whether a promise was kept.
            </Text>
          )}
        </Disclosure>
        <Disclosure key={`scenarios-${scenario}`} title="Test scenarios">
          <View style={s.options}>
            {[
              "historical",
              "full",
              "sparse",
              "priorities-only",
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
                onPress={() => setScenario(value)}
              >
                <Text style={[s.link, scenario === value && s.selectedText]}>
                  {value === "full"
                    ? "Fictional actions"
                    : value === "sparse"
                      ? "No action records"
                      : value === "priorities-only"
                        ? "Priority only"
                        : value.charAt(0).toUpperCase() + value.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Disclosure>
      </ScrollView>
    </View>
  );
}
function Source({ evidence, label }: { evidence: Evidence; label: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!evidence.url) return null;
  return (
    <View style={s.block}>
      <View style={s.sourceRow}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${label} — ${evidence.publisher}: ${evidence.locator}`}
          style={[s.button, s.sourceLink]}
          onPress={() => {
            setFailed(false);
            void Linking.openURL(evidence.url).catch(() => setFailed(true));
          }}
        >
          <Text style={s.link}>{label}</Text>
          <Text style={s.caption}>{evidence.publisher}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Details — ${label}`}
          accessibilityState={{ expanded }}
          style={s.sourceToggle}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={s.disclosureLabel}>Details {expanded ? "−" : "+"}</Text>
        </Pressable>
      </View>
      {failed && (
        <Text accessibilityRole="alert" style={s.body}>
          Could not open the record. Try its link again.
        </Text>
      )}
      {expanded && <EvidenceDetails evidence={evidence} showLink={false} />}
    </View>
  );
}
function EvidenceDetails({
  evidence,
  showLink = true,
}: {
  evidence: Evidence;
  showLink?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.block}>
      <Text style={s.caption}>
        {evidence.publisher} · Published {formatDate(evidence.published)}
        {"\n"}
        {evidence.locator}
      </Text>
      {showLink && evidence.url && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open source record — ${evidence.publisher}: ${evidence.locator}`}
          style={s.button}
          onPress={() => {
            setFailed(false);
            void Linking.openURL(evidence.url).catch(() => setFailed(true));
          }}
        >
          <Text style={s.link}>Open source record</Text>
        </Pressable>
      )}
      {failed && (
        <Text accessibilityRole="alert" style={s.body}>
          Could not open the record. Try its link again.
        </Text>
      )}
    </View>
  );
}
function Disclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.button}
      >
        <Text style={s.disclosureLabel}>
          {title} {expanded ? "−" : "+"}
        </Text>
      </Pressable>
      {expanded && <View style={s.block}>{children}</View>}
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
function formatDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    padding: sp[5],
    gap: sp[5],
    paddingBottom: sp[10],
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  lead: { gap: sp[3] },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: sp[2] },
  sourceLink: { flex: 1 },
  sourceToggle: {
    minHeight: 48,
    minWidth: 80,
    justifyContent: "center",
    paddingHorizontal: sp[2],
  },
  title: { fontFamily: fontEditorial.regular, fontSize: 30, color: P.paper },
  contest: {
    fontFamily: fontBody.medium,
    fontSize: 16,
    lineHeight: 24,
    color: P.paper,
  },
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
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 19,
    color: P.paper,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 21,
    color: P.paper,
  },
  card: {
    backgroundColor: P.card,
    borderRadius: 16,
    padding: sp[4],
    gap: sp[4],
  },
  block: { gap: sp[3] },
  result: {
    borderTopWidth: 1,
    borderTopColor: P.border,
    paddingTop: sp[4],
    gap: sp[2],
  },
  disclosure: { borderTopWidth: 1, borderTopColor: P.border },
  disclosureLabel: {
    fontFamily: fontBody.medium,
    fontSize: 15,
    lineHeight: 23,
    color: P.paper,
  },
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
