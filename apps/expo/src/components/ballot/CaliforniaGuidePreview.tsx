import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader, Segmented } from "~/components/ui";
import {
  colors,
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { guideCandidateRoute } from "~/utils/candidate-explainer";
import { propositionDetailRoute } from "~/utils/proposition-explainers";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Candidate = Guide["candidates"][number];
type Measure = Guide["measures"][number];
type GuideTab = "candidates" | "measures";

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <Card style={s.card}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={[
          candidate.name,
          candidate.officeName ?? "statewide office",
          candidate.party,
        ]
          .filter(Boolean)
          .join(", ")}
        activeOpacity={0.8}
        onPress={() =>
          router.push(guideCandidateRoute(candidate.name, candidate.officeSlug))
        }
        style={s.cardHeader}
      >
        {candidate.photoUrl && !photoFailed ? (
          <Image
            source={{ uri: candidate.photoUrl }}
            style={s.portrait}
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <View style={s.portraitFallback}>
            <Icon name="user" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={s.cardIdentity}>
          <Text style={s.cardTitle}>{candidate.name}</Text>
          <Text style={s.cardMeta}>
            {candidate.officeName ?? "Statewide office"}
            {candidate.party ? ` · ${candidate.party}` : ""}
          </Text>
        </View>
        <Icon name="chevR" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </Card>
  );
}

function MeasureCard({ measure }: { measure: Measure }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={s.card}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Proposition ${measure.number}, ${measure.title}`}
        accessibilityState={{ expanded }}
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
        style={s.cardHeader}
      >
        <View style={s.measureNumber}>
          <Text style={s.measureNumberText}>{measure.number}</Text>
        </View>
        <View style={s.cardIdentity}>
          <Text style={[s.cardTitle, s.measureTitle]}>{measure.title}</Text>
        </View>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={s.cardBody}>
          {measure.officialSummary && (
            <Text style={s.statement}>{measure.officialSummary}</Text>
          )}
          {measure.fiscalImpact && (
            <View style={s.detailBlock}>
              <Text style={s.detailLabel}>Fiscal impact</Text>
              <Text style={s.detailText}>{measure.fiscalImpact}</Text>
            </View>
          )}
          <SourceLink
            label="Official proposition guide"
            url={measure.sourceUrl}
          />
        </View>
      )}
      {expanded && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Read Proposition ${measure.number} detail`}
          onPress={() => router.push(propositionDetailRoute(measure.number))}
          style={s.detailAction}
        >
          <Text style={s.detailActionText}>Open proposition detail</Text>
          <Icon name="arrowRight" size={17} color={colors.bill} />
        </TouchableOpacity>
      )}
    </Card>
  );
}

