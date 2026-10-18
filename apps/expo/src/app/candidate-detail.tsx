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
import { BallotReadingText } from "~/components/ballot-evidence/BallotReadingCard";
import {
  CandidateCoverage,
  CandidateIndependentBrief,
} from "~/components/ballot-evidence/CandidateBrief";
import {
  candidateDetailText,
  CandidateDisclosure,
} from "~/components/ballot-evidence/CandidateDisclosure";
import { webUrl } from "~/components/ballot-evidence/model";
import {
  CandidateMoneyChapter,
  CandidateResearchCard,
  CandidateResearchPrompt,
  CandidateStatementChapter,
} from "~/components/candidate-research/CandidateResearchCards";
import { OfficeRole } from "~/components/office-role/OfficeRole";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
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
import { candidateBriefPreview } from "~/utils/candidate-brief-preview";
import {
  candidateBackgroundReady,
  canMatchCaliforniaGuide,
  ELECTION_DATE,
  findGuideCandidate,
  parseBallotCandidate,
  statewideOfficeName,
  statewideOfficeSlug,
} from "~/utils/candidate-explainer";
import { resolveOfficeRole } from "~/utils/office-role";

/** Contest routes pass JSON string arrays. Drop anything that is not a short label. */
function routeStringList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  try {
    const raw: unknown = JSON.parse(value);
    if (!Array.isArray(raw)) return undefined;
    const items = raw
      .filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0 &&
          item.length <= 80,
      )
      .slice(0, 8);
    return items.length ? items : undefined;
  } catch {
    return undefined;
  }
}

