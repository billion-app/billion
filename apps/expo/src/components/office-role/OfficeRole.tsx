import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type { OfficeRoleContext } from "~/utils/office-role";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card, Icon } from "~/components/ui";
import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";
import { resolveOfficeRole } from "~/utils/office-role";

/** Shared office explanation: no candidate identity, promises or analysis. */
export function OfficeRole(context: OfficeRoleContext) {
  const role = resolveOfficeRole(context);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  if (!role)
    return (
      <View style={s.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          onPress={() => setDetailsOpen((value) => !value)}
          style={s.disclosure}
        >
          <Text style={s.meta}>Office guide unavailable</Text>
          <Icon
            name={detailsOpen ? "chevD" : "chevR"}
            size={16}
            color={P.inkOnNight}
          />
        </Pressable>
        {detailsOpen && (
          <Text style={s.meta}>
            We have not added a guide to this office yet. Responsibilities vary
            by location; candidate promises do not establish legal powers.
          </Text>
        )}
      </View>
    );
  return (
    <View style={s.section}>
      <Card style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>
          The job
        </Text>
        <>
          <View style={s.relationship}>
            {[
              { label: "Power", text: role.action, icon: "doc" as const },
              { label: "Check", text: role.check, icon: "users" as const },
            ].map((step) => (
              <View key={step.label} style={s.relationshipRow}>
                <View
                  style={s.iconColumn}
                  aria-hidden={true}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {step.label === "Power" && <View style={s.rail} />}
                  <View style={s.node}>
                    <Icon name={step.icon} size={18} color={P.spark} />
                  </View>
                </View>
                <View style={s.relationshipText}>
                  <Text style={s.relationshipLabel}>{step.label}</Text>
                  <Text style={s.relationshipBody}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            onPress={() => setDetailsOpen((value) => !value)}
            style={s.disclosure}
          >
            <Text style={s.label}>
              {detailsOpen
                ? "Hide responsibilities and limits"
                : "Responsibilities and limits"}
            </Text>
            <Icon
              name={detailsOpen ? "chevD" : "chevR"}
              size={16}
              color={P.inkOnNight}
            />
          </Pressable>
          {detailsOpen && (
            <View style={s.details}>
              <Text style={s.meta}>
                {role.title} · {role.term}
              </Text>
              <Text style={s.meta}>Serves: {role.serves}</Text>
              <Text accessibilityRole="header" style={s.label}>
                Decisions it makes
              </Text>
              <Text style={s.body}>{role.power}</Text>
              <Text accessibilityRole="header" style={s.label}>
                Limits and checks
              </Text>
              <Text style={s.body}>{role.limit}</Text>
              <Text accessibilityRole="header" style={s.label}>
                In everyday life
              </Text>
              <Text style={s.body}>{role.example}</Text>
              <Text style={s.meta}>
                Billion's sourced explanation of the office, shared across
                candidates. Examples are not campaign promises or predicted
                outcomes.
              </Text>
              <Text accessibilityRole="header" style={s.label}>
                Official sources
              </Text>
              {role.sources.map((source) => (
                <Pressable
                  key={source.url}
                  accessibilityRole="link"
                  accessibilityLabel={source.label}
                  onPress={() => {
                    void Linking.openURL(source.url).then(
                      () => setSourceError(false),
                      () => setSourceError(true),
                    );
                  }}
                  style={s.source}
                >
                  <Text
                    style={[
                      s.meta,
                      { textDecorationLine: "underline", flex: 1 },
                    ]}
                  >
                    {source.label}
                  </Text>
                  <Icon name="external" size={16} color={P.inkOnNight} />
                </Pressable>
              ))}
              {sourceError && (
                <Text accessibilityRole="alert" style={s.meta}>
                  Could not open the source. Tap the source again to retry.
                </Text>
              )}
            </View>
          )}
        </>
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: sp[3], marginVertical: sp[3] },
  card: { padding: sp[4], gap: sp[3] },
  disclosure: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sp[2],
  },
  source: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
  },
  relationship: { gap: sp[3], position: "relative" },
  relationshipRow: {
    flexDirection: "row",
    gap: sp[3],
    alignItems: "flex-start",
  },
  relationshipText: { flex: 1, gap: 2 },
  iconColumn: { width: 33, alignSelf: "stretch" },
  rail: {
    position: "absolute",
    left: 16,
    top: 33,
    bottom: -sp[3],
    width: 1,
    backgroundColor: P.spark,
  },
  node: {
    width: 33,
    height: 33,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: P.spark,
    backgroundColor: P.card,
    alignItems: "center",
    justifyContent: "center",
  },
  relationshipLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: P.spark,
  },
  relationshipBody: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  details: { gap: sp[3] },
  heading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 18,
  },
  label: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 15,
    flexShrink: 1,
  },
  body: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 21,
  },
});
