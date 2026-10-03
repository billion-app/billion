import type { ScrollView } from "react-native";
import { useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Image,
  Text as NativeText,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import { VotingPlanSection } from "~/components/voting-plan/VotingPlanSection";
import { colors, fontBody, fontDisplay, planes } from "~/styles";
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
        accessibilityLabel={`${candidate.name}, ${candidate.officeName ?? "statewide office"}`}
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
          <Text
            style={[s.cardTitle, s.measureTitle]}
            numberOfLines={expanded ? undefined : 3}
          >
            {measure.title}
          </Text>
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
        <Icon name="arrowRight" size={17} color={colors.bill} />
      </TouchableOpacity>
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
  const guideHeading = useRef<NativeText>(null);
  const returnToGuide = () => {
    requestAnimationFrame(() => {
      guideScroll.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === "web") guideHeading.current?.focus();
      else {
        const handle = findNodeHandle(guideHeading.current);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }
    });
  };
  const [tab, setTab] = useState<GuideTab>("candidates");
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.isError ? undefined : query.data;
  return (
    <TabScreen
      title={
        guide ? `California ${guide.electionDate.slice(0, 4)}` : "California"
      }
      action={
        onBack ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to Elections"
            onPress={onBack}
            style={{
              minHeight: 48,
              minWidth: 48,
              padding: 12,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fontBody.semibold,
                fontSize: 16,
                color: colors.white,
              }}
            >
              Back
            </Text>
          </TouchableOpacity>
        ) : undefined
      }
      contentStyle={s.screen}
      scrollRef={guideScroll}
    >
      {guide ? (
        <View style={s.intro}>
          <Text style={s.kicker}>
            {`${ballotElectionDate(guide.electionDate)} · GENERAL ELECTION`}
          </Text>
          <NativeText ref={guideHeading} tabIndex={-1} accessible accessibilityRole="header" style={s.headline}>The statewide guide</NativeText>
          <Text style={s.introText}>
            Official candidate statements and propositions, directly from
            California's voter guide.
          </Text>
        </View>
      ) : (
        <View style={s.intro}>
          <NativeText ref={guideHeading} tabIndex={-1} accessible accessibilityRole="header" style={s.headline}>The statewide guide</NativeText>
          <Text style={[s.introText, { color: colors.white }]}>
            {query.isPending
              ? "Checking the statewide preview…"
              : query.isError
                ? "The preview couldn’t load."
                : "The preview isn’t available in Billion."}
          </Text>
        </View>
      )}


      {query.isPending && <ActivityIndicator color={colors.bill} />}
      {!query.isPending && !guide && (
        <Card style={{ gap: 16 }}>
          <Text style={[s.introText, { color: colors.white, marginTop: 0 }]}>
            Read California’s candidate statements and propositions on the
            official guide website.
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
          {query.isError && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void query.refetch()}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={s.retry}>Try again</Text>
            </TouchableOpacity>
          )}
        </Card>
      )}
      <VotingPlanSection
        california
        returnLabel="Return to statewide guide"
        onReturn={returnToGuide}
        election={
          guide
            ? {
                id: `ca-guide:${guide.electionDate}`,
                name: `California statewide election · ${ballotElectionDate(guide.electionDate)}`,
                electionDay: guide.electionDate,
                ocdDivisionId: "ocd-division/country:us/state:ca",
              }
            : undefined
        }
      />
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
              Confirm local races and voting options with your county elections
              office.
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
                <Text style={s.addressActionText}>Find my official ballot</Text>
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
    </TabScreen>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 20, gap: 22 },
  intro: { paddingTop: 20, gap: 12 },
  kicker: { color: colors.bill, fontFamily: fontBody.semibold, fontSize: 12 },
  headline: {
    color: "#FFFFFF",
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 36,
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
  card: { padding: 0, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 90,
    padding: 14,
  },
  portrait: { width: 62, height: 62, borderRadius: 4 },
  portraitFallback: {
    width: 62,
    height: 62,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: planes.navy,
  },
  cardIdentity: { flex: 1, gap: 5 },
  cardTitle: {
    color: "#FFFFFF",
    fontFamily: fontDisplay.bold,
    fontSize: 19,
    lineHeight: 24,
  },
  measureTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  cardMeta: {
    color: colors.textSecondary,
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
    height: 62,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bill,
  },
  measureNumberText: {
    color: planes.navy,
    fontFamily: fontDisplay.bold,
    fontSize: 24,
  },
  detailBlock: { gap: 4 },
  detailLabel: { color: colors.textSecondary, fontFamily: fontBody.semibold },
  detailText: {
    color: "#FFFFFF",
    fontFamily: fontBody.regular,
    lineHeight: 21,
  },
  footer: { gap: 12, paddingBottom: 18 },
  retry: { color: colors.bill, fontFamily: fontBody.semibold, marginTop: 14 },
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
    borderTopColor: colors.textSecondary,
  },
  detailActionText: {
    color: colors.bill,
    fontFamily: fontBody.semibold,
    fontSize: 15,
  },
});
