import { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";

import type { OfficeRoleContext } from "~/utils/office-role";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card, Icon } from "~/components/ui";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";
import { resolveOfficeRole } from "~/utils/office-role";

/** Shared office explanation: no candidate identity, promises or analysis. */
export function OfficeRole(context: OfficeRoleContext) {
  const role = resolveOfficeRole(context);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
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
        <Text style={s.attribution}>Billion’s sourced office guide</Text>
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
                  {...(Platform.OS !== "web"
                    ? {
                        accessibilityElementsHidden: true,
                        importantForAccessibility:
                          "no-hide-descendants" as const,
                      }
                    : {})}
                >
                  {step.label === "Power" && <View style={s.rail} />}
                  <View style={s.node}>
                    <Icon name={step.icon} size={18} color={P.badgeIndigo} />
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
              color={P.badgeIndigo}
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
              <View style={s.sources}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: sourcesOpen }}
                  onPress={() => setSourcesOpen((value) => !value)}
                  style={s.sourceToggle}
                >
                  <Icon name="link" size={14} color={P.quiet} />
                  <Text style={s.sourceLabel}>
                    Official sources · {role.sources.length}
                  </Text>
                  <Icon
                    name={sourcesOpen ? "chevD" : "chevR"}
                    size={14}
                    color={P.quiet}
                  />
                </Pressable>
                {sourcesOpen && (
                  <View>
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
                  </View>
                )}
              </View>
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
  card: {
    padding: sp[4],
    gap: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderLeftColor: P.badgeIndigo,
    backgroundColor: planes.slate,
  },
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
    backgroundColor: hair[3],
  },
  node: {
    width: 33,
    height: 33,
    borderRadius: 9,
    backgroundColor: `${P.badgeIndigo}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  relationshipLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: P.inkOnNight,
  },
  relationshipBody: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  sources: { borderTopWidth: 1, borderTopColor: hair[1] },
  sourceToggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sourceLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.70)",
    fontFamily: fontBody.medium,
    fontSize: 11.5,
  },
  details: {
    gap: sp[3],
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingTop: 13,
  },
  attribution: {
    color: P.inkOnNight,
    opacity: 0.72,
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: -8,
  },
  heading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
  },
  label: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 12,
    flexShrink: 1,
  },
  body: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  meta: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
