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
import { Icon, NavHeader } from "~/components/ui";
import {
  DigestHair,
  fontBody,
  fontEditorial,
  DigestPalette as P,
  sp,
} from "~/styles";

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
            {example.synthetic ? "FICTIONAL EXAMPLE" : "HISTORICAL TERM"} · NO
            LIVE UPDATES
          </Text>
          <Text accessibilityRole="header" style={s.identity}>
            {holder ? holder.name : "Officeholder unconfirmed"}
          </Text>
          <Text style={s.caption}>{example.label}</Text>
          {holder ? (
            <View style={s.statuses}>
              <View style={s.status}>
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Icon name="vote" size={18} color={P.spark} />
                </View>
                <View style={s.statusText}>
                  <Text style={s.label}>Election certified</Text>
                </View>
              </View>
              <View style={s.status}>
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Icon name="calendar" size={18} color={P.spark} />
                </View>
                <View style={s.statusText}>
                  <Text style={s.label}>Term began</Text>
                  <Text style={s.caption}>{formatDate(holder.tookOffice)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.unconfirmed}>
              <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Icon name="help" size={20} color={P.paper} />
              </View>
              <Text style={[s.body, { flex: 1 }]}>{resultSummary}</Text>
            </View>
          )}
        </View>
        {holder && (actions.length || priorities.length) ? (
          <>
            {priorities.map((priority) => (
              <View key={priority.id} style={s.priorityRow}>
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Icon name="flag" size={18} color={P.spark} />
                </View>
                <View style={s.statusText}>
                  <Text style={s.label}>Campaign priority</Text>
                  <Text style={s.body}>{priority.text}</Text>
                  <Text style={s.caption}>{formatDate(priority.date)}</Text>
                  <Source
                    evidence={priority.evidence}
                    label="Read campaign statement"
                  />
                </View>
              </View>
            ))}
            {actions.map((action) => (
              <View key={action.date + action.text} style={s.block}>
                <View style={s.paperBrief}>
                  <View style={s.actionMeta}>
                    <View
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Icon name="doc" size={18} color={P.ink} />
                    </View>
                    <Text style={s.paperLabel}>
                      {action.topic.toUpperCase()}
                    </Text>
                  </View>
                  <Text accessibilityRole="header" style={s.actionTitle}>
                    {action.reading?.headline ?? action.text}
                  </Text>
                  <Text style={s.paperCaption}>
                    {formatDate(action.date)} ·{" "}
                    {action.kind === "sponsorship"
                      ? "Proposal introduced"
                      : action.kind === "vote"
                        ? "Individual vote"
                        : "Documented decision"}
                  </Text>
                  <View style={s.mechanismRow}>
                    <View
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={[s.stepIcon, s.changeIcon]}
                    >
                      <Icon
                        name={action.kind === "sponsorship" ? "doc" : "clock"}
                        size={21}
                        color={P.ink}
                      />
                    </View>
                    <View style={s.stepText}>
                      <Text style={s.paperLabel}>WHAT CHANGED</Text>
                      <Text style={s.mechanismAnswer}>
                        {action.reading?.change ?? action.text}
                      </Text>
                      {action.reading?.scope && (
                        <Text style={s.paperCaption}>
                          {action.reading.scope}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={[s.mechanismRow, s.unknownRow]}>
                    <View
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={s.stepIcon}
                    >
                      <Icon name="help" size={21} color={P.ink} />
                    </View>
                    <View style={s.stepText}>
                      <Text style={s.paperLabel}>STILL UNKNOWN</Text>
                      <Text style={s.mechanismAnswer}>
                        {action.reading?.unknown ?? action.context}
                      </Text>
                      <Text style={s.paperCaption}>
                        Not shown by this record
                      </Text>
                    </View>
                  </View>
                  {!priorities.length && (
                    <View style={s.comparisonRow}>
                      <View
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Icon name="message" size={16} color={P.ink} />
                      </View>
                      <Text style={[s.paperCaption, { flex: 1 }]}>
                        Campaign comparison unavailable · No statement included
                      </Text>
                    </View>
                  )}
                </View>
                <Source
                  evidence={action.evidence}
                  label={
                    action.kind === "decision"
                      ? "Read signing record"
                      : "Read action record"
                  }
                />
              </View>
            ))}
            {!actions.length && (
              <Card title="Action records not included">
                <Text style={s.body}>
                  That does not mean no action was taken.
                </Text>
              </Card>
            )}
          </>
        ) : (
          <Card title="Action history unavailable">
            <Text style={s.body}>
              {holder
                ? "No priorities or actions included for this term. Coverage is unknown."
                : "We can’t connect actions until the officeholder is confirmed."}
            </Text>
          </Card>
        )}
        <Disclosure key={`results-${scenario}`} title="Election & term records">
          <Text style={s.body}>
            {holder
              ? "Certification confirms the election result. The separate inauguration record confirms taking office."
              : "A final result and a separate taking-office record are needed before we can connect this contest to an officeholder."}
          </Text>
          <Text style={s.caption}>
            Candidates:{" "}
            {example.candidates.map((candidate) => candidate.name).join(" · ")}.
          </Text>
          {example.result.evidence && (
            <EvidenceDetails evidence={example.result.evidence} />
          )}
          {holder && (
            <Source
              evidence={holder.evidence}
              label="Read inauguration record"
            />
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
    gap: sp[4],
    paddingBottom: sp[10],
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  lead: { gap: sp[2] },
  identity: { fontFamily: fontEditorial.regular, fontSize: 25, color: P.paper },
  statuses: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp[3],
    marginTop: sp[2],
  },
  status: {
    flexDirection: "row",
    gap: sp[2],
    flexGrow: 1,
    flexBasis: 145,
    alignItems: "center",
  },
  statusText: { flex: 1, gap: 3 },
  unconfirmed: {
    flexDirection: "row",
    gap: sp[3],
    alignItems: "flex-start",
    marginTop: sp[2],
  },
  priorityRow: { flexDirection: "row", gap: sp[3], paddingTop: sp[2] },
  paperBrief: {
    backgroundColor: P.paper,
    borderRadius: 16,
    padding: sp[4],
    gap: sp[2],
  },
  actionMeta: { flexDirection: "row", alignItems: "center", gap: sp[2] },
  actionTitle: {
    fontFamily: fontEditorial.regular,
    fontSize: 27,
    color: P.ink,
  },
  paperLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    lineHeight: 19,
    color: P.ink,
  },
  paperCaption: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.ink,
  },
  mechanismRow: {
    flexDirection: "row",
    gap: sp[3],
    paddingTop: sp[4],
    paddingBottom: sp[2],
  },
  unknownRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.inkHair,
  },
  changeIcon: { backgroundColor: P.spark, borderColor: P.spark },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.paper,
    borderWidth: 1,
    borderColor: P.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: { flex: 1, gap: 4 },
  mechanismAnswer: {
    fontFamily: fontBody.semibold,
    fontSize: 18,
    lineHeight: 25,
    color: P.ink,
  },
  comparisonRow: {
    flexDirection: "row",
    gap: sp[2],
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: DigestHair.inkHair,
    paddingTop: sp[3],
  },
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
