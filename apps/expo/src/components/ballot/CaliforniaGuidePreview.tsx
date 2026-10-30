import type { ViewToken } from "react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { plainTrillionText, trillionEmphasis } from "@acme/validators";

import type { GuideVote } from "./GuideVoteResult";
import type { IconName } from "~/components/ui";
import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader, Pill, Segmented } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useIdleBallotPreloading } from "~/hooks/useIdleBallotPreloading";
import { useLanguage } from "~/hooks/useLanguage";
import { useMeasureTranslation } from "~/hooks/useMeasureTranslation";
import { usePollVisibility } from "~/hooks/usePollVisibility";
import { translateAppLabel } from "~/i18n/app-strings";
import {
  DigestHair,
  DigestSpace,
  DigestType,
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { guideCandidateRoute } from "~/utils/candidate-explainer";
import {
  propositionDetailRoute,
  splitOfficialTitle,
} from "~/utils/proposition-explainers";
import { CandidatePortrait } from "./CandidatePortrait";
import { GuidePollResult } from "./GuidePollResult";
import { GuideVoteResult, useGuideVoteLabel } from "./GuideVoteResult";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Candidate = Guide["candidates"][number];
type Measure = Guide["measures"][number];
type Standing =
  RouterOutputs["civic"]["getCaliforniaGuideStandings"]["measures"][string];
function officialMeasure(standing: Standing | undefined) {
  return standing?.kind === "official" ? standing.result : undefined;
}
function officialCandidate(
  standing:
    | RouterOutputs["civic"]["getCaliforniaGuideStandings"]["candidates"][string]
    | undefined,
) {
  return standing?.kind === "official" ? standing.result : undefined;
}
type GuideTab = "candidates" | "measures";

const MEASURE_VIEWABILITY = { itemVisiblePercentThreshold: 1 };

const COUNTY_OFFICES_URL =
  "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices";

function SourceRow({
  icon,
  label,
  url,
  last,
}: {
  icon: IconName;
  label: string;
  url: string;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={label}
      activeOpacity={0.8}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      style={[s.sourceRow, !last && s.sourceRule]}
    >
      <View style={s.tile}>
        <Icon name={icon} size={17} color={P.primary} />
      </View>
      <Text style={s.sourceLabel}>{label}</Text>
      <Icon name="external" size={16} color={P.primary} />
    </TouchableOpacity>
  );
}

function officeGroups(candidates: readonly Candidate[]) {
  const groups = new Map<
    string,
    { slug: string; name?: string; candidates: Candidate[] }
  >();
  for (const candidate of candidates) {
    const group = groups.get(candidate.officeSlug);
    if (group) group.candidates.push(candidate);
    else
      groups.set(candidate.officeSlug, {
        slug: candidate.officeSlug,
        name: candidate.officeName,
        candidates: [candidate],
      });
  }
  return [...groups.values()];
}

function CandidateRow({
  candidate,
  showPolls,
  result,
  status,
  last,
}: {
  candidate: Candidate;
  showPolls: boolean;
  result?: GuideVote;
  status: "loading" | "pending" | "unavailable" | "reported";
  last: boolean;
}) {
  const resultLabel = useGuideVoteLabel(result, status, true);
  const { t: tx, language } = useAppTranslation();
  const router = useRouter();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={[
        candidate.name,
        result
          ? resultLabel
          : showPolls &&
            tx(
              status === "loading"
                ? "Checking polls…"
                : status === "unavailable"
                  ? "Polling unavailable"
                  : "No poll available in our sources",
            ),
        translateAppLabel(
          language,
          candidate.officeName ?? tx("statewide office"),
        ),
        candidate.party
          ? translateAppLabel(language, candidate.party)
          : undefined,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={tx("Opens the candidate page")}
      activeOpacity={0.8}
      onPress={() =>
        router.push(guideCandidateRoute(candidate.name, candidate.officeSlug))
      }
      style={[s.candidateRow, !last && s.candidateRule]}
    >
      <CandidatePortrait
        name={candidate.name}
        photoUrl={candidate.photoUrl}
        size={44}
      />
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{candidate.name}</Text>
        {candidate.party ? (
          <View style={s.partyTag}>
            <Text style={s.partyText} numberOfLines={1}>
              {translateAppLabel(language, candidate.party)}
            </Text>
          </View>
        ) : null}
        {result ? (
          <GuideVoteResult result={result} status={status} />
        ) : showPolls ? (
          <Text style={s.note}>
            {tx(
              status === "loading"
                ? "Checking polls…"
                : status === "unavailable"
                  ? "Polling unavailable"
                  : "No poll available in our sources",
            )}
          </Text>
        ) : null}
      </View>
      <Icon name="chevR" size={18} color={P.primary} />
    </TouchableOpacity>
  );
}

function MeasureRow({
  measure: originalMeasure,
  showPolls,
  standing,
  result,
  status,
}: {
  measure: Measure;
  showPolls: boolean;
  standing?: Standing;
  result?: GuideVote;
  status: "loading" | "pending" | "unavailable" | "reported";
}) {
  const resultLabel = useGuideVoteLabel(result, status, true);
  const { t: tx } = useAppTranslation();

  const { t } = useLanguage();
  const translation = useMeasureTranslation(
    originalMeasure.number,
    undefined,
    "title",
  );
  const measure = translation.translation
    ? { ...originalMeasure, ...translation.translation.measure }
    : originalMeasure;
  const router = useRouter();
  const official = splitOfficialTitle(measure.title);
  return (
    <View style={s.standingRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={[
          tx("Proposition {value1}", { value1: measure.number }),
          standing?.kind === "poll" && showPolls
            ? `${tx("Poll")}. ${standing.poll.observation.choices.map((choice) => `${choice.kind === "yes" ? tx("Yes") : choice.kind === "no" ? tx("No") : choice.kind === "undecided" ? tx("Undecided") : choice.label} ${choice.share}%`).join(", ")}`
            : result
              ? resultLabel
              : showPolls &&
                tx(
                  status === "loading"
                    ? "Checking polls…"
                    : status === "unavailable"
                      ? "Polling unavailable"
                      : "No poll available in our sources",
                ),
          measure.displayTitle
            ? plainTrillionText(measure.displayTitle)
            : measure.title,
        ]
          .filter(Boolean)
          .join(". ")}
        accessibilityHint={tx("Opens the proposition detail")}
        activeOpacity={0.8}
        onPress={() => router.push(propositionDetailRoute(measure.number))}
        style={s.row}
      >
        <View style={s.tile} accessible={false}>
          <Text style={s.tileText}>{measure.number}</Text>
        </View>
        <View style={s.rowCopy}>
          {measure.displayTitle ? (
            <Text style={[s.rowTitle, s.headline17]}>
              {trillionEmphasis(measure.displayTitle).map((part, index) => (
                <Text key={index} style={part.bold ? s.bold : undefined}>
                  {part.text}
                </Text>
              ))}
            </Text>
          ) : (
            <Text style={s.officialTitle}>{official.subject}</Text>
          )}
          {translation.state === "pending" && (
            <Text style={s.note}>{t("article.translationPending")}</Text>
          )}
          {translation.state === "unavailable" && (
            <Text style={s.note}>{t("article.translationUnavailable")}</Text>
          )}
          {(showPolls || result) &&
            standing?.kind !== "poll" &&
            (result ? (
              <GuideVoteResult result={result} status={status} />
            ) : (
              <Text style={s.note}>
                {tx(
                  status === "loading"
                    ? "Checking polls…"
                    : status === "unavailable"
                      ? "Polling unavailable"
                      : "No poll available in our sources",
                )}
              </Text>
            ))}
        </View>
        <Icon name="chevR" size={18} color={P.primary} />
      </TouchableOpacity>
      {showPolls && standing?.kind === "poll" && (
        <GuidePollResult poll={standing.poll} compact />
      )}
    </View>
  );
}

const QUICK_ACTIONS: readonly {
  label: "Voting plan" | "Notes" | "Voting help";
  icon: IconName;
  mode: "plan" | "notes" | "help";
}[] = [
  { label: "Voting plan", icon: "vote", mode: "plan" },
  { label: "Notes", icon: "book", mode: "notes" },
  { label: "Voting help", icon: "info", mode: "help" },
];

export function CaliforniaGuidePreview({
  onOpenBallot,
  onOpenFixtures,
  onBack,
}: {
  onOpenBallot?: () => void;
  onOpenFixtures?: () => void;
  onBack?: () => void;
}) {
  const { t: tx, language: uiLanguage } = useAppTranslation();

  const { language, t } = useLanguage();
  const router = useRouter();

  const [tab, setTab] = useState<GuideTab>("candidates");
  const [officeFilter, setOfficeFilter] = useState("all");
  const { showPolls, setShowPolls } = usePollVisibility();
  const focused = useIsFocused();
  const query = useQuery(
    trpc.civic.getCaliforniaGuide.queryOptions(undefined, { enabled: focused }),
  );
  const guide = query.isError ? undefined : query.data;
  const resultsQuery = useQuery(
    trpc.civic.getCaliforniaGuideStandings.queryOptions(undefined, {
      enabled: focused && !!guide,
      staleTime: 60_000,
      refetchInterval: focused ? 60_000 : false,
    }),
  );
  const results =
    !resultsQuery.isError &&
    resultsQuery.data?.electionDate === guide?.electionDate
      ? resultsQuery.data
      : undefined;
  const resultsStatus = resultsQuery.isPending
    ? "loading"
    : resultsQuery.isError
      ? "unavailable"
      : "reported";
  const [visibleNumbers, setVisibleNumbers] = useState<string[]>([]);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Measure>[] }) => {
      const numbers = viewableItems.map(({ item }) => item.number);
      setVisibleNumbers((previous) =>
        previous.length === numbers.length &&
        previous.every((number, index) => number === numbers[index])
          ? previous
          : numbers,
      );
    },
    [],
  );
  const preloading = useIdleBallotPreloading({
    numbers: visibleNumbers,
    enabled: tab === "measures",
  });
  const hasBoldedTitles = !!guide?.measures.some((m) => m.displayTitle);
  const offices = guide ? officeGroups(guide.candidates) : [];
  return (
    <View
      style={{ flex: 1, backgroundColor: P.canvas }}
      onTouchStart={preloading.onTouchStart}
      onTouchEnd={preloading.onTouchEnd}
      onTouchCancel={preloading.onTouchCancel}
    >
      <NavHeader title={tx("California guide")} large onBack={onBack} />
      <FlatList
        key={tab}
        data={tab === "measures" ? guide?.measures : []}
        keyExtractor={(measure) => measure.number}
        renderItem={({ item }) => (
          <MeasureRow
            measure={item}
            showPolls={showPolls}
            standing={results?.measures[item.number]}
            result={officialMeasure(results?.measures[item.number])}
            status={resultsStatus}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        viewabilityConfig={MEASURE_VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged}
        onScroll={preloading.onScroll}
        onScrollBeginDrag={preloading.onScrollBegin}
        onScrollEndDrag={preloading.onScrollEndDrag}
        onMomentumScrollBegin={preloading.onScrollBegin}
        onMomentumScrollEnd={preloading.onMomentumScrollEnd}
        contentContainerStyle={s.screen}
        showsVerticalScrollIndicator={false}
        ListHeaderComponentStyle={{
          marginBottom:
            tab === "measures" && (hasBoldedTitles || language !== "en")
              ? 12
              : 22,
        }}
        ListHeaderComponent={
          <View style={{ gap: 22 }}>
            <View style={s.intro}>
              {guide && (
                <Text style={s.kicker}>
                  {tx("{date} · General election", {
                    date: ballotElectionDate(guide.electionDate, uiLanguage),
                  })}
                </Text>
              )}
              {!guide && (
                <Text style={s.introText}>
                  {query.isPending
                    ? tx("Checking the statewide preview…")
                    : query.isError
                      ? tx("The preview couldn’t load.")
                      : tx("The preview isn’t available in Billion.")}
                </Text>
              )}
            </View>

            {guide && (
              <View style={s.pollToggle}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.actionText}>{tx("Show polls")}</Text>
                  <Text style={s.pollToggleHint}>
                    {tx("Polls are hidden until you choose to show them.")}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={tx("Show polls")}
                  value={showPolls}
                  onValueChange={setShowPolls}
                  hitSlop={8}
                  style={{ height: 32, width: 56 }}
                />
              </View>
            )}
            <View style={s.actions}>
              {QUICK_ACTIONS.map((item) => (
                <TouchableOpacity
                  key={item.mode}
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  style={s.action}
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
                  <Icon name={item.icon} size={15} color={P.inkOnNight} />
                  <Text style={s.actionText}>{tx(item.label)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {query.isPending && <ActivityIndicator color={P.inkOnNight} />}
            {query.isError && (
              <Card>
                <Text style={s.cardText}>
                  {tx("The official guide could not load.")}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={s.retryButton}
                  onPress={() => void query.refetch()}
                >
                  <Text style={s.retry}>{tx("Try again")}</Text>
                </TouchableOpacity>
              </Card>
            )}
            {!query.isPending && !query.isError && !guide && (
              <Card>
                <Text style={s.cardText}>
                  {tx(
                    "Guide data is unavailable to Billion. Check the official guide or your election office.",
                  )}
                </Text>
              </Card>
            )}
            {!query.isPending && (query.isError || !guide) && (
              <View style={s.intro}>
                <SourceLink
                  label={tx("California official voter guide")}
                  prominence="primary"
                  url="https://voterguide.sos.ca.gov/"
                />
                <SourceLink
                  label={tx("Find your county elections office")}
                  url={COUNTY_OFFICES_URL}
                />
              </View>
            )}

            {guide && (
              <>
                <Segmented<GuideTab>
                  value={tab}
                  onChange={(next) => {
                    if (next === tab) return;
                    setVisibleNumbers([]);
                    setTab(next);
                  }}
                  options={[
                    {
                      id: "candidates",
                      label: tx("Candidates"),
                      icon: "vote",
                    },
                    {
                      id: "measures",
                      label: tx("Measures {count}", {
                        count: guide.measures.length,
                      }),
                      icon: "scale",
                    },
                  ]}
                />
                {tab === "candidates" ? (
                  <View style={s.list}>
                    {showPolls && results?.governor.kind === "poll" && (
                      <View style={s.standingRow}>
                        <GuidePollResult
                          title={tx("Governor poll")}
                          poll={results.governor.poll}
                        />
                      </View>
                    )}
                    {results?.governor.kind === "official" && (
                      <View style={s.standingRow}>
                        <Text style={s.rowTitle}>{tx("Governor")}</Text>
                        {results.governor.candidates.map((candidate) => (
                          <View key={candidate.name} style={{ padding: 14 }}>
                            <Text style={s.rowTitle}>{candidate.name}</Text>
                            <GuideVoteResult
                              result={candidate.result}
                              status="reported"
                            />
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={s.statementsHead}>
                      <Text accessibilityRole="header" style={s.sectionTitle}>
                        {tx("Official statements {count}", {
                          count: guide.candidates.length,
                        })}
                      </Text>
                      <Text style={s.note}>
                        {tx("Statement submitters only, not your full ballot.")}
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={s.officeChips}
                      contentContainerStyle={s.officeChipRow}
                      accessibilityLabel={tx("Filter by office")}
                    >
                      {[
                        { slug: "all", label: tx("All offices") },
                        ...offices.map((group) => ({
                          slug: group.slug,
                          label: translateAppLabel(
                            language,
                            group.name ?? tx("Statewide office"),
                          ),
                        })),
                      ].map((chip) => (
                        <Pill
                          key={chip.slug}
                          label={chip.label}
                          active={officeFilter === chip.slug}
                          onPress={() => setOfficeFilter(chip.slug)}
                        />
                      ))}
                    </ScrollView>
                    {offices
                      .filter(
                        (group) =>
                          officeFilter === "all" || group.slug === officeFilter,
                      )
                      .map((group) => (
                        <View key={group.slug} style={s.officeGroup}>
                          <View style={s.officeHead}>
                            <Text
                              accessibilityRole="header"
                              style={s.officeName}
                            >
                              {translateAppLabel(
                                language,
                                group.name ?? tx("Statewide office"),
                              )}
                            </Text>
                            <Text style={s.officeCount}>
                              {tx("candidate.count", {
                                count: group.candidates.length,
                              })}
                            </Text>
                          </View>
                          <View style={s.officeCard}>
                            {group.candidates.map((candidate, index) => (
                              <CandidateRow
                                key={`${candidate.officeSlug}:${candidate.name}`}
                                candidate={candidate}
                                showPolls={showPolls}
                                result={officialCandidate(
                                  results?.candidates[
                                    `${candidate.officeSlug}:${candidate.name}`
                                  ],
                                )}
                                status={resultsStatus}
                                last={index === group.candidates.length - 1}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                  </View>
                ) : (
                  <View style={s.list}>
                    {(hasBoldedTitles || language !== "en") && (
                      <View style={s.aiNote}>
                        <Icon name="sparkle" size={13} color={P.quiet} />
                        <Text style={s.note}>
                          {language === "en"
                            ? tx("Official titles · bold added by Billion")
                            : t("reader.translatedTitles")}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          <View
            style={{
              gap: 22,
              marginTop: tab === "measures" && guide?.measures.length ? 22 : 0,
            }}
          >
            {guide && (
              <View style={s.footer}>
                {onOpenBallot && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={onOpenBallot}
                    style={s.ballotButton}
                  >
                    <Text style={s.ballotButtonText}>
                      {tx("Find my official ballot")}
                    </Text>
                    <Icon name="arrowRight" size={17} color={P.inkOnNight} />
                  </TouchableOpacity>
                )}
                <Card flush style={s.sources}>
                  <SourceRow
                    icon="vote"
                    label={tx("Official election results")}
                    url="https://electionresults.sos.ca.gov/"
                  />
                  <SourceRow
                    icon="book"
                    label={tx("Official voter guide")}
                    url={guide.sourceUrl}
                  />
                  <SourceRow
                    icon="vote"
                    label={tx("Check your registration")}
                    url="https://voterstatus.sos.ca.gov/EN/Authenticate"
                  />
                  <SourceRow
                    icon="pin"
                    label={tx("County elections office")}
                    url={COUNTY_OFFICES_URL}
                    last
                  />
                </Card>
              </View>
            )}
            {onOpenFixtures && (
              <TouchableOpacity onPress={onOpenFixtures}>
                <Text style={s.fixtureLink}>{tx("Development scenarios")}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  pollToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 44,
  },
  pollToggleHint: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  screen: {
    paddingHorizontal: DigestSpace.screenPadX + 4,
    paddingTop: 12,
    paddingBottom: 160,
  },
  intro: { gap: 10 },
  kicker: {
    ...DigestType.sectionEyebrow,
    fontSize: 11,
    color: P.spark,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: P.inkOnNight,
  },
  introText: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.quiet,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DigestHair.sectionRule,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.inkOnNight,
  },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.quiet,
  },
  aiNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  list: { gap: 12 },
  /** Matches the Elections hub tool cards (`entryTool`). */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: P.card,
  },
  standingRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: P.card,
    overflow: "hidden",
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: `${P.primary}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: {
    fontFamily: fontBody.bold,
    fontSize: 14,
    color: P.linkOnNight,
  },
  rowTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  /** Regular weight so the one `**key phrase**` can stand out in bold. */
  /** Same pairing as Trillion rows: Plex 400 with the key phrase at 700. */
  headline17: { fontFamily: fontDisplay.regular, fontSize: 17, lineHeight: 23 },
  bold: { fontFamily: fontDisplay.bold },
  /** Fallback when no generated headline exists: the state's own wording. */
  officialTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: P.inkOnNight,
  },
  rowNote: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: P.quiet,
  },
  statementsHead: { gap: 4 },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  officeChips: {
    flexGrow: 0,
    marginHorizontal: -(DigestSpace.screenPadX + 4),
  },
  officeChipRow: {
    gap: 8,
    paddingHorizontal: DigestSpace.screenPadX + 4,
  },
  officeGroup: { gap: 8, marginTop: 6 },
  officeHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
  },
  officeName: {
    ...DigestType.sectionEyebrow,
    flex: 1,
    fontSize: 11,
    color: P.spark,
    textTransform: "uppercase",
  },
  officeCount: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: P.quiet,
  },
  officeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: P.card,
    overflow: "hidden",
  },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 76,
  },
  candidateRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  partyTag: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.sectionRule,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  partyText: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    lineHeight: 16,
    color: P.quiet,
  },
  cardText: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  footer: { gap: 12, paddingBottom: 18 },
  sources: { borderRadius: 14 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  sourceRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  sourceLabel: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
  },
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
  ballotButton: {
    minHeight: 52,
    marginTop: 6,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: P.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ballotButtonText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: P.inkOnNight,
  },
  fixtureLink: { color: P.quiet, paddingVertical: 16 },
});
