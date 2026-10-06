import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import type { PublicMeasureRelationship } from "@acme/validators";
import {
  contextMoneyPresentation,
  measureRelationshipClaimSourceIds,
} from "@acme/validators";

import { Icon } from "~/components/ui";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { BallotText as Text } from "./BallotText";

type Relationship = PublicMeasureRelationship;
type Scenario = keyof Relationship["scenarios"];
type Claim = Relationship["takeaway"];

export function MeasureRelationships({
  number,
  relationships = [],
}: {
  number: string;
  relationships?: Relationship[];
}) {
  const readable = relationships.filter((r) => r.compact);
  if (!readable.length) return null;
  return (
    <View style={s.section} testID="measure-relationships">
      <Text accessibilityRole="header" style={s.heading}>
        Related measures
      </Text>
      {readable.map((r) => (
        <RelationshipCard key={r.revision} relationship={r} number={number} />
      ))}
    </View>
  );
}
function RelationshipCard({
  relationship: r,
  number,
}: {
  relationship: Relationship;
  number: string;
}) {
  const router = useRouter();
  const { fontScale, width } = useWindowDimensions();
  const [selected, setSelected] = useState<Scenario>("both");
  const [failed, setFailed] = useState(false);
  const compact = r.compact;
  if (!compact) return null;
  const stacked = fontScale > 1.3 || width < 340;
  const options: { id: Scenario; label: string; accessible: string }[] = [
    {
      id: "neither",
      label: "Neither passes",
      accessible: "Neither measure passes",
    },
    {
      id: "onlyFirst",
      label: `Only ${r.measures[0].number} passes`,
      accessible: `Only Proposition ${r.measures[0].number} passes`,
    },
    {
      id: "onlySecond",
      label: `Only ${r.measures[1].number} passes`,
      accessible: `Only Proposition ${r.measures[1].number} passes`,
    },
    { id: "both", label: "Both pass", accessible: "Both measures pass" },
  ];
  const outcome = compact.scenarios[selected];
  const sourceLinks = (ids: string[]) => (
    <View style={s.sources}>
      {[...new Set(ids)].map((id) => {
        const source = r.sources.find((item) => item.id === id);
        if (!source) return null;
        return (
          <Pressable
            key={id}
            accessibilityRole="link"
            accessibilityLabel={`Proposition ${source.number}, ${source.locator}, open official source`}
            style={s.sourceLink}
            onPress={() => {
              void Linking.openURL(source.url).then(
                () => setFailed(false),
                () => setFailed(true),
              );
            }}
          >
            <Text style={s.link}>
              {source.number} ·{" "}
              {source.role === "legal-text" ? "Legal text" : "LAO analysis"} ↗
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  const moneyContext = (claim: Claim) =>
    (claim.money ?? []).map((money, index) => {
      const presentation = contextMoneyPresentation(money);
      return (
        <View
          key={index}
          style={s.moneyContext}
          testID="relationship-money-context"
        >
          <Text style={[s.moneyText, { fontWeight: "600" }]}>
            {presentation.nominal}
          </Text>
          <Text style={s.moneyText}>{presentation.comparison}</Text>
          <Text style={s.moneyText}>{presentation.scope}</Text>
          {presentation.reason && (
            <Text style={s.moneyText}>{presentation.reason}</Text>
          )}
          {money.comparison.state === "available" && (
            <>
              <Text style={s.caption}>
                Budget evidence:{" "}
                {money.comparison.denominator.evidence
                  .map((e) => e.locator)
                  .join("; ")}
              </Text>
              {sourceLinks(
                money.comparison.denominator.evidence.map((e) => e.sourceId),
              )}
            </>
          )}
        </View>
      );
    });
  const detailClaim = (claim: Claim, key: string) => (
    <View key={key} style={s.detailClaim}>
      <Text style={s.body}>{claim.text}</Text>
      {moneyContext(claim)}
      {sourceLinks(claim.sourceIds)}
    </View>
  );
  const kindLabel = {
    conflict: "Possible conflict",
    precedence: "Precedence rule",
    dependency: "Depends on another measure",
    uncertain: "Possible interaction",
  }[r.kind];
  return (
    <View style={s.card} testID={`relationship-${r.revision}`}>
      <Text style={s.caption}>Billion explanation · {kindLabel}</Text>
      <View style={[s.pair, stacked && s.pairStacked]}>
        {r.measures.map((measure, index) => {
          const description = compact.measures[index];
          if (!description) return null;
          const node = (
            <View style={s.node}>
              <Text style={s.nodeMeta}>
                PROP {measure.number}
                {number === measure.number ? " · THIS PAGE" : " →"}
              </Text>
              <Text style={s.nodeBody}>{description.text}</Text>
              {moneyContext(description)}
            </View>
          );
          return number === measure.number ? (
            <View key={measure.number} style={[s.nodeWrap, webNodeWrap]}>
              {node}
            </View>
          ) : (
            <Pressable
              key={measure.number}
              accessibilityRole="link"
              accessibilityLabel={`Read Proposition ${measure.number}: ${description.text}`}
              style={[s.nodeWrap, webNodeWrap]}
              onPress={() =>
                router.push({
                  pathname: "/proposition-detail",
                  params: { number: measure.number },
                })
              }
            >
              {node}
            </Pressable>
          );
        })}
      </View>
      <Text style={s.framing}>{compact.takeaway.text}</Text>
      {moneyContext(compact.takeaway)}
      <View style={s.chooser}>
        <Text style={s.label}>What if…</Text>
        <View style={s.optionGrid}>
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={option.accessible}
              accessibilityState={
                Platform.OS === "web"
                  ? undefined
                  : { selected: selected === option.id }
              }
              aria-pressed={selected === option.id}
              onPress={() => setSelected(option.id)}
              style={[
                s.option,
                stacked && s.optionStacked,
                selected === option.id && s.optionSelected,
              ]}
            >
              <Text
                style={[
                  s.optionText,
                  selected === option.id && s.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {selected === option.id && (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                >
                  <Icon name="check" size={13} color={P.primary} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <View
        style={s.result}
        accessibilityLiveRegion="polite"
        aria-live="polite"
        testID="relationship-selected-outcome"
      >
        <Text style={s.resultTitle} testID="relationship-outcome-title">
          {outcome.title.text}
        </Text>
        {moneyContext(outcome.title)}
        <Text style={s.body} testID="relationship-outcome-copy">
          {outcome.consequence.text}
        </Text>
        {moneyContext(outcome.consequence)}
      </View>
      <View style={s.supporting}>
        {selected === "both" && compact.bothPassComparisons && (
          <Disclosure
            title="How Yes totals could matter"
            testID="relationship-vote-comparison"
          >
            <Text style={s.caption}>
              {compact.conflictScopes?.condition.text ??
                "These cases assume both measures pass."}
            </Text>
            {compact.conflictScopes &&
              moneyContext(compact.conflictScopes.condition)}
            {(["firstMore", "secondMore", "equal"] as const).map((key) => (
              <View key={key} style={s.comparison}>
                <Text style={s.label}>
                  {key === "equal"
                    ? "Equal Yes totals"
                    : `${r.measures[key === "firstMore" ? 0 : 1].number} has more Yes votes`}
                </Text>
                <Text style={s.body}>
                  {compact.bothPassComparisons?.[key].text}
                </Text>
                {compact.bothPassComparisons?.[key] &&
                  moneyContext(compact.bothPassComparisons[key])}
              </View>
            ))}
            {sourceLinks(
              Object.values(compact.bothPassComparisons).flatMap((c) =>
                measureRelationshipClaimSourceIds(c),
              ),
            )}
          </Disclosure>
        )}
        <Disclosure
          title={
            r.kind === "dependency"
              ? "Affected provisions"
              : "Which rules overlap?"
          }
          testID="relationship-provisions"
        >
          {compact.provisions.map((provision, index) => (
            <View key={index} style={s.provision}>
              <Text style={s.nodeMeta}>PROP {r.measures[index]?.number}</Text>
              <Text style={s.body}>{provision.text}</Text>
              {moneyContext(provision)}
              {sourceLinks(provision.sourceIds)}
            </View>
          ))}
          {compact.conflictScopes && (
            <>
              <Text style={s.label}>Proposed conflict clauses</Text>
              <Text style={s.caption}>
                {compact.conflictScopes.condition.text}
              </Text>
              {moneyContext(compact.conflictScopes.condition)}
              {compact.conflictScopes.scopes.map((scope, index) => (
                <View key={index} style={s.comparison}>
                  <Text style={s.nodeMeta}>
                    PROP {r.measures[index]?.number}
                  </Text>
                  <Text style={s.body}>{scope.text}</Text>
                  {moneyContext(scope)}
                </View>
              ))}
              {sourceLinks([
                ...compact.conflictScopes.condition.sourceIds,
                ...compact.conflictScopes.scopes.flatMap((c) => c.sourceIds),
              ])}
            </>
          )}
        </Disclosure>
        <Disclosure title="Sources & conditions" testID="relationship-evidence">
          <Text style={s.label}>What remains unresolved</Text>
          {r.conditions.map((claim, index) => (
            <View key={index}>
              <Text style={s.body}>{claim.text}</Text>
              {moneyContext(claim)}
            </View>
          ))}
          <Disclosure title="Full provision explanation">
            {r.affectedProvisions.map((claim, index) =>
              detailClaim(claim, `detail-${index}`),
            )}
          </Disclosure>
          <Text style={s.label}>Official records</Text>
          {r.sources.map((source) => (
            <View key={source.id}>
              <Text style={s.caption}>
                Proposition {source.number} · {source.locator}
              </Text>
              {sourceLinks([source.id])}
              <Text style={s.caption}>
                Retrieved {source.retrievedAt.slice(0, 10)} UTC
              </Text>
            </View>
          ))}
          <Text style={s.caption}>
            {r.review.state === "approved"
              ? `Reviewed ${r.review.reviewedAt?.slice(0, 10)} · ${r.review.reviewer}.`
              : "Editorial review pending · preview only."}{" "}
            Retrieval is separate from editorial review.
          </Text>
        </Disclosure>
      </View>
      <Text style={s.limit}>This comparison covers this pair only.</Text>
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          Could not open source. Tap its link to retry.
        </Text>
      )}
    </View>
  );
}
function Disclosure({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.disclosure} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.trigger}
      >
        <Text style={s.disclosureLabel}>{title}</Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Icon name={open ? "chevD" : "chevR"} size={14} color={P.quiet} />
        </View>
      </Pressable>
      {open && <View style={s.disclosureBody}>{children}</View>}
    </View>
  );
}
// Intrinsic word width lets browser text enlargement reflow the pair. Native
// Dynamic Type uses the explicit stacked layout above.
const webNodeWrap =
  Platform.OS === "web"
    ? ({ flexBasis: "max-content" } as unknown as ViewStyle)
    : undefined;
const s = StyleSheet.create({
  section: { gap: 12 },
  supporting: { gap: 0 },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  card: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 15,
    gap: 12,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    color: P.quiet,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  framing: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  pair: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pairStacked: { flexDirection: "column" },
  nodeWrap: { flex: 1 },
  node: {
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 10,
    padding: 10,
    gap: 6,
    flex: 1,
  },
  nodeMeta: {
    fontFamily: fontBody.medium,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.6,
    color: P.quiet,
  },
  nodeBody: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  chooser: { gap: 8 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  option: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: hair[1],
    backgroundColor: planes.surface,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  optionStacked: { flexBasis: "100%" },
  optionSelected: {
    borderColor: P.primary,
    backgroundColor: `${P.primary}18`,
  },
  optionText: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
    flexShrink: 1,
  },
  optionTextSelected: { fontFamily: fontBody.semibold },
  result: {
    borderLeftWidth: 2,
    borderColor: P.primary,
    backgroundColor: planes.surface,
    borderRadius: 8,
    padding: 12,
    gap: 5,
  },
  resultTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  disclosure: { borderTopWidth: 1, borderColor: hair[1] },
  trigger: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  disclosureLabel: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
    flex: 1,
  },
  disclosureBody: { gap: 10, paddingBottom: 10 },
  comparison: {
    gap: 4,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderColor: hair[1],
  },
  provision: {
    backgroundColor: planes.surface,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  detailClaim: { gap: 5 },
  moneyText: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
  },
  moneyContext: {
    gap: 4,
    borderLeftWidth: 1,
    borderColor: hair[2],
    paddingLeft: 8,
  },
  sources: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  sourceLink: { minHeight: 44, justifyContent: "center" },
  link: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
    textDecorationLine: "underline",
  },
  limit: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    lineHeight: 16,
    color: P.quiet,
  },
});
