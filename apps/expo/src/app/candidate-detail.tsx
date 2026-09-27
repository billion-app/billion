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
import { fontBody, fontDisplay, DigestPalette as P, planes } from "~/styles";
import { trpc } from "~/utils/api";
import {
  canMatchCaliforniaGuide,
  checkedCandidateRecord,
  ELECTION_DATE,
  findGuideCandidate,
  officeContext,
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
    query.data &&
    query.data.electionDate === ELECTION_DATE &&
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
        photoUrl: fromBallot.photoUrl || guide?.photoUrl,
      }
    : guide;
  const statementCitation = fromBallot?.citations?.find(
    (item) => item.field === "statement",
  );
  const usingGuideStatement = !!guide && !fromBallot?.statement?.trim();
  const sourceUrl = usingGuideStatement
    ? guide.sourceUrl
    : statementCitation?.sourceUrl;
  const date = guide ? query.data?.electionDate : params.electionDate;
  const context = guide && office ? officeContext[office] : undefined;
  const record =
    guide && office && date
      ? checkedCandidateRecord(guide.name, office, date)
      : undefined;
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
                  ? "CALIFORNIA · 2026 GENERAL ELECTION"
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
                    <Icon name="user" size={32} color={P.quiet} />
                  </View>
                )}
                <View style={s.identityText}>
                  <Text accessibilityRole="header" style={s.name}>
                    {candidate.name}
                  </Text>
                  <Text style={s.office}>
                    {context?.name ?? params.office ?? "Office unavailable"}
                  </Text>
                </View>
              </View>
              <View style={s.pills}>
                <Text style={s.pill}>
                  {fromBallot
                    ? params.district || "District unavailable"
                    : "Statewide"}
                </Text>
                <Text style={s.pill}>
                  {candidate.party || "Party not provided"}
                </Text>
              </View>
              <Text style={s.muted}>
                {fromBallot?.ballotStatus === "withdrewStillOnBallot"
                  ? "Withdrawn; name remains on the ballot"
                  : fromBallot?.ballotStatus === "onBallot"
                    ? "Listed on your ballot"
                    : guide
                      ? "Statement guide entry · verify ballot status with your election office"
                      : "Ballot status unavailable"}
              </Text>
              {candidate.photoUrl && portraitSource ? (
                <SourceLink
                  label={
                    fromBallot?.photoUrl
                      ? "Portrait source: ballot provider"
                      : "Portrait source: California official voter guide"
                  }
                  url={portraitSource}
                />
              ) : null}
            </View>

            <Card style={s.lead}>
              <Text style={s.cardEyebrow}>THE SHORT VERSION</Text>
              <Text style={s.leadText}>
                {context?.description ??
                  "The office's responsibilities have not been checked for this race."}
              </Text>
              <Text style={s.leadNote}>
                This describes the office. It does not evaluate the candidate.
              </Text>
            </Card>
            {context && guide ? (
              <SourceLink
                label="Office duties · California official voter guide"
                url={guide.sourceUrl}
              />
            ) : null}

            {record && guide ? (
              <Card style={s.panel}>
                <Text style={s.panelLabel}>WHAT THIS CANDIDATE SAYS</Text>
                <Text style={s.body}>{record.says}</Text>
                <SourceLink
                  label="Source: candidate-supplied statement"
                  url={guide.sourceUrl}
                />
              </Card>
            ) : null}

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

            <View style={s.section}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                What records establish
              </Text>
              {record ? (
                <Card style={s.panel}>
                  <Text style={s.body}>{record.text}</Text>
                  <SourceLink
                    label={record.sourceName}
                    url={record.sourceUrl}
                  />
                  <Text style={s.muted}>Record checked {record.checkedAt}</Text>
                </Card>
              ) : (
                <Card style={s.panel}>
                  <Text style={s.body}>
                    Billion has not reviewed an independent record for this
                    candidate. Their statement is a claim, not a verified
                    record.
                  </Text>
                </Card>
              )}
            </View>

            <View style={s.section}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                Billion analysis
              </Text>
              <Card style={s.panel}>
                <Text style={s.body}>
                  No candidate-specific analysis has passed editorial review
                  yet. We will add it only with claim-level sources and a
                  correction path.
                </Text>
              </Card>
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
    paddingTop: 20,
    paddingBottom: 64,
    gap: 26,
  },
  hero: { gap: 18 },
  eyebrow: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 16 },
  portrait: { width: 86, height: 100, borderRadius: 10 },
  portraitFallback: {
    width: 86,
    height: 100,
    borderRadius: 10,
    backgroundColor: P.card,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 8 },
  name: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 29,
    lineHeight: 34,
  },
  office: { color: P.spark, fontFamily: fontBody.semibold, fontSize: 15 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    color: P.inkOnNight,
    backgroundColor: P.card,
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontFamily: fontBody.medium,
    fontSize: 12,
  },
  muted: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  lead: { backgroundColor: planes.paper, gap: 12, padding: 20 },
  cardEyebrow: {
    color: P.ink,
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  leadText: {
    color: P.ink,
    fontFamily: fontDisplay.regular,
    fontSize: 20,
    lineHeight: 28,
  },
  leadNote: {
    color: P.ink,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  section: { gap: 10 },
  sectionTitle: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 24,
  },
  sectionIntro: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  panel: { padding: 20, gap: 12 },
  panelLabel: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  statementPreview: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  action: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  actionText: { color: P.primary, fontFamily: fontBody.semibold, fontSize: 14 },
  heading: { color: P.inkOnNight, fontFamily: fontDisplay.bold, fontSize: 22 },
  body: {
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  footer: { gap: 12, paddingTop: 8 },
  footerTitle: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 20,
  },
});
