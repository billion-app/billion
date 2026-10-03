import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { guideCandidateRoute } from "~/utils/candidate-explainer";
import { propositionDetailRoute } from "~/utils/proposition-explainers";
import { OfficialResourceLink as SourceLink } from "./OfficialResourceLink";

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
          <Text style={s.cardMeta}>Statewide proposition</Text>
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
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Read Proposition ${measure.number} detail`}
        onPress={() => router.push(propositionDetailRoute(measure.number))}
        style={s.detailAction}
      >
        <Text style={s.detailActionText}>Read proposition detail</Text>
        <Icon name="arrowRight" size={17} color={P.inkOnNight} />
      </TouchableOpacity>
    </Card>
  );
}

export function CaliforniaGuidePreview({
  onOpenBallot,
  onOpenFixtures,
}: {
  onOpenBallot?: () => void;
  onOpenFixtures?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<GuideTab>("candidates");
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.data;
  return (
    <TabScreen
      headerExtra={
        <Text style={s.jurisdiction}>
          {guide
            ? `California ${guide.electionDate.slice(0, 4)}`
            : "California"}
        </Text>
      }
      contentStyle={s.screen}
    >
      <View style={s.intro}>
        <Text style={s.kicker}>
          {guide
            ? `${ballotElectionDate(guide.electionDate)} · GENERAL ELECTION`
            : "OFFICIAL VOTER GUIDE"}
        </Text>
        <Text accessibilityRole="header" style={s.headline}>
          The statewide guide
        </Text>
        <Text style={s.introText}>
          Official candidate statements and propositions, directly from
          California's voter guide.
        </Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="California language and accessible voting resources"
        accessibilityHint="Opens official resources and coverage limits"
        style={s.addressAction}
        onPress={() => router.push("/election-access")}
      >
        <Text style={[s.addressActionText, { flex: 1 }]}>
          Language and accessible voting resources
        </Text>
        <Icon name="arrowRight" size={17} color={P.inkOnNight} />
      </TouchableOpacity>
      {query.isPending && <ActivityIndicator color={P.inkOnNight} />}
      {query.isError && (
        <Card style={s.recovery}>
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
        <Card style={s.recovery}>
          <Text style={[s.introText, { color: P.inkOnNight }]}>
            The official guide is being refreshed. Check back soon.
          </Text>
        </Card>
      )}
      {guide && (
        <>
          <View style={s.scope}>
            <Icon name="info" size={16} color={colors.textSecondary} />
            <Text style={s.scopeText}>
              Statewide preview, not your address-specific ballot. Local races
              and measures are not shown.
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
              <Kicker>Candidate statements</Kicker>
              <Text style={s.caption}>
                Only candidates who submitted a statement appear here. This is
                not a complete candidate list.
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
              <Kicker>Statewide propositions</Kicker>
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
              Billion's address-specific ballot lookup is unavailable. Your
              county voter guide contains your sample ballot.
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
                <Text style={s.addressActionText}>Test ballot lookup</Text>
                <Icon name="arrowRight" size={17} color={P.inkOnNight} />
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
    </TabScreen>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 20, gap: 18 },
  jurisdiction: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
    textAlign: "center",
    paddingVertical: 10,
  },
  intro: { paddingTop: 16, gap: 9 },
  kicker: { color: colors.bill, fontFamily: fontBody.semibold, fontSize: 12 },
  headline: {
    color: "#FFFFFF",
    fontFamily: fontEditorial.bold,
    fontSize: 26,
    lineHeight: 31,
  },
  introText: {
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
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
    backgroundColor: planes.slate,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 76,
    padding: 14,
  },
  portrait: { width: 62, height: 62, borderRadius: 4 },
  portraitFallback: {
    width: 62,
    minHeight: 62,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.navy,
  },
  cardIdentity: { flex: 1, gap: 5 },
  cardTitle: {
    color: "#FFFFFF",
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  measureTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  cardMeta: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 13,
  },
  cardBody: { gap: 16, paddingHorizontal: 18, paddingBottom: 18 },
  statement: {
    color: "#FFFFFF",
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  measureNumber: {
    width: 62,
    minHeight: 62,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.surface,
  },
  measureNumberText: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 20,
  },
  detailBlock: { gap: 4 },
  detailLabel: { color: P.inkOnNight, fontFamily: fontBody.semibold },
  detailText: {
    color: "#FFFFFF",
    fontFamily: fontBody.regular,
    lineHeight: 21,
  },
  footer: { gap: 12, paddingBottom: 18 },
  recovery: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
    padding: 16,
  },
  retryButton: {
    minHeight: 48,
    marginTop: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 10,
  },
  retry: { color: P.inkOnNight, fontFamily: fontBody.semibold },
  fixtureLink: { color: colors.textSecondary, paddingVertical: 16 },
  addressAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  addressActionText: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  detailAction: {
    minHeight: 48,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.textSecondary,
  },
  detailActionText: {
    color: P.inkOnNight,
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    fontSize: 15,
  },
});