export function CaliforniaGuidePreview({
  onOpenBallot,
  onOpenFixtures,
  onBack,
}: {
  onOpenBallot?: () => void;
  onOpenFixtures?: () => void;
  onBack?: () => void;
}) {
  const guideScroll = useRef<ScrollView>(null);
  const router = useRouter();

  const [tab, setTab] = useState<GuideTab>("candidates");
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.isError ? undefined : query.data;
  return (
    <View style={{ flex: 1, backgroundColor: planes.navy }}>
      <NavHeader title="California guide" onBack={onBack} />
      <ScrollView
        ref={guideScroll}
        contentContainerStyle={s.screen}
        showsVerticalScrollIndicator={false}
      >
        {guide ? (
          <View style={s.intro}>
            <Text style={s.kicker}>
              {`${ballotElectionDate(guide.electionDate)} · GENERAL ELECTION`}
            </Text>
            <Text accessibilityRole="header" style={s.headline}>
              The statewide guide
            </Text>
          </View>
        ) : (
          <View style={s.intro}>
            <Text accessibilityRole="header" style={s.headline}>
              The statewide guide
            </Text>
            <Text style={[s.introText, { color: colors.white }]}>
              {query.isPending
                ? "Checking the statewide preview…"
                : query.isError
                  ? "The preview couldn’t load."
                  : "The preview isn’t available in Billion."}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(
            [
              { label: "Voting plan", icon: "vote", mode: "plan" },
              { label: "Notes", icon: "book", mode: "notes" },
              { label: "Voting help", icon: "info", mode: "help" },
            ] as const
          ).map((item) => (
            <TouchableOpacity
              key={item.mode}
              accessibilityRole="button"
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
              onPress={() =>
                router.push(
                  item.mode === "help"
                    ? "/election-access"
                    : {
                        pathname: "/guide-preparation",
                        params: { mode: item.mode },
                      },
                )
              }
            >
              <Icon name={item.icon} size={16} color={colors.bill} />
              <Text
                style={{
                  color: colors.bill,
                  fontFamily: fontBody.semibold,
                  fontSize: 12,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {query.isPending && <ActivityIndicator color={colors.bill} />}
        {query.isError && (
          <Card>
            <Text style={[s.introText, { color: P.inkOnNight }]}>
              The official guide could not load.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={s.retryButton}
              onPress={() => void query.refetch()}
            >
              <Text style={s.retry}>Try again</Text>
            </TouchableOpacity>
          </Card>
        )}
        {!query.isPending && !query.isError && !guide && (
          <Card>
            <Text style={[s.introText, { color: P.inkOnNight }]}>
              Guide data is unavailable to Billion. Check the official guide or
              your election office.
            </Text>
            <SourceLink
              label="Read the official guide"
              url="https://voterguide.sos.ca.gov/"
              prominence="primary"
            />
            <SourceLink
              label="Find your county elections office"
              url="https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
            />
          </Card>
        )}
        {!query.isPending && (query.isError || !guide) && (
          <View style={s.intro}>
            <SourceLink
              label="California official voter guide"
              prominence="primary"
              url="https://voterguide.sos.ca.gov/"
            />
            <SourceLink
              label="Find your county elections office"
              url="https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
            />
          </View>
        )}

        {guide && (
          <>
            <View style={s.scope}>
              <Icon name="info" size={16} color={colors.textSecondary} />
              <Text style={s.scopeText}>
                Statement submitters only · not your complete ballot.
              </Text>
            </View>
            <Segmented<GuideTab>
              value={tab}
              onChange={setTab}
              options={[
                {
                  id: "candidates",
                  label: `Statements ${guide.candidates.length}`,
                  icon: "vote",
                },
                {
                  id: "measures",
                  label: `Measures ${guide.measures.length}`,
                  icon: "scale",
                },
              ]}
            />
            {tab === "candidates" ? (
              <View style={s.list}>
                <Text accessibilityRole="header" style={s.sectionTitle}>
                  Candidate statements
                </Text>
                {guide.candidates.map((candidate) => (
                  <CandidateCard
                    key={`${candidate.officeSlug}:${candidate.name}`}
                    candidate={candidate}
                  />
                ))}
              </View>
            ) : (
              <View style={s.list}>
                <Text accessibilityRole="header" style={s.sectionTitle}>
                  Statewide propositions
                </Text>
                {guide.measures.map((measure) => (
                  <MeasureCard key={measure.number} measure={measure} />
                ))}
              </View>
            )}
            <View style={s.footer}>
              <SourceLink
                label="California official voter guide"
                url={guide.sourceUrl}
              />
              <Text style={s.caption}>
                Confirm local races and voting options with your county
                elections office.
              </Text>
              <SourceLink
                label="Check voting information with California"
                url="https://voterstatus.sos.ca.gov/EN/Authenticate"
                prominence="primary"
              />
              <SourceLink
                label="Find your county elections office"
                url="https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
              />
              {onOpenBallot && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={onOpenBallot}
                  style={s.addressAction}
                >
                  <Text style={s.addressActionText}>
                    Find my official ballot
                  </Text>
                  <Icon name="arrowRight" size={17} color={colors.bill} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
        {onOpenFixtures && (
          <TouchableOpacity onPress={onOpenFixtures}>
            <Text style={s.fixtureLink}>Development scenarios</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 160, gap: 18 },
  intro: { gap: 10 },
  kicker: { color: colors.bill, fontFamily: fontBody.semibold, fontSize: 12 },
  headline: {
    color: "#FFFFFF",
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 34,
  },
  introText: {
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  scope: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  scopeText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  list: { gap: 12 },
  caption: {
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    padding: 0,
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    padding: 14,
  },
  portrait: { width: 44, height: 44, borderRadius: 9 },
  portraitFallback: {
    width: 44,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.navy,
  },
  cardIdentity: { flex: 1, gap: 5 },
  cardTitle: {
    color: "#FFFFFF",
    fontFamily: fontBody.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  measureTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    lineHeight: 17,
  },
  cardBody: { gap: 16, paddingHorizontal: 18, paddingBottom: 18 },
  statement: {
    color: "#FFFFFF",
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  measureNumber: {
    width: 44,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.bill}28`,
  },
  measureNumberText: {
    color: colors.bill,
    fontFamily: fontBody.semibold,
    fontSize: 17,
  },
  detailBlock: { gap: 4 },
  detailLabel: { color: P.inkOnNight, fontFamily: fontBody.semibold },
  detailText: {
    color: "#FFFFFF",
    fontFamily: fontBody.regular,
    lineHeight: 21,
  },
  footer: { gap: 12, paddingBottom: 18 },
  retryButton: {
    minHeight: 48,
    padding: 12,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: P.inkOnNight,
    alignItems: "center",
    justifyContent: "center",
  },
  retry: { color: P.canvas, fontFamily: fontBody.semibold, fontSize: 16 },

  fixtureLink: { color: colors.textSecondary, paddingVertical: 16 },
  addressAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  addressActionText: { color: colors.bill, fontFamily: fontBody.semibold },
  detailAction: {
    minHeight: 48,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: hair[1],
  },
  detailActionText: {
    color: P.inkOnNight,
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    fontSize: 12,
  },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    color: colors.white,
  },
});