export default function CandidateDetailScreen() {
  const {
    t: tx,
    locale: appLocale,
    language: uiLanguage,
  } = useAppTranslation();

  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    office?: string;
    state?: string;
    electionDate?: string;
    district?: string;
    districtId?: string;
    roles?: string;
    levels?: string;
    candidate?: string;
    briefPreview?: string;
  }>();
  const [photoFailed, setPhotoFailed] = useState(false);
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
  const routeName = params.name?.trim();
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
    : (guide ??
      (query.isError && routeName
        ? {
            name: routeName,
            party: undefined,
            statement: undefined,
            photoUrl: undefined,
          }
        : undefined));
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
  const previewBrief =
    fromBallot?.name === "Morgan Lee (fictional)"
      ? candidateBriefPreview(params.briefPreview)
      : undefined;
  const electionOfficeUrl = guide
    ? "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
    : "https://www.usa.gov/state-election-office";

  const identityMeta = [
    fromBallot ? params.district?.trim() : tx("Statewide"),
    candidate?.party,
  ]
    .filter(Boolean)
    .join(" · ");

  const statementSourceLabel = sourceUrl
    ? usingGuideStatement
      ? tx("Original statement · California voter guide")
      : tx("Original statement · {value1}", {
          value1: statementCitation?.sourceName ?? tx("source"),
        })
    : undefined;

  const backgroundOffice = statewideOfficeName(
    guide?.officeName ?? params.office,
  );
  const electionDate =
    params.electionDate ??
    query.data?.electionDate ??
    (office ? ELECTION_DATE : undefined) ??
    "";
  const backgroundYear = Number(electionDate.slice(0, 4));
  const explicitState = params.state?.trim();
  const backgroundState =
    explicitState?.length === 2
      ? explicitState.toUpperCase()
      : (guide ?? office)
        ? "CA"
        : undefined;
  const trimmedDistrict = params.district?.trim();
  const backgroundDistrict =
    trimmedDistrict && trimmedDistrict.length > 0 ? trimmedDistrict : undefined;
  const backgroundRoles = routeStringList(params.roles);
  const backgroundLevels = routeStringList(params.levels);
  const suppliedBiography = fromBallot?.biography?.trim();
  const backgroundQuery = useQuery({
    ...trpc.civic.getCandidateBackground.queryOptions({
      name: params.name ?? candidate?.name ?? "",
      office: backgroundOffice ?? "",
      state: backgroundState,
      district: backgroundDistrict,
      party: fromBallot?.party,
      roles: backgroundRoles,
      level: backgroundLevels,
      electionYear: Number.isInteger(backgroundYear)
        ? backgroundYear
        : new Date().getUTCFullYear(),
    }),
    enabled:
      !suppliedBiography &&
      !!(params.name ?? candidate?.name) &&
      !!backgroundOffice &&
      (!fromBallot || candidateBackgroundReady(lookupGuide, query.isPending)),
  });
  const publicBiography = suppliedBiography
    ? {
        biography: suppliedBiography,
        sourceName:
          fromBallot?.citations?.find((item) => item.field === "biography")
            ?.sourceName ?? tx("ballot provider"),
        sourceUrl: fromBallot?.citations?.find(
          (item) => item.field === "biography",
        )?.sourceUrl,
        photoUrl: fromBallot?.photoUrl,
      }
    : backgroundQuery.data;

  const portraitUrl = candidate?.photoUrl ?? publicBiography?.photoUrl;
  const portraitSource = fromBallot?.photoUrl
    ? fromBallot.citations?.find((item) => item.field === "photoUrl")?.sourceUrl
    : guide?.photoUrl
      ? guide.sourceUrl
      : publicBiography?.photoUrl
        ? publicBiography.sourceUrl
        : undefined;

  return (
    <View style={s.screen}>
      <NavHeader
        title={tx("Candidate")}
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {!fromBallot && query.isPending ? (
          <ActivityIndicator color={P.spark} />
        ) : null}
        {!fromBallot && query.isError && !candidate ? (
          <Card style={s.panel}>
            <Text accessibilityRole="header" style={s.sectionTitle}>
              {tx("Candidate details couldn’t load")}
            </Text>
            <Text style={s.body}>
              {tx(
                "Try again, or check your election office for the official candidate list.",
              )}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void query.refetch()}
              style={[s.action, s.retryAction]}
            >
              <Text style={[s.actionText, { color: colors.white }]}>
                {tx("Try again")}
              </Text>
            </TouchableOpacity>
            <SourceLink
              label={tx("Find your election office")}
              url={electionOfficeUrl}
            />
          </Card>
        ) : null}
        {!query.isPending && !query.isError && !candidate ? (
          <Card style={s.panel}>
            <Text style={s.heading}>{tx("Candidate unavailable")}</Text>
            <Text style={s.body}>
              {tx(
                "This person is not in the current official statement guide. Return to the guide to choose a candidate.",
              )}
            </Text>
          </Card>
        ) : null}
        {candidate ? (
          <>
            <View style={s.hero}>
              {previewBrief ? (
                <Text style={s.fixtureLabel}>
                  {tx("Fictional preview · not published")}
                </Text>
              ) : null}
              <Text style={s.eyebrow}>
                {guide && query.data
                  ? `CALIFORNIA · ${ballotElectionDate(query.data.electionDate, uiLanguage)}`
                  : tx("CANDIDATE RESEARCH")}
              </Text>
              <View style={s.identity}>
                {webUrl(portraitUrl) && !photoFailed ? (
                  <Image
                    source={{ uri: portraitUrl }}
                    style={s.portrait}
                    onError={() => setPhotoFailed(true)}
                    accessibilityLabel={tx("Portrait of {value1}", {
                      value1: candidate.name,
                    })}
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
                    {guide?.officeName ??
                      backgroundOffice ??
                      tx("Office unavailable")}
                  </Text>
                </View>
              </View>
              {identityMeta ? (
                <Text style={s.heroMeta}>{identityMeta}</Text>
              ) : null}
              <View style={s.statusRow}>
                <Icon name="info" size={14} color={P.quiet} />
                <Text style={[s.muted, s.rowText]}>
                  {fromBallot?.ballotStatus === "withdrewStillOnBallot"
                    ? tx("Withdrawn; name remains on the ballot")
                    : fromBallot?.ballotStatus === "onBallot"
                      ? tx("Listed on your ballot")
                      : guide
                        ? tx("Statement guide · not a complete candidate list")
                        : tx("Ballot status unavailable")}
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={s.eyebrow}>{tx("START YOUR RESEARCH")}</Text>
              <Text style={s.body}>
                {tx(
                  "Follow the sources, compare records, and look for what’s missing. These are starting points for exploring this candidate.",
                )}
              </Text>
              {!previewBrief && (
                <Text style={s.muted}>
                  {tx(
                    "Independent research has not been published for this race.",
                  )}
                </Text>
              )}
            </View>

            <CandidateResearchCard
              title={tx("Promises & priorities")}
              question={tx("What do they want to change?")}
              icon="quote"
              availability={
                candidate.statement
                  ? tx("Candidate statement available")
                  : tx("Statement not supplied")
              }
            >
              {candidate.statement ? (
                <CandidateStatementChapter
                  attribution={
                    usingGuideStatement
                      ? tx(
                          "Supplied by the candidate. California does not check these claims for accuracy.",
                        )
                      : tx(
                          "Supplied by a ballot provider. Claims have not been independently checked by Billion.",
                        )
                  }
                  sourceLabel={statementSourceLabel}
                  sourceUrl={sourceUrl}
                />
              ) : (
                <Text style={s.muted}>
                  {tx(
                    "A candidate statement has not been supplied here. Check the official guide for available statements.",
                  )}
                </Text>
              )}
              {previewBrief && (
                <CandidateIndependentBrief
                  brief={previewBrief}
                  reviewedAt="October 2, 2026"
                  topics={[
                    "priorities",
                    "mechanisms",
                    "effects",
                    "tradeoffs",
                    "unknowns",
                  ]}
                />
              )}
              {!candidate.statement && (
                <CandidateResearchPrompt
                  questions={[
                    tx("What specific change do they say they want?"),
                    tx(
                      "Do they name a timeline, a cost, or who else must agree?",
                    ),
                    tx(
                      "Which claims have no linked document or outside record behind them?",
                    ),
                  ]}
                />
              )}
              {!sourceUrl && (
                <SourceLink
                  label={tx("Find your official voter guide")}
                  url={electionOfficeUrl}
                  prominence="primary"
                />
              )}
            </CandidateResearchCard>

            <CandidateResearchCard
              title={tx("Background & record")}
              question={tx("What have they done before?")}
              icon="doc"
              availability={
                publicBiography
                  ? tx("Source-provided biography available")
                  : backgroundQuery.isPending
                    ? tx("Checking public biographies")
                    : previewBrief
                      ? tx("Preview research notes available")
                      : tx("Background not supplied")
              }
            >
              {publicBiography ? (
                <View style={{ gap: 12 }}>
                  <Text style={s.muted}>
                    {tx(
                      "{value1} biography · not an independent assessment or a record of votes",
                      { value1: publicBiography.sourceName },
                    )}
                  </Text>
                  <BallotReadingText text={publicBiography.biography} />
                  <SourceLink
                    prominence="primary"
                    label={tx("Biography · {value1}", {
                      value1: publicBiography.sourceName,
                    })}
                    url={publicBiography.sourceUrl}
                  />
                </View>
              ) : null}
              {backgroundQuery.isPending && !publicBiography ? (
                <ActivityIndicator color={P.spark} />
              ) : null}

              {previewBrief && (
                <CandidateIndependentBrief
                  brief={previewBrief}
                  reviewedAt="October 2, 2026"
                  topics={["record"]}
                />
              )}
              {!publicBiography &&
                !backgroundQuery.isPending &&
                !previewBrief && (
                  <Text style={s.muted}>
                    {tx(
                      "Background records have not been supplied here. Missing information is not a judgment of this candidate.",
                    )}
                  </Text>
                )}
              <CandidateResearchPrompt
                questions={[
                  tx(
                    "Which roles have they held, and who documented that work?",
                  ),
                  tx(
                    "If they served in public office, where are the meeting minutes or recorded votes?",
                  ),
                  tx(
                    "Who wrote each source, and when was it published or retrieved?",
                  ),
                ]}
              />
              <SourceLink
                label={tx(
                  "Find the election office and official candidate list",
                )}
                url={electionOfficeUrl}
                prominence="primary"
              />
            </CandidateResearchCard>

            <CandidateResearchCard
              title={tx("Campaign funding")}
              question={tx(
                "Who contributes, and who spends outside the campaign?",
              )}
              icon="book"
              availability={tx("Donor records not connected")}
            >
              <CandidateMoneyChapter
                state={guide ? "CA" : params.state}
                office={guide?.officeName ?? params.office}
              />
            </CandidateResearchCard>

            <CandidateResearchCard
              title={tx("Office powers & limits")}
              question={tx("Can this job deliver the promise?")}
              icon="info"
              availability={
                guide?.officeDuties?.length ||
                resolveOfficeRole(
                  {
                    office: guide?.officeName ?? params.office,
                    state: guide ? "CA" : params.state,
                    districtId: guide
                      ? "ocd-division/country:us/state:ca"
                      : params.districtId,
                  },
                  uiLanguage,
                )
                  ? tx("Office guide available")
                  : tx("Office guide not supplied")
              }
            >
              {(!guide?.officeDuties?.length ||
                resolveOfficeRole(
                  {
                    office: guide.officeName,
                    state: "CA",
                    districtId: "ocd-division/country:us/state:ca",
                  },
                  uiLanguage,
                )) && (
                <OfficeRole
                  office={guide?.officeName ?? params.office}
                  state={guide ? "CA" : params.state}
                  districtId={
                    guide
                      ? "ocd-division/country:us/state:ca"
                      : params.districtId
                  }
                />
              )}

              {!!guide?.officeDuties?.length && (
                <CandidateDisclosure
                  title={tx("Official office responsibilities")}
                  summary={guide.officeDuties[0]}
                >
                  {guide.officeDuties.slice(1).map((duty, index) => (
                    <Text key={index} style={s.body}>
                      {duty}
                    </Text>
                  ))}
                  <SourceLink
                    label={tx("California official voter guide")}
                    url={guide.sourceUrl}
                  />
                </CandidateDisclosure>
              )}

              <CandidateResearchPrompt
                questions={[
                  tx("Which decisions actually belong to this office?"),
                  tx(
                    "Who controls the budget, and whose approval does a proposal need?",
                  ),
                  tx("How would the candidate act within those limits?"),
                ]}
              />
              <SourceLink
                label={tx("Find your election office")}
                url={electionOfficeUrl}
                prominence="primary"
              />
            </CandidateResearchCard>

            {!previewBrief && (
              <CandidateDisclosure title={tx("About this research")}>
                <CandidateCoverage
                  hasStatement={!!candidate.statement}
                  officeUrl={electionOfficeUrl}
                />
              </CandidateDisclosure>
            )}

            <View style={s.footer}>
              <CandidateDisclosure title={tx("Sources & updates")}>
                {sourceUrl ? (
                  <SourceLink
                    label={
                      usingGuideStatement
                        ? tx("Candidate statement · official guide")
                        : tx("Candidate statement · {value1}", {
                            value1:
                              statementCitation?.sourceName ??
                              tx("ballot provider"),
                          })
                    }
                    url={sourceUrl}
                  />
                ) : null}
                {portraitUrl && portraitSource ? (
                  <SourceLink
                    label={
                      fromBallot?.photoUrl
                        ? tx("Portrait · ballot provider")
                        : guide?.photoUrl
                          ? tx("Portrait · California voter guide")
                          : tx("Portrait · {value1}", {
                              value1:
                                publicBiography?.sourceName ?? tx("source"),
                            })
                    }
                    url={portraitSource}
                  />
                ) : null}
                {guide ? (
                  <SourceLink
                    label={tx("About candidate statements")}
                    url="https://voterguide.sos.ca.gov/voter-info/info-about-candidate-statements.htm"
                  />
                ) : null}
                {fetchedAt ? (
                  <Text style={s.muted}>
                    {tx("{value1} retrieved {value2}", {
                      value1: usingGuideStatement
                        ? tx("Guide")
                        : tx("Statement"),
                      value2: new Date(fetchedAt).toLocaleDateString(
                        appLocale,
                        {
                          timeZone: "UTC",
                        },
                      ),
                    })}
                  </Text>
                ) : null}
                <Text style={s.muted}>
                  {guide
                    ? tx(
                        "The guide includes only people who submitted statements. It is not a complete roster. Check your county ballot for eligibility, write-in, or withdrawal updates.",
                      )
                    : tx(
                        "Check your election office for eligibility, write-in, or withdrawal updates.",
                      )}
                </Text>
                <SourceLink
                  label={tx("Report a correction to Billion")}
                  url="https://billion-news.app/support"
                />
              </CandidateDisclosure>
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
  hero: {
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.border,
  },
  fixtureLabel: {
    ...candidateDetailText,
    color: P.spark,
    fontFamily: fontBody.semibold,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.70)",
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
    fontSize: 30,
    lineHeight: 34,
  },
  office: { color: P.inkOnNight, fontFamily: fontBody.semibold, fontSize: 15 },
  heroMeta: {
    color: "rgba(255,255,255,0.70)",
    fontFamily: fontBody.medium,
    fontSize: 12,
  },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  muted: {
    color: "rgba(255,255,255,0.70)",
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  rowText: { flex: 1, flexShrink: 1 },
  sectionTitle: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 18,
  },

  panel: {
    padding: 16,
    gap: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderLeftColor: colors.bill,
  },
  panelLabel: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
  },
  action: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  retryAction: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: "center",
  },
  actionText: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: fontBody.semibold,
    fontSize: 12,
  },
  heading: {
    color: P.inkOnNight,
    fontFamily: fontEditorial.bold,
    fontSize: 18,
  },
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
