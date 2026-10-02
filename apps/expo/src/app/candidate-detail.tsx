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

import {
  BallotDisclosure,
  BallotProvenanceRows,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { candidateStatusLabel } from "~/components/ballot-evidence/election-status";
import { webUrl } from "~/components/ballot-evidence/model";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import {
  canMatchCaliforniaGuide,
  ELECTION_DATE,
  findGuideCandidate,
  parseBallotCandidate,
  statewideOfficeSlug,
} from "~/utils/candidate-explainer";
import { candidateStatementExcerpt } from "~/utils/candidate-statement";

export default function CandidateDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    office?: string;
    state?: string;
    electionDate?: string;
    electionStage?: string;
    ballotSourceName?: string;
    ballotSourceUrl?: string;
    ballotFetchedAt?: string;
    district?: string;
    districtId?: string;
    candidate?: string;
  }>();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showOfficeDuties, setShowOfficeDuties] = useState(false);
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

  const excerpt = candidateStatementExcerpt(candidate?.statement ?? "");

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
                {fromBallot
                  ? `${params.state?.trim() ? params.state.trim() : "State unavailable"} · ${params.electionDate ? ballotElectionDate(params.electionDate) : "Election date unavailable"} · ${params.electionStage?.trim() ? params.electionStage.trim() : "Stage unavailable"}`
                  : guide && query.data
                    ? `CALIFORNIA · ${ballotElectionDate(query.data.electionDate)}`
                    : "Election context unavailable"}
              </Text>
              <View style={s.identity}>
                {webUrl(candidate.photoUrl) && !photoFailed ? (
                  <Image
                    source={{ uri: candidate.photoUrl }}
                    style={s.portrait}
                    onError={() => setPhotoFailed(true)}
                    accessibilityLabel={`Portrait of ${candidate.name}`}
                  />
                ) : null}
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
                {[
                  fromBallot
                    ? params.district?.trim()
                      ? params.office?.includes(params.district.trim())
                        ? undefined
                        : params.district.trim()
                      : "District unavailable"
                    : "Statewide",
                  candidate.party,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <View style={s.statusRow}>
                <Icon name="info" size={14} color={P.quiet} />
                <Text style={[s.ballotStatus, s.rowText]}>
                  {fromBallot?.ballotStatus === "withdrewStillOnBallot"
                    ? "Withdrawn"
                    : candidateStatusLabel(fromBallot?.ballotStatus, !!guide)}
                </Text>
              </View>
              {fromBallot?.ballotStatus === "withdrewStillOnBallot" && (
                <Text style={s.body}>
                  The ballot source still lists this name.
                </Text>
              )}
              {fromBallot && (
                <Text style={s.muted}>
                  Confirm whether this race is on your ballot with your election
                  office.
                </Text>
              )}
            </View>

            {!!guide?.officeDuties?.length && (
              <View style={s.section}>
                <Text accessibilityRole="header" style={s.sectionTitle}>
                  What this office does
                </Text>

                <>
                  <Text style={s.body}>{guide.officeDuties[0]}</Text>
                  {guide.officeDuties.length > 1 && (
                    <>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showOfficeDuties }}
                        onPress={() => setShowOfficeDuties((value) => !value)}
                        style={s.action}
                      >
                        <Text style={s.actionText}>
                          {showOfficeDuties
                            ? "Hide other responsibilities"
                            : "Other responsibilities"}
                        </Text>
                        <Icon
                          name={showOfficeDuties ? "chevD" : "chevR"}
                          size={16}
                          color={P.primary}
                        />
                      </TouchableOpacity>
                      {showOfficeDuties &&
                        guide.officeDuties.slice(1).map((duty, index) => (
                          <Text key={`${index}:${duty}`} style={s.body}>
                            {duty}
                          </Text>
                        ))}
                    </>
                  )}
                  <SourceLink
                    label="Office duties · California voter guide"
                    url={guide.sourceUrl}
                  />
                </>
              </View>
            )}

            <View style={s.section}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                {candidate.statement?.trim()
                  ? "In their own words"
                  : "Details are limited"}
              </Text>
              {!!candidate.statement?.trim() && (
                <Text style={s.sectionIntro}>
                  {usingGuideStatement
                    ? "Candidate’s statement · Not independently reviewed."
                    : "Supplied statement · Not independently reviewed."}
                </Text>
              )}
              {candidate.statement ? (
                <Card style={s.panel}>
                  <Text selectable style={s.statementPreview}>
                    {showStatement ? candidate.statement : excerpt.text}
                  </Text>
                  {excerpt.truncated && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        showStatement
                          ? "Show less of candidate statement"
                          : "Read full candidate statement"
                      }
                      accessibilityState={{ expanded: showStatement }}
                      onPress={() => setShowStatement((value) => !value)}
                      style={s.action}
                    >
                      <Text style={s.actionText}>
                        {showStatement ? "Show less" : "Read full statement"}
                      </Text>
                      <Icon
                        name={showStatement ? "chevD" : "chevR"}
                        size={16}
                        color={P.primary}
                      />
                    </TouchableOpacity>
                  )}
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
                    {guide?.officeDuties?.length
                      ? "Billion has no statement for this candidate."
                      : "Billion has no statement or office details for this candidate."}{" "}
                    Missing information is not a judgment about them.
                  </Text>
                  <SourceLink
                    label="Find your election office"
                    prominence="primary"
                    url={
                      guide
                        ? "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
                        : "https://www.usa.gov/state-election-office"
                    }
                  />
                </Card>
              )}
            </View>

            <View style={s.footer}>
              {!!candidate.statement?.trim() && (
                <SourceLink
                  label="Find your election office"
                  url={
                    guide
                      ? "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
                      : "https://www.usa.gov/state-election-office"
                  }
                />
              )}
              <BallotDisclosure
                title="Sources & updates"
                detail="Source links and review information"
              >
                {fromBallot && (
                  <BallotProvenanceRows
                    sourceName={params.ballotSourceName}
                    sourceUrl={params.ballotSourceUrl}
                    fetchedAt={params.ballotFetchedAt}
                  />
                )}
                <Text style={s.muted}>
                  Billion has not independently reviewed this candidate's record
                  {candidate.statement?.trim() ? " or statement claims" : ""}.
                </Text>
                {!guide?.officeDuties?.length && (
                  <Text style={s.muted}>
                    Office duties are unavailable for this race.
                  </Text>
                )}
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
                {guide ? (
                  <SourceLink
                    label="About candidate statements"
                    url="https://voterguide.sos.ca.gov/voter-info/info-about-candidate-statements.htm"
                  />
                ) : null}
                {!!candidate.statement?.trim() &&
                  (fetchedAt ? (
                    <Text style={s.muted}>
                      {usingGuideStatement ? "Guide" : "Statement"} retrieved{" "}
                      {new Date(fetchedAt).toLocaleDateString("en-US", {
                        timeZone: "UTC",
                      })}
                    </Text>
                  ) : (
                    <Text style={s.muted}>
                      Statement retrieval date unavailable
                    </Text>
                  ))}
                <Text style={s.muted}>
                  {guide
                    ? "The guide includes only people who submitted statements. It is not a complete roster. Check your county ballot for eligibility, write-in, or withdrawal updates."
                    : "Check your election office for eligibility, write-in, or withdrawal updates."}
                </Text>
                <SourceLink
                  label="Report a correction to Billion"
                  url="https://billion-news.app/support"
                />
              </BallotDisclosure>
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
  identityText: { flex: 1, gap: 3 },
  name: {
    color: P.inkOnNight,
    fontFamily: fontDisplay.bold,
    fontSize: 25,
    lineHeight: 29,
  },
  office: { color: P.inkOnNight, fontFamily: fontEditorial.bold, fontSize: 16 },
  heroMeta: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 12 },
  ballotStatus: {
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  muted: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  rowText: { flex: 1, flexShrink: 1 },
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
});
