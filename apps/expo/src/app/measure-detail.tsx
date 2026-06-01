import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { MeasureArgumentRef, MeasureCitationRef } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, NavHeader, PrimaryButton } from "~/components/ui";
import { colors, fontBody, fontDisplay, planes } from "~/styles";

/** Parse a JSON-encoded route param, tolerating empty/malformed values. */
function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Human-readable label for a source tier. */
const TIER_LABEL: Record<string, string> = {
  county_registrar: "County Registrar",
  state_sos: "Secretary of State",
  lwv: "League of Women Voters",
  ballotpedia: "Ballotpedia",
  wikipedia: "Wikipedia",
  vote_smart: "Vote Smart",
  google_civic: "Google Civic",
  ai_generated: "AI-generated",
};

export default function MeasureDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    referendumTitle: string;
    referendumSubtitle: string;
    referendumProStatement: string;
    referendumConStatement: string;
    referendumText: string;
    referendumUrl: string;
    summary: string;
    summaryLong: string;
    summaryIsAiGenerated: string;
    fiscalImpact: string;
    proArguments: string;
    conArguments: string;
    citations: string;
  }>();

  const summaryIsAi = params.summaryIsAiGenerated === "true";
  const proArgs = parseJson<MeasureArgumentRef[]>(params.proArguments, []);
  const conArgs = parseJson<MeasureArgumentRef[]>(params.conArguments, []);
  const citations = parseJson<MeasureCitationRef[]>(params.citations, []);

  // Fall back to the legacy single-statement fields when no structured list.
  const pros =
    proArgs.length > 0
      ? proArgs
      : params.referendumProStatement
        ? [{ text: params.referendumProStatement, sourceName: "" }]
        : [];
  const cons =
    conArgs.length > 0
      ? conArgs
      : params.referendumConStatement
        ? [{ text: params.referendumConStatement, sourceName: "" }]
        : [];

  // Unique sources for the attribution footer, official ones first.
  const sources = dedupeSources(citations);

  return (
    <View style={s.screen}>
      <NavHeader title="Ballot Measure" onBack={() => router.back()} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.badge}>
          <Text style={s.badgeText}>MEASURE</Text>
        </View>

        <Text style={s.title}>{params.referendumTitle}</Text>

        {params.summaryLong || params.summary || params.referendumSubtitle ? (
          <>
            <Text style={s.subtitle}>
              {params.summaryLong || params.summary || params.referendumSubtitle}
            </Text>
            {summaryIsAi && (
              <View style={s.aiNotice}>
                <Icon name="sparkle" size={13} color={colors.yellow[500]} />
                <Text style={s.aiNoticeText}>
                  AI-generated summary — not from an official source. Verify
                  against the official text below.
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.subtitle}>
            No official information is available for this measure yet.
          </Text>
        )}

        {/* Fiscal impact (official analysis) */}
        {params.fiscalImpact ? (
          <View style={s.section}>
            <Kicker>Fiscal impact</Kicker>
            <Card>
              <Text style={s.fiscalText}>{params.fiscalImpact}</Text>
            </Card>
          </View>
        ) : null}

        {/* Yes / No arguments */}
        {(pros.length > 0 || cons.length > 0) && (
          <View style={s.section}>
            <Kicker>A YES vote vs. a NO vote</Kicker>
            <View style={{ gap: 12 }}>
              {pros.map((arg, i) => (
                <Card key={`pro-${i}`}>
                  <View style={s.stanceHeader}>
                    <View
                      style={[
                        s.stanceDot,
                        { backgroundColor: colors.green[500] },
                      ]}
                    />
                    <Text style={s.stanceLabel}>A YES vote means</Text>
                  </View>
                  <Text style={s.stanceText}>{arg.text}</Text>
                  {(arg.author ?? arg.sourceName) ? (
                    <Text style={s.argAttribution}>
                      — {arg.author ?? arg.sourceName}
                    </Text>
                  ) : null}
                </Card>
              ))}
              {cons.map((arg, i) => (
                <Card key={`con-${i}`}>
                  <View style={s.stanceHeader}>
                    <View
                      style={[
                        s.stanceDot,
                        { backgroundColor: colors.red[500] },
                      ]}
                    />
                    <Text style={s.stanceLabel}>A NO vote means</Text>
                  </View>
                  <Text style={s.stanceText}>{arg.text}</Text>
                  {(arg.author ?? arg.sourceName) ? (
                    <Text style={s.argAttribution}>
                      — {arg.author ?? arg.sourceName}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Full referendum text */}
        {params.referendumText ? (
          <View style={s.section}>
            <Kicker>Full text</Kicker>
            <Card>
              <Text style={s.fullText}>{params.referendumText}</Text>
            </Card>
          </View>
        ) : null}

        {/* Sources / citations — every source points back to its original. */}
        {sources.length > 0 && (
          <View style={s.section}>
            <Kicker>Sources</Kicker>
            <Card>
              {sources.map((src, i) => {
                const open = src.sourceUrl
                  ? () => void Linking.openURL(src.sourceUrl!)
                  : undefined;
                return (
                  <Pressable
                    key={`src-${i}`}
                    onPress={open}
                    disabled={!open}
                    style={[s.sourceRow, i > 0 && s.sourceRowBorder]}
                  >
                    <Icon
                      name={src.official ? "shield" : "info"}
                      size={14}
                      color={
                        src.official ? colors.green[500] : colors.textSecondary
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.sourceName}>{src.sourceName}</Text>
                      <Text style={s.sourceMeta}>
                        {src.official ? "Official · " : ""}
                        {TIER_LABEL[src.tier] ?? src.tier} · for{" "}
                        {src.fields.join(", ")}
                      </Text>
                    </View>
                    {open ? (
                      <Icon
                        name="external"
                        size={14}
                        color={colors.textSecondary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </Card>
          </View>
        )}

        {/* Source link */}
        {params.referendumUrl ? (
          <View style={s.section}>
            <PrimaryButton
              label="View official source"
              icon="external"
              onPress={() => void Linking.openURL(params.referendumUrl)}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

interface FooterSource {
  sourceName: string;
  sourceUrl?: string;
  official: boolean;
  tier: string;
  fields: string[];
}

/** Collapse per-field citations into one row per source. */
function dedupeSources(citations: MeasureCitationRef[]): FooterSource[] {
  const byName = new Map<string, FooterSource>();
  for (const c of citations) {
    const existing = byName.get(c.sourceName);
    if (existing) {
      if (!existing.fields.includes(c.field)) existing.fields.push(c.field);
    } else {
      byName.set(c.sourceName, {
        sourceName: c.sourceName,
        sourceUrl: c.sourceUrl,
        official: c.official,
        tier: c.tier,
        fields: [c.field],
      });
    }
  }
  return [...byName.values()].sort(
    (a, b) => Number(b.official) - Number(a.official),
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  badge: {
    backgroundColor: "#4A7CFF",
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 14,
  },
  badgeText: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 26,
    color: colors.white,
    marginBottom: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  aiNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(245, 200, 66, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.25)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  aiNoticeText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  section: { marginBottom: 24 },
  fiscalText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
  },
  stanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  stanceDot: { width: 10, height: 10, borderRadius: 5 },
  stanceLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.white,
  },
  stanceText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
  },
  argAttribution: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 8,
  },
  fullText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 22,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  sourceRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  sourceName: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  sourceMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
