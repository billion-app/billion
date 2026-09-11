import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { MeasureArgumentRef, MeasureCitationRef } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, NavHeader, PrimaryButton } from "~/components/ui";
import {
  colors,
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette as P,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { MeasureBalance, SectionFlourish } from "~/components/digest/CraftMarks";
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

const cardChrome = {
  backgroundColor: P.card,
  borderRadius: DigestRadii.card,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: DigestHair.cardBorder,
} as const;

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
      <NavHeader title="Ballot Measure" tone="dark" onBack={() => router.back()} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroMarkRow}>
          <MeasureBalance width={36} />
          <Text style={s.measureKicker}>Ballot measure</Text>
        </View>

        <Text style={s.title}>{params.referendumTitle}</Text>
        <View style={s.flourishWrap}>
          <SectionFlourish width={88} />
        </View>

        {params.summaryLong || params.summary || params.referendumSubtitle ? (
          <>
            <Text style={s.subtitle}>
              {params.summaryLong ||
                params.summary ||
                params.referendumSubtitle}
            </Text>
            {summaryIsAi && (
              <View style={s.aiNotice}>
                <Icon name="sparkle" size={13} color={P.spark} />
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
            <Kicker style={s.kicker}>Fiscal impact</Kicker>
            <Card style={cardChrome}>
              <Text style={s.fiscalText}>{params.fiscalImpact}</Text>
            </Card>
          </View>
        ) : null}

        {/* Yes / No arguments — one card per side, arguments as bullets. */}
        {(pros.length > 0 || cons.length > 0) && (
          <View style={s.section}>
            <Kicker style={s.kicker}>A YES vote vs. a NO vote</Kicker>
            <View style={{ gap: 12 }}>
              {pros.length > 0 && (
                <StanceCard
                  label="A YES vote means"
                  color={colors.green[500]}
                  args={pros}
                />
              )}
              {cons.length > 0 && (
                <StanceCard
                  label="A NO vote means"
                  color={colors.red[500]}
                  args={cons}
                />
              )}
            </View>
          </View>
        )}

        {/* Full referendum text */}
        {params.referendumText ? (
          <View style={s.section}>
            <Kicker style={s.kicker}>Full text</Kicker>
            <Card style={cardChrome}>
              <Text style={s.fullText}>{params.referendumText}</Text>
            </Card>
          </View>
        ) : null}

        {/* Sources / citations — every source points back to its original. */}
        {sources.length > 0 && (
          <View style={s.section}>
            <Kicker style={s.kicker}>Sources</Kicker>
            <Card style={cardChrome}>
              {sources.map((src, i) => {
                const url = src.sourceUrl;
                const open = url ? () => void Linking.openURL(url) : undefined;
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
                      color={src.official ? P.badgeTeal : P.quiet}
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
                      <Icon name="external" size={14} color={P.quiet} />
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

/** One stance card (YES or NO) listing all of that side's arguments as bullets. */
function StanceCard({
  label,
  color,
  args,
}: {
  label: string;
  color: string;
  args: MeasureArgumentRef[];
}) {
  // Attribute once per card from the distinct sources of its arguments.
  const attribution = [
    ...new Set(
      args.map((a) => a.author ?? a.sourceName).filter((x): x is string => !!x),
    ),
  ].join(", ");
  return (
    <Card style={[cardChrome, s.stanceCard, { borderLeftColor: color }]}>
      <View style={s.stanceHeader}>
        <Text style={s.stanceLabel}>{label}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {args.map((arg, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={[s.bulletDot, { color }]}>•</Text>
            <Text style={s.stanceText}>{arg.text}</Text>
          </View>
        ))}
      </View>
      {attribution ? (
        <Text style={s.argAttribution}>— {attribution}</Text>
      ) : null}
    </Card>
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
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: DigestSpace.coverPadX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  kicker: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroMarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  measureKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
  },
  flourishWrap: { marginBottom: 16, alignItems: "flex-start" },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    color: P.inkOnNight,
    marginBottom: 8,
    lineHeight: 34,
    letterSpacing: -0.55,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: P.quiet,
    lineHeight: 22,
    marginBottom: 8,
  },
  aiNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: DigestHair.tabActivePill,
    borderWidth: 1,
    borderColor: DigestHair.coverBorder,
    borderRadius: DigestRadii.menu,
    padding: 12,
    marginBottom: 16,
  },
  aiNoticeText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: P.quiet,
    lineHeight: 18,
  },
  section: { marginBottom: 28 },
  fiscalText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: P.inkOnNight,
    lineHeight: 22,
  },
  stanceCard: {
    borderLeftWidth: 3,
    paddingVertical: 4,
  },
  stanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  stanceLabel: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: P.inkOnNight,
  },
  stanceText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: P.inkOnNight,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    fontSize: 15,
    lineHeight: 22,
  },
  argAttribution: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: P.quiet,
    marginTop: 8,
  },
  fullText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: P.inkOnNight,
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
    borderTopColor: DigestHair.cardBorder,
  },
  sourceName: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: P.inkOnNight,
  },
  sourceMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: P.quiet,
    marginTop: 2,
  },
});
