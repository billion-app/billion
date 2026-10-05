import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { PublicMeasureRelationship } from "@acme/validators";

import { fontBody, fontEditorial, hair, DigestPalette as P } from "~/styles";
import { BallotText as Text } from "./BallotText";

export function MeasureRelationships({
  number,
  relationships,
}: {
  number: string;
  relationships: PublicMeasureRelationship[];
}) {
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.heading}>
        Related measures
      </Text>
      {relationships.length ? (
        relationships.map((r) => (
          <Relationship key={r.revision} relationship={r} number={number} />
        ))
      ) : (
        <Text style={s.caption}>
          Relationships haven’t been verified for this guide entry. Missing
          links don’t mean there are no interactions.
        </Text>
      )}
      <Text style={s.caption}>
        A starting point for your research. Check the legal text and conditions
        before drawing conclusions.
      </Text>
    </View>
  );
}
function Relationship({
  relationship: r,
  number,
}: {
  relationship: PublicMeasureRelationship;
  number: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const router = useRouter();
  const other = r.measures.find((m) => m.number !== number);
  if (!other) return null;
  const labels = {
    neither: "Neither passes",
    onlyFirst: `Only ${r.measures[0].number} passes`,
    onlySecond: `Only ${r.measures[1].number} passes`,
    both: "Both pass",
  };
  const claim = (c: PublicMeasureRelationship["takeaway"], key: string) => (
    <View key={key} style={s.claim}>
      <Text style={s.body}>{c.text}</Text>
      <View style={s.citations}>
        {c.sourceIds.map((id) => {
          const source = r.sources.find((s) => s.id === id);
          return source ? (
            <Pressable
              key={id}
              accessibilityRole="link"
              accessibilityLabel={`Proposition ${source.number}, ${source.locator}, open official source`}
              style={s.citation}
              onPress={() => {
                void Linking.openURL(source.url).catch(() => setFailed(true));
              }}
            >
              <Text style={s.link}>
                {source.number} ·{" "}
                {source.role === "legal-text" ? "Legal text" : "LAO analysis"} ↗
              </Text>
            </Pressable>
          ) : null;
        })}
      </View>
    </View>
  );
  return (
    <View style={s.card}>
      <Text style={s.caption}>
        Billion explanation ·{" "}
        {r.kind === "uncertain"
          ? "Possible interaction"
          : r.kind === "conflict"
            ? "Possible conflict"
            : r.kind.charAt(0).toUpperCase() + r.kind.slice(1)}{" "}
        · {r.electionDate}
      </Text>
      <Text style={s.body}>{r.takeaway.text}</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({
            pathname: "/proposition-detail",
            params: { number: other.number },
          })
        }
      >
        <Text style={s.link}>Read Proposition {other.number} →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.trigger}
      >
        <Text style={s.label}>
          {open ? "Hide combined outcomes −" : "Explore combined outcomes +"}
        </Text>
      </Pressable>
      {open && (
        <View style={s.section}>
          {Object.entries(r.scenarios).map(([key, c]) => (
            <View key={key} style={s.scenario}>
              <Text style={s.label}>{labels[key as keyof typeof labels]}</Text>
              {claim(c, key)}
            </View>
          ))}
          <Text style={s.heading}>Which provisions interact?</Text>
          {r.affectedProvisions.map((c, i) => claim(c, `provision-${i}`))}
          <Text style={s.heading}>Conditions and unknowns</Text>
          {r.conditions.map((c, i) => claim(c, `condition-${i}`))}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: sourcesOpen }}
            onPress={() => setSourcesOpen(!sourcesOpen)}
            style={s.trigger}
          >
            <Text style={s.label}>
              {sourcesOpen
                ? "Hide source records −"
                : "Source records and review +"}
            </Text>
          </Pressable>
          {sourcesOpen &&
            r.sources.map((source) => (
              <View key={source.id}>
                <Text style={s.caption}>
                  Proposition {source.number} · {source.locator} · Retrieved{" "}
                  {source.retrievedAt.slice(0, 10)} UTC.
                </Text>
              </View>
            ))}
          <Text style={s.caption}>
            {r.review.state === "approved"
              ? `Reviewed ${r.review.reviewedAt?.slice(0, 10)} · ${r.review.reviewer}.`
              : "Editorial review pending · preview only."}{" "}
            Source retrieval is separate from editorial review.
          </Text>
        </View>
      )}
      {failed && (
        <Text accessibilityRole="alert" style={s.caption}>
          Could not open source. Tap the source link to retry.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 12 },
  card: {
    backgroundColor: P.card,
    borderColor: hair[1],
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 24,
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
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  link: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
    textDecorationLine: "underline",
    paddingVertical: 12,
  },
  trigger: {
    minHeight: 44,
    justifyContent: "center",
    borderTopWidth: 1,
    borderColor: hair[1],
  },
  scenario: { borderTopWidth: 1, borderColor: hair[1], paddingTop: 12, gap: 6 },
  claim: { gap: 2 },
  citations: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  citation: { minHeight: 44, justifyContent: "center" },
});
