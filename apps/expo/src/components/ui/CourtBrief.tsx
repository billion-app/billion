import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { RouterOutputs } from "@acme/api";

import { colors, digest, fontBody, fontEditorial, hair } from "../../styles";

type CourtDetail = Extract<
  RouterOutputs["content"]["getById"],
  { type: "court_case" }
>;
export type CourtBriefData = NonNullable<CourtDetail["courtBrief"]>;
type Point = CourtBriefData["action"];

const proceedingLabels = {
  emergency_order: "Emergency order · Interim relief",
  order: "Order · Scope limited to the request",
  merits_opinion: "Merits opinion · Scope limited to decided issues",
  unknown: "Procedural scope unknown",
};
const reasonLabels = {
  holding: "Holding",
  court_reasoning: "Court reasoning",
  party_argument: "Party argument",
  allegation: "Allegation",
};

/** Sources use real web links, accessible on both native and browser readers. */
export function CourtBrief({ data }: { data: CourtBriefData }) {
  const point = (item: Point, key: string) => (
    <View key={key} style={s.point}>
      <Text style={s.body}>{item.text}</Text>
      {item.quote ? (
        <Text style={s.quote}>
          “{item.quote.text}”
          {item.quote.locator ? ` (${item.quote.locator})` : ""}
        </Text>
      ) : null}
      <View style={s.links}>
        {item.documentIds.map((id) => {
          const source = data.sources.find((entry) => entry.id === id);
          return source ? (
            <TouchableOpacity
              key={id}
              accessibilityRole="link"
              accessibilityLabel={`Open official source ${id}`}
              onPress={() => void Linking.openURL(source.url)}
            >
              <Text style={s.link}>
                Official source {id.replace("document-", "")}
              </Text>
            </TouchableOpacity>
          ) : null;
        })}
      </View>
    </View>
  );
  return (
    <View testID="court-brief" style={s.root}>
      <Text style={s.scope}>{proceedingLabels[data.proceeding]}</Text>
      <Text style={s.metadata}>
        {data.court} · {data.docket}
        {data.decisionDate
          ? ` · ${data.decisionDate}`
          : " · Decision date unknown"}
      </Text>
      <Text style={s.heading} accessibilityRole="header">
        The takeaway
      </Text>
      {point(data.takeaway, "takeaway")}
      <Text style={s.heading} accessibilityRole="header">
        What the court did
      </Text>
      {point(data.action, "action")}
      <Text style={s.body}>{data.posture}</Text>
      {data.questions.length ? (
        <Text style={s.heading} accessibilityRole="header">
          Questions before the court
        </Text>
      ) : null}
      {data.questions.map((item, i) => point(item, `question-${i}`))}
      {data.reasoning.length ? (
        <Text style={s.heading} accessibilityRole="header">
          Reasoning and its limits
        </Text>
      ) : null}
      {data.reasoning.map((item, i) => (
        <View key={i}>
          <Text style={s.label}>{reasonLabels[item.kind]}</Text>
          {point(item, `reason-${i}`)}
        </View>
      ))}
      {data.effects.length ? (
        <Text style={s.heading} accessibilityRole="header">
          Who may be affected
        </Text>
      ) : null}
      {data.effects.map((item, i) => (
        <View key={i}>
          <Text style={s.label}>
            {item.group} ·{" "}
            {item.certainty === "court_order"
              ? "Ordered effect"
              : "Possible effect"}
          </Text>
          {point(item, `effect-${i}`)}
        </View>
      ))}
      {data.opinions.length ? (
        <Text style={s.heading} accessibilityRole="header">
          Published opinions
        </Text>
      ) : null}
      {data.opinions.map((item, i) => (
        <View key={i}>
          <Text style={s.label}>
            {item.kind.replace("_", " ")} ·{" "}
            {item.author ?? "Author not established"}
          </Text>
          {point(item, `opinion-${i}`)}
        </View>
      ))}
      <Text style={s.heading} accessibilityRole="header">
        What remains unresolved
      </Text>
      {data.unknowns.map((item, i) => (
        <Text key={i} style={s.point}>
          {item}
        </Text>
      ))}
      <Text style={s.heading} accessibilityRole="header">
        Source documents
      </Text>
      {data.sources.map((source) => (
        <TouchableOpacity
          key={source.id}
          accessibilityRole="link"
          accessibilityLabel={`Open full official document ${source.id}`}
          onPress={() => void Linking.openURL(source.url)}
        >
          <Text style={s.link}>
            Official document {source.id.replace("document-", "")}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingBottom: 24 },
  scope: {
    fontFamily: fontBody.regular,
    color: digest.spark,
    fontSize: 14,
    lineHeight: 22,
  },
  metadata: {
    fontFamily: fontBody.regular,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  heading: {
    fontFamily: fontEditorial.regular,
    color: colors.white,
    fontSize: 22,
    marginTop: 24,
    marginBottom: 12,
  },
  body: {
    fontFamily: fontBody.regular,
    color: colors.white,
    fontSize: 16,
    lineHeight: 25,
  },
  label: {
    fontFamily: fontBody.regular,
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  point: {
    fontFamily: fontBody.regular,
    color: colors.white,
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 16,
  },
  quote: {
    fontFamily: fontEditorial.regular,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: hair[3],
    paddingLeft: 12,
    marginTop: 10,
  },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  link: {
    fontFamily: fontBody.regular,
    color: digest.spark,
    fontSize: 14,
    lineHeight: 24,
    textDecorationLine: "underline",
    paddingVertical: 6,
  },
});
