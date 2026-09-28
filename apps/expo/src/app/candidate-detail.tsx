import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { webUrl } from "~/components/ballot-evidence/model";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { trpc } from "~/utils/api";
import {
  canMatchCaliforniaGuide,
  ELECTION_DATE,
  findGuideCandidate,
  parseBallotCandidate,
  statewideOfficeSlug,
} from "~/utils/candidate-explainer";

export default function CandidateDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    office?: string;
    state?: string;
    electionDate?: string;
    district?: string;
    districtId?: string;
    candidate?: string;
  }>();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showOverviewSources, setShowOverviewSources] = useState(false);
  const fromBallot = parseBallotCandidate(params.candidate, params.name);
  const office = params.office ? statewideOfficeSlug(params.office) : undefined;
  const lookupGuide =
    !!fromBallot &&
    !!office &&
    canMatchCaliforniaGuide(
      params.state,
      params.electionDate,
      params.districtId,
    );
  const query = useQuery({
    ...trpc.civic.getCaliforniaGuide.queryOptions(),
    enabled: !fromBallot || lookupGuide,
  });
  const guide =
    (!fromBallot || lookupGuide) &&
    query.data?.electionDate === ELECTION_DATE &&
    office &&
    params.name
      ? findGuideCandidate(query.data.candidates, params.name, office)
      : undefined;
  const candidate = fromBallot
    ? {
        ...guide,
        ...fromBallot,
        statement: fromBallot.statement?.trim()
          ? fromBallot.statement
          : guide?.statement,
        party: fromBallot.party ?? guide?.party,
        photoUrl: fromBallot.photoUrl ?? guide?.photoUrl,
      }
    : guide;
  const statementCitation = fromBallot?.citations?.find(
    (item) => item.field === "statement",
  );
  const usingGuideStatement = !!guide && !fromBallot?.statement?.trim();
  const sourceUrl = usingGuideStatement
    ? guide.sourceUrl
    : statementCitation?.sourceUrl;
  const fetchedAt = usingGuideStatement
    ? query.data?.fetchedAt
    : statementCitation?.fetchedAt;
  const portraitSource = fromBallot?.photoUrl
    ? fromBallot.citations?.find((item) => item.field === "photoUrl")?.sourceUrl
    : guide?.photoUrl
      ? guide.sourceUrl
      : undefined;

  return (
    <View style={s.screen}>
      <NavHeader title="Candidate" tone="dark" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {!fromBallot && query.isPending ? (
          <ActivityIndicator color={P.spark} />
        ) : null}
        {!fromBallot && query.isError ? (
          <Card style={s.panel}>
            <Text style={s.body}>Candidate details could not load.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void query.refetch()}
              style={s.action}
            >
              <Text style={s.actionText}>Try again</Text>
            </TouchableOpacity>
          </Card>
        ) : null}
        {!query.isPending && !query.isError && !candidate ? (
          <Card style={s.panel}>
            <Text style={s.heading}>Candidate unavailable</Text>
            <Text style={s.body}>
              This person is not in the current official statement guide. Return
              to the guide to choose a candidate.
            </Text>
          </Card>
        ) : null}
        {candidate ? (
          <>
            <View style={s.hero}>
              <Text style={s.eyebrow}>
                {guide
                  ? `CALIFORNIA · ${query.data?.electionDate}`
                  : "BALLOT CONTEST"}
              </Text>
              <View style={s.identity}>
                {webUrl(candidate.photoUrl) && !photoFailed ? (
                  <Image
                    source={{ uri: candidate.photoUrl }}
                    style={s.portrait}
                    onError={() => setPhotoFailed(true)}
                    accessibilityLabel={`Portrait of ${candidate.name}`}
                  />
                ) : (
                  <View style={s.portraitFallback}>
                    <Icon name="user" size={24} color={P.quiet} />
                  </View>
                )}
                <View style={s.identityText}>
                  <Text accessibilityRole="header" style={s.name}>
                    {candidate.name}
                  </Text>
                  <Text style={s.office}>
                    {guide?.officeName ?? params.office ?? "Office unavailable"}
                  </Text>
                </View>
              </View>
              <Text style={s.heroMeta}>
                {fromBallot
                  ? params.district?.trim()
                    ? params.district.trim()
                    : "District unavailable"
                  : "Statewide"}
                {candidate.party ? ` · ${candidate.party}` : ""}
              </Text>
              <View style={s.statusRow}>
                <Icon name="info" size={14} color={P.quiet} />
                <Text style={[s.muted, s.rowText]}>
                  {fromBallot?.ballotStatus === "withdrewStillOnBallot"
                    ? "Withdrawn; name remains on the ballot"
                    : fromBallot?.ballotStatus === "onBallot"
                      ? "Listed on your ballot"
                      : guide
                        ? "Statement guide entry · verify ballot status with your election office"
                        : "Ballot status unavailable"}
                </Text>
              </View>
            </View>

            <Card style={s.overview}>
              <Text accessibilityRole="header" style={s.cardTitle}>
                At a glance
              </Text>
              <View style={s.fact}>
                <Text style={s.panelLabel}>THE OFFICE</Text>
                <Text style={s.body}>
                  {guide?.officeDuties?.length
                    ? guide.officeDuties.join(" ")
                    : "Office duties are not available in Billion. Open the official guide for this office."}
                </Text>
              </View>
              <View style={s.fact}>
                <Text style={s.panelLabel}>CANDIDATE'S STATED PRIORITIES</Text>
                <Text style={s.body}>
                  {candidate.statement
                    ? "Read the candidate's own statement below. Billion has not independently checked its claims."
                    : "No candidate statement is available to Billion."}
                </Text>
              </View>
              <View style={s.fact}>
                <Text style={s.panelLabel}>CHECKED PUBLIC RECORD</Text>
                <Text style={s.body}>
                  Billion has not reviewed an independent record for this
                  candidate.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: showOverviewSources }}
                onPress={() => setShowOverviewSources((value) => !value)}
                style={s.sourceToggle}
              >
                <Icon name="shield" size={15} color={P.primary} />
                <Text style={s.sourceToggleText}>
                  Sources for this overview
                </Text>
                <Icon
                  name={showOverviewSources ? "chevD" : "chevR"}
                  size={15}
                  color={P.primary}
                />
              </TouchableOpacity>
              {showOverviewSources ? (
                <View style={s.sourceList}>
                  {guide?.officeDuties?.length ? (
                    <SourceLink
                      label="Office duties · California voter guide"
                      url={guide.sourceUrl}
                    />
                  ) : null}
                  {sourceUrl ? (
                    <SourceLink label="Candidate statement" url={sourceUrl} />
                  ) : null}
                  {candidate.photoUrl && portraitSource ? (
                    <SourceLink
                      label={
                        fromBallot?.photoUrl
                          ? "Portrait · ballot provider"
                          : "Portrait · California voter guide"
                      }
                      url={portraitSource}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>

            <View style={s.analysisNote}>
              <Icon name="info" size={17} color={P.quiet} />
              <Text style={s.analysisText}>
                Billion candidate analysis is not available yet. It will appear
                only after editorial review and claim-level source checks.
              </Text>
            </View>

            <View style={s.section}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                What they say
              </Text>
              <Text style={s.sectionIntro}>
                {usingGuideStatement
                  ? "This statement was supplied by the candidate. California does not check these claims for accuracy."
                  : "This statement was supplied by a ballot provider. Its claims have not been independently checked by Billion."}
              </Text>
              {candidate.statement ? (
                <Card style={s.panel}>
                  <Text style={s.panelLabel}>CANDIDATE'S OWN WORDS</Text>
                  {!showStatement ? (
                    <Text style={s.statementPreview} numberOfLines={3}>
                      {candidate.statement}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showStatement }}
                    onPress={() => setShowStatement((value) => !value)}
                    style={s.action}
                  >
                    <Text style={s.actionText}>
                      {showStatement
                        ? "Hide full statement"
                        : "Read full statement"}
                    </Text>
                    <Icon
                      name={showStatement ? "chevD" : "chevR"}
                      size={16}
                      color={P.primary}
                    />
                  </TouchableOpacity>
                  {showStatement ? (
                    <Text selectable style={s.body}>
                      {candidate.statement}
                    </Text>
                  ) : null}
                  {sourceUrl ? (
                    <SourceLink
                      label={
                        usingGuideStatement
                          ? "Original statement · California voter guide"
                          : `Original statement · ${statementCitation?.sourceName ?? "source"}`
                      }
                      url={sourceUrl}
                    />
                  ) : (
                    <Text style={s.muted}>
                      Statement source link unavailable
                    </Text>
                  )}
                </Card>
              ) : (
                <Card style={s.panel}>
                  <Text style={s.body}>
                    No candidate statement is available to Billion for this
                    person.
                  </Text>
                </Card>
              )}
            </View>

            <View style={s.footer}>
              <Text accessibilityRole="header" style={s.footerTitle}>
                Sources & freshness
              </Text>
              {sourceUrl ? (
                <SourceLink
                  label={
                    usingGuideStatement
                      ? "Candidate statement · official guide"
                      : `Candidate statement · ${statementCitation?.sourceName ?? "ballot provider"}`
                  }
                  url={sourceUrl}
                />
              ) : null}
              {guide ? (
                <SourceLink
                  label="About candidate statements"
                  url="https://voterguide.sos.ca.gov/voter-info/info-about-candidate-statements.htm"
                />
              ) : null}
              {fetchedAt ? (
                <Text style={s.muted}>
                  {usingGuideStatement ? "Guide" : "Statement"} retrieved{" "}
                  {new Date(fetchedAt).toLocaleDateString()}
                </Text>
              ) : (
                <Text style={s.muted}>Retrieval date unavailable</Text>
              )}
              <Text style={s.muted}>
                {guide
                  ? "The guide includes only people who submitted statements. It is not a complete roster. Check your county ballot for eligibility, write-in, or withdrawal updates."
                  : "Check your election office for eligibility, write-in, or withdrawal updates."}
              </Text>
              <SourceLink
                label="Find your county elections office"
                url={
                  guide
                    ? "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
                    : "https://www.usa.gov/state-election-office"
                }
              />
              <SourceLink
                label="Report a correction to Billion"
                url="https://billion-news.app/support"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 64,
    gap: 14,
  },
  hero: { gap: 9 },
  eyebrow: {
    color: P.quiet,
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  portrait: { width: 64, height: 70, borderRadius: 10 },
  portraitFallback: {
    width: 64,
    height: 70,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 3 },
  name: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 25,
    lineHeight: 29,
  },
  office: { color: P.inkOnNight, fontFamily: fontEditorial.bold, fontSize: 16 },
  heroMeta: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 12 },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  muted: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  overview: { gap: 0, padding: 16 },
  cardTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 4,
  },
  fact: {
    gap: 5,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hair[2],
  },
  sourceToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceToggleText: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 14,
  },
  rowText: { flex: 1, flexShrink: 1 },
  sourceList: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[2],
  },
  analysisNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    backgroundColor: planes.slate,
    borderColor: hair[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  analysisText: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  section: { gap: 10, paddingTop: 8 },
  sectionTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 19,
  },
  sectionIntro: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  panel: { padding: 16, gap: 10 },
  panelLabel: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 10,
    letterSpacing: 1,
  },
  statementPreview: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  action: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  actionText: {
    flexShrink: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 14,
  },
  heading: { color: P.inkOnNight, fontFamily: fontDisplay.bold, fontSize: 22 },
  body: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  footer: { gap: 10, paddingTop: 8 },
  footerTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 18,
  },
});
