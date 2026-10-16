import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { plainTrillionText, trillionEmphasis } from "@acme/validators";

import type { IconName } from "~/components/ui";
import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader, Segmented } from "~/components/ui";
import {
  DigestHair,
  DigestSpace,
  DigestType,
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { guideCandidateRoute } from "~/utils/candidate-explainer";
import {
  propositionDetailRoute,
  splitOfficialTitle,
} from "~/utils/proposition-explainers";

type Guide = NonNullable<RouterOutputs["civic"]["getCaliforniaGuide"]>;
type Candidate = Guide["candidates"][number];
type Measure = Guide["measures"][number];
type GuideTab = "candidates" | "measures";

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

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
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
      style={s.row}
    >
      {candidate.photoUrl && !photoFailed ? (
        <Image
          source={{ uri: candidate.photoUrl }}
          style={s.portrait}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View style={s.tile}>
          <Icon name="user" size={18} color={P.primary} />
        </View>
      )}
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{candidate.name}</Text>
        <Text style={s.rowNote}>
          {[candidate.officeName ?? "Statewide office", candidate.party]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Icon name="chevR" size={18} color={P.primary} />
    </TouchableOpacity>
  );
}

function MeasureRow({ measure }: { measure: Measure }) {
  const router = useRouter();
  const official = splitOfficialTitle(measure.title);
  const prefetch = () =>
    void queryClient.prefetchQuery(
      trpc.civic.getTrillion.queryOptions({ number: measure.number }),
    );
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={[
        `Proposition ${measure.number}`,
        measure.plainTitle && plainTrillionText(measure.plainTitle),
        `Official title: ${measure.title}`,
      ]
        .filter(Boolean)
        .join(". ")}
      accessibilityHint="Opens the proposition detail"
      activeOpacity={0.8}
      onPressIn={prefetch}
      onPress={() => router.push(propositionDetailRoute(measure.number))}
      style={s.row}
    >
      <View style={s.tile} accessible={false}>
        <Text style={s.tileText}>{measure.number}</Text>
      </View>
      <View style={s.rowCopy}>
        {measure.plainTitle ? (
          <Text style={[s.rowTitle, s.headline17]}>
            {trillionEmphasis(measure.plainTitle).map((part, index) => (
              <Text key={index} style={part.bold ? s.bold : undefined}>
                {part.text}
              </Text>
            ))}
          </Text>
        ) : (
          <Text style={s.officialTitle}>{official.subject}</Text>
        )}
      </View>
      <Icon name="chevR" size={18} color={P.primary} />
    </TouchableOpacity>
  );
}

const QUICK_ACTIONS: readonly {
  label: string;
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
  const guideScroll = useRef<ScrollView>(null);
  const router = useRouter();

  const [tab, setTab] = useState<GuideTab>("candidates");
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.isError ? undefined : query.data;
  const hasGeneratedTitles = !!guide?.measures.some((m) => m.plainTitle);
  return (
    <View style={{ flex: 1, backgroundColor: P.canvas }}>
      <NavHeader title="California guide" onBack={onBack} />
      <ScrollView
        ref={guideScroll}
        contentContainerStyle={s.screen}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.intro}>
          {guide && (
            <Text style={s.kicker}>
              {`${ballotElectionDate(guide.electionDate)} · General election`}
            </Text>
          )}
          <Text accessibilityRole="header" style={s.headline}>
            The statewide guide
          </Text>
          {!guide && (
            <Text style={s.introText}>
              {query.isPending
                ? "Checking the statewide preview…"
                : query.isError
                  ? "The preview couldn’t load."
                  : "The preview isn’t available in Billion."}
            </Text>
          )}
        </View>

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
              <Text style={s.actionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {query.isPending && <ActivityIndicator color={P.inkOnNight} />}
        {query.isError && (
          <Card>
            <Text style={s.cardText}>The official guide could not load.</Text>
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
            <Text style={s.cardText}>
              Guide data is unavailable to Billion. Check the official guide or
              your election office.
            </Text>
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
              url={COUNTY_OFFICES_URL}
            />
          </View>
        )}

        {guide && (
          <>
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
                <Text style={s.note}>
                  Statement submitters only, not your full ballot.
                </Text>
                {guide.candidates.map((candidate) => (
                  <CandidateRow
                    key={`${candidate.officeSlug}:${candidate.name}`}
                    candidate={candidate}
                  />
                ))}
              </View>
            ) : (
              <View style={s.list}>
                {hasGeneratedTitles && (
                  <View style={s.aiNote}>
                    <Icon name="sparkle" size={13} color={P.quiet} />
                    <Text style={s.note}>
                      AI headlines · tap for the official text
                    </Text>
                  </View>
                )}
                {guide.measures.map((measure) => (
                  <MeasureRow key={measure.number} measure={measure} />
                ))}
              </View>
            )}
            <View style={s.footer}>
              {onOpenBallot && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={onOpenBallot}
                  style={s.ballotButton}
                >
                  <Text style={s.ballotButtonText}>
                    Find my official ballot
                  </Text>
                  <Icon name="arrowRight" size={17} color={P.inkOnNight} />
                </TouchableOpacity>
              )}
              <Card flush style={s.sources}>
                <SourceRow
                  icon="book"
                  label="Official voter guide"
                  url={guide.sourceUrl}
                />
                <SourceRow
                  icon="vote"
                  label="Check your registration"
                  url="https://voterstatus.sos.ca.gov/EN/Authenticate"
                />
                <SourceRow
                  icon="pin"
                  label="County elections office"
                  url={COUNTY_OFFICES_URL}
                  last
                />
              </Card>
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
  screen: {
    paddingHorizontal: DigestSpace.screenPadX + 4,
    paddingTop: 12,
    paddingBottom: 160,
    gap: 22,
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
  portrait: { width: 36, height: 36, borderRadius: 9 },
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
