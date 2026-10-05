import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { propositionContextSchema } from "@acme/validators";

import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import {
  ContextUnavailable,
  PropositionContext,
} from "~/components/ballot-evidence/PropositionContext";
import { NavHeader } from "~/components/ui";
import { fontBody, DigestPalette as P } from "~/styles";

// Source-backed pending records only in development. No API override or fallback.
// Conditional require keeps the preview records out of release bundles.
const pilots = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("~/components/ballot-evidence/development/context-pilots.json") as unknown)
  : [];
// Parse public records by supplying a placeholder only for the server-only snapshot.
const records = Array.isArray(pilots)
  ? pilots.map((raw: unknown) => {
      const value = raw as { sources: Record<string, unknown>[] };
      return propositionContextSchema.parse({
        ...value,
        sources: value.sources.map((source) => ({
          ...source,
          snapshot:
            "Development public projection; see captured evidence artifacts",
        })),
      });
    })
  : [];
export default function PropositionContextPreview() {
  const router = useRouter();
  const [selected, setSelected] = useState("0");
  const record = records[Number(selected)];
  return (
    <View style={s.screen}>
      <NavHeader
        title="Explanation pilot"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        {__DEV__ ? (
          <>
            <Text style={s.meta}>
              Development preview ·{" "}
              {record?.electionDate ?? "No source selected"} · Source-backed
              pilot · not live or editorially approved
            </Text>
            <View style={s.options}>
              {[
                ...records.map((value, i) => ({
                  id: String(i),
                  label: `Prop ${value.number}`,
                })),
                { id: "missing", label: "Missing" },
                { id: "stale", label: "Stale" },
                { id: "error", label: "Error" },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === option.id }}
                  onPress={() => setSelected(option.id)}
                  style={[s.option, selected === option.id && s.selected]}
                >
                  <Text style={s.meta}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {record ? (
              <View key={selected} style={{ gap: 16 }}>
                <Text style={s.meta}>{record.officialTitle}</Text>
                <PropositionContext analysis={record} preview />
              </View>
            ) : (
              <ContextUnavailable
                state={
                  selected === "stale"
                    ? "stale"
                    : selected === "error"
                      ? "error"
                      : "missing"
                }
              />
            )}
          </>
        ) : (
          <Text style={s.meta}>
            Explanation pilot unavailable. Read the official guide from
            Elections.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minWidth: 85,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: P.border,
  },
  selected: { backgroundColor: P.card },
  meta: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
});
