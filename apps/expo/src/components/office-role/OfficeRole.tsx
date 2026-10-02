import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { OfficeRoleContext } from "~/utils/office-role";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card } from "~/components/ui";
import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";
import { resolveOfficeRole } from "~/utils/office-role";

/** Shared office explanation: no candidate identity, promises or analysis. */
export function OfficeRole(context: OfficeRoleContext) {
  const role = resolveOfficeRole(context);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.heading}>
        What this job controls
      </Text>
      <Card style={s.card}>
        {role ? (
          <>
            <Text style={s.label}>{role.title}</Text>
            <Text style={s.body}>{role.power}</Text>
            <Text style={s.meta}>
              Serves: {role.serves}. Term: {role.term}.
            </Text>
            <Text accessibilityRole="header" style={s.label}>
              What it cannot do alone
            </Text>
            <Text style={s.body}>{role.limit}</Text>
            <Text accessibilityRole="header" style={s.label}>
              In everyday life
            </Text>
            <Text style={s.body}>{role.example}</Text>
            <Text style={s.meta}>
              Billion's sourced role explanation · shared across candidates.
              Examples illustrate authority, not promised outcomes.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: sourcesOpen }}
              onPress={() => setSourcesOpen((value) => !value)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={s.label}>
                {sourcesOpen
                  ? "Hide official sources"
                  : "Read official sources"}
              </Text>
            </Pressable>
            {sourcesOpen &&
              role.sources.map((source) => (
                <SourceLink
                  key={source.url}
                  label={source.label}
                  url={source.url}
                  prominence="primary"
                />
              ))}
          </>
        ) : (
          <>
            <Text style={s.body}>
              A sourced powers-and-limits explanation is not yet available for
              this office and jurisdiction.
            </Text>
            <Text style={s.meta}>
              Responsibilities vary by location. Candidate promises do not
              establish the office's legal powers.
            </Text>
          </>
        )}
      </Card>
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: sp[3], marginVertical: sp[3] },
  card: { padding: sp[4], gap: sp[3] },
  heading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 20,
  },
  label: { color: P.inkOnNight, fontFamily: fontBody.semibold, fontSize: 15 },
  body: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
});
