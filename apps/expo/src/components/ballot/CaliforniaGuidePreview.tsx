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
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import { colors, fontBody, fontDisplay, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { guideCandidateRoute } from "~/utils/candidate-explainer";
import { propositionDetailRoute } from "~/utils/proposition-explainers";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Candidate = Guide["candidates"][number];
type Measure = Guide["measures"][number];
type GuideTab = "candidates" | "measures";

const offices: Record<Candidate["officeSlug"], string> = {
  governor: "Governor",
  "lt-governor": "Lieutenant Governor",
  sos: "Secretary of State",
  controller: "Controller",
  treasurer: "Treasurer",
  "attorney-general": "Attorney General",
  "insurance-commissioner": "Insurance Commissioner",
  superintendent: "Superintendent of Public Instruction",
};

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <Card style={s.card}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${candidate.name}, ${offices[candidate.officeSlug]}`}
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
            {offices[candidate.officeSlug]}
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
}: {
  onOpenBallot?: () => void;
  onOpenFixtures?: () => void;
}) {
  const [tab, setTab] = useState<GuideTab>("candidates");
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.data;
  return (
    <TabScreen title="California 2026" contentStyle={s.screen}>
      <View style={s.intro}>
        <Text style={s.kicker}>NOVEMBER 3 · GENERAL ELECTION</Text>
        <Text style={s.headline}>The statewide guide</Text>
        <Text style={s.introText}>
          Official candidate statements and propositions, directly from
          California's voter guide.
        </Text>
      </View>

      {query.isPending && <ActivityIndicator color={colors.bill} />}
      {query.isError && (
        <Card>
          <Text style={s.introText}>The official guide could not load.</Text>
          <TouchableOpacity onPress={() => void query.refetch()}>
            <Text style={s.retry}>Try again</Text>
          </TouchableOpacity>
        </Card>
      )}
      {!query.isPending && !query.isError && !guide && (
        <Card>
          <Text style={s.introText}>
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
