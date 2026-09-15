import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import type { Contest } from "@acme/api";

import type { BallotResponse } from "~/utils/ballot-lookup";
import {
  BallotLanguages,
  BallotSources,
  BallotStatusNotice,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { Icon } from "~/components/ui/Icon";
import { Card } from "~/components/ui/layout";
import { NavHeader } from "~/components/ui/NavHeader";
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";
import {
  DigestHair,
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  planes,
} from "~/styles";
import {
  ballotElectionDate,
  ballotElectionOptions,
  ballotModel,
  ballotOfficeUrl,
  contestBallotCitations,
  validateBallotAddress,
} from "~/utils/ballot-lookup";

export interface BallotLookupViewProps {
  address: string;
  onAddress: (address: string) => void;
  discovery?: BallotResponse;
  data?: BallotResponse;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onElection: (id: string) => void;
  settled: boolean;
  requestedElectionId?: string;
  /** Optional renderer for fixture verification without contacting the CA feed. */
  renderCaliforniaResults?: (data: BallotResponse) => ReactNode;
}

function Disclosure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.disclosure}
      >
        <Text style={s.actionText}>{label}</Text>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={18}
          color={P.inkOnNight}
        />
      </Pressable>
      {expanded && <View style={s.details}>{children}</View>}
    </View>
  );
}

function ContestCard({ contest }: { contest: Contest }) {
  const citations = [
    ...contestBallotCitations(contest),
    ...(contest.candidates ?? []).flatMap((candidate) =>
      (candidate.citations ?? []).map((citation) => ({
        ...citation,
        field: `${candidate.name} · ${citation.field}`,
      })),
    ),
  ];
  return (
    <Card style={s.card}>
      <Text style={s.eyebrow}>
        {contest.referendumTitle ? "Ballot measure" : "Candidate race"}
      </Text>
      <Text accessibilityRole="header" style={s.contestTitle}>
        {contest.referendumTitle ?? contest.office ?? "Ballot contest"}
      </Text>
      {!!contest.district?.name && (
        <Text style={s.secondary}>{contest.district.name}</Text>
      )}
      {!!contest.referendumSubtitle && (
        <Text style={s.body}>{contest.referendumSubtitle}</Text>
      )}
      {!contest.referendumTitle && !contest.candidates?.length && (
        <Text style={s.secondary}>
          Candidate information is unavailable to Billion.
        </Text>
      )}
      {contest.candidates?.map((candidate, index) => (
        <View key={index} style={s.candidate}>
          <Text style={s.candidateName}>{candidate.name}</Text>
          {candidate.ballotStatus === "withdrewStillOnBallot" && (
            <Text style={s.withdrawn}>Withdrawn; still on ballot</Text>
          )}
          {!!candidate.party && (
            <Text style={s.secondary}>{candidate.party}</Text>
          )}
        </View>
      ))}
      {!!contest.referendumText && (
        <Disclosure label="Read measure text">
          <Text selectable style={s.body}>
            {contest.referendumText}
          </Text>
        </Disclosure>
      )}
      <BallotSources
        citations={citations}
        contentKind="citations"
        showRecovery={false}
      />
    </Card>
  );
}

export function BallotLookupView(props: BallotLookupViewProps) {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(props.address);
  const [editing, setEditing] = useState(!props.address);
  const [invalid, setInvalid] = useState(false);
  const [choosingElection, setChoosingElection] = useState(false);
  const [votingExpanded, setVotingExpanded] = useState(false);
  const addressInput = useRef<TextInput>(null);
  const ballotScroll = useRef(0);
  const [ballotOffset, setBallotOffset] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!votingExpanded) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setVotingExpanded(false);
          return true;
        },
      );
      return () => subscription.remove();
    }, [votingExpanded]),
  );
  // Keep cached ballot content out of address editing and request transitions.
  const mismatch =
    !props.loading &&
    !props.failed &&
    !editing &&
    !!props.requestedElectionId &&
    !!props.data &&
    props.data.election?.id !== props.requestedElectionId;
  const data =
    props.loading || props.failed || invalid || editing || mismatch
      ? undefined
      : props.data;
  const model = data ? ballotModel(data) : undefined;
  const elections = ballotElectionOptions(props.discovery, data);
  const submit = () => {
    const valid = validateBallotAddress(draft);
    setInvalid(!valid);
    if (valid) {
      setEditing(false);
      props.onAddress(draft.trim());
    }
  };
  const officeUrl = data ? ballotOfficeUrl(data) : undefined;
  const evidence =
    !editing &&
    !props.loading &&
    !mismatch &&
    (props.failed
      ? { kind: "provider-failure" as const }
      : props.settled
        ? {
            kind: "result" as const,
            electionKnown: !!model?.election,
            contestCount: model?.contests.length ?? 0,
          }
        : undefined);
  const hasContests = !!model?.contests.length;
  const hasSupport =
    hasContests ||
    !!data?.officialVotingGuidance?.items.length ||
    !!data?.pollingLocations?.length ||
    !!data?.earlyVoteSites?.length ||
    !!data?.dropOffLocations?.length ||
    !!data?.state?.length;
  if (votingExpanded && !editing && !mismatch) {
    return (
      <View style={s.screen}>
        <NavHeader
          key={fontScale}
          title=""
          onBack={() => setVotingExpanded(false)}
        />
        <ScrollView
          key="voting"
          contentContainerStyle={[
            s.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text accessibilityRole="header" style={s.pageTitle}>
            How to vote
          </Text>
          {model?.election && (
            <View style={s.electionHeader}>
              <Text style={s.electionTitle}>{model.election.name}</Text>
              <Text style={s.secondary}>
                {ballotElectionDate(model.election.electionDay)}
              </Text>
            </View>
          )}
          {props.loading ? (
            <View accessibilityLiveRegion="polite" style={s.loading}>
              <ActivityIndicator color={P.spark} />
              <Text style={s.body}>Updating voting information…</Text>
            </View>
          ) : props.failed ? (
            <BallotStatusNotice
              evidence={{ kind: "provider-failure" }}
              onRetry={props.onRetry}
            />
          ) : data ? (
            <VotingLogisticsSection status="ready" data={data} />
          ) : null}
        </ScrollView>
      </View>
    );
  }
  const addressSummary = !editing && !!props.address && (
    <View style={[s.addressRow, fontScale > 1.3 && s.stackedRow]}>
      {fontScale <= 1.3 && <Icon name="pin" size={20} color={P.primary} />}
      <View style={s.flex}>
        <Text style={s.addressLabel}>VOTING ADDRESS</Text>
        <Text style={s.addressText}>{props.address}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit voting address: ${props.address}`}
        onPress={() => {
          setChoosingElection(false);
          setEditing(true);
        }}
        style={[s.textButton, s.editButton]}
      >
        <Text style={s.linkText}>Edit</Text>
      </Pressable>
    </View>
  );
  return (
    <View style={s.screen}>
      <NavHeader
        key={fontScale}
        title=""
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />
      <ScrollView
        key="ballot"
        contentOffset={{ x: 0, y: ballotOffset }}
        onScroll={(event) => {
          ballotScroll.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={s.pageTitle}>
          Your ballot
        </Text>
        {mismatch && (
          <Card style={s.card}>
            <Text accessibilityRole="header" style={s.contestTitle}>
              Selected ballot unavailable
            </Text>
            <Text accessibilityRole="alert" style={s.body}>
              The provider returned a different election. Choose another
              election or try again to get the ballot you selected.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={props.onRetry}
              style={s.primaryButton}
            >
              <Text style={s.primaryText}>Try again</Text>
            </Pressable>
          </Card>
        )}
        {editing ? (
          <Card style={s.form}>
            <Text accessibilityRole="header" style={s.electionTitle}>
              Find your ballot
            </Text>
            <Text style={s.secondary}>
              Enter the address where you’re registered to vote.
            </Text>
            <Text style={s.actionText}>Voting address</Text>
            <TextInput
              ref={addressInput}
              accessibilityLabel="Voting address"
              placeholder="Street, city, state, ZIP"
              placeholderTextColor={P.quiet}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              returnKeyType="search"
              autoFocus={!!props.address}
              style={[s.input, invalid && s.invalidInput]}
            />
            {invalid && (
              <Text accessibilityRole="alert" style={s.errorText}>
                {draft.trim().length > 300
                  ? "Keep your address under 300 characters."
                  : "Enter a street address, city, state and ZIP code."}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              style={s.primaryButton}
            >
              <Text style={s.primaryText}>Look up ballot</Text>
            </Pressable>
            {!!props.address && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setDraft(props.address);
                  setInvalid(false);
                  setEditing(false);
                }}
                style={s.textButton}
              >
                <Text style={s.actionText}>Cancel editing</Text>
              </Pressable>
            )}
          </Card>
        ) : (
          !props.failed && addressSummary
        )}
        {editing && (
          <SourceLink
            label="Find your election office"
            url="https://www.usa.gov/state-election-office"
          />
        )}
        {props.loading && (
          <View accessibilityLiveRegion="polite" style={s.loading}>
            <ActivityIndicator color={P.spark} />
            <Text style={s.body}>Looking up your ballot…</Text>
          </View>
        )}
        {!!model?.election && (
          <View style={s.electionHeader}>
            <Text accessibilityRole="header" style={s.electionTitle}>
              {model.election.name}
            </Text>
            <View style={[s.electionMeta, fontScale > 1.3 && s.stackedRow]}>
              <Text style={s.body}>
                {ballotElectionDate(model.election.electionDay)}
              </Text>
              {elections.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change election"
                  accessibilityState={{ expanded: choosingElection }}
                  onPress={() => setChoosingElection(!choosingElection)}
                  style={s.textButton}
                >
                  <Text style={s.linkText}>
                    {choosingElection ? "Close choices" : "Change election"}
                  </Text>
                  <Icon
                    name={choosingElection ? "chevD" : "chevR"}
                    size={14}
                    color={P.inkOnNight}
                  />
                </Pressable>
              )}
            </View>
          </View>
        )}
        {!editing &&
          !props.loading &&
          !props.failed &&
          !model?.election &&
          elections.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: choosingElection }}
              onPress={() => setChoosingElection(!choosingElection)}
              style={s.textButton}
            >
              <Text style={s.linkText}>
                {choosingElection
                  ? "Close choices"
                  : mismatch
                    ? "Change election"
                    : "Choose election"}
              </Text>
            </Pressable>
          )}
        {!editing &&
          !props.loading &&
          !props.failed &&
          elections.length > 0 &&
          choosingElection && (
            <View style={s.choices}>
              <Text accessibilityRole="header" style={s.eyebrow}>
                Elections for this address
              </Text>
              {elections.map((election) => (
                <Pressable
                  key={election.id}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: model?.election?.id === election.id,
                  }}
                  onPress={() => {
                    setChoosingElection(false);
                    setVotingExpanded(false);
                    props.onElection(election.id);
                  }}
                  style={s.electionOption}
                >
                  <View style={s.flex}>
                    <Text style={s.actionText}>{election.name}</Text>
                    <Text style={s.secondary}>
                      {ballotElectionDate(election.electionDay)}
                    </Text>
                  </View>
                  {model?.election?.id === election.id && (
                    <Text style={s.secondary}>Selected</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        {evidence && !hasContests && (
          <BallotStatusNotice
            evidence={evidence}
            officialOfficeUrl={officeUrl}
            onRetry={props.onRetry}
          />
        )}
        {!editing && props.failed && addressSummary}
        {model && data && (
          <>
            {data.provider?.addressScope === "statewide_only" && (
              <View style={s.coverageNotice}>
                <Text accessibilityRole="header" style={s.actionText}>
                  Statewide contests only
                </Text>
                <Text style={s.secondary}>
                  Local races and measures may be missing from this result.
                </Text>
              </View>
            )}
            {data.provider?.addressScope === "unknown" && (
              <View style={s.coverageNotice}>
                <Text accessibilityRole="header" style={s.actionText}>
                  Address coverage unconfirmed
                </Text>
                <Text style={s.secondary}>
                  Billion cannot confirm that this result includes the contests
                  for your address.
                </Text>
              </View>
            )}
            {hasSupport && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How to vote"
                accessibilityHint="Opens voting information"
                onPress={() => {
                  setBallotOffset(ballotScroll.current);
                  setVotingExpanded(true);
                }}
                style={s.votingEntry}
              >
                <View style={s.iconTile}>
                  <Icon name="vote" size={22} color={P.primary} />
                </View>
                <View style={s.flex}>
                  <Text style={s.entryTitle}>How to vote</Text>
                  <Text style={s.secondary}>
                    {model.election
                      ? "Voting resources for this election"
                      : "Find voting resources"}
                  </Text>
                </View>
                <Icon name="chevR" size={18} color={P.inkOnNight} />
              </Pressable>
            )}
            {!!model.contests.length && (
              <>
                <Text style={s.coverage}>
                  {model.contests.length}{" "}
                  {model.contests.length === 1 ? "contest" : "contests"} ·
                  Coverage may be incomplete
                </Text>
                {model.contests.map((contest, index) => (
                  <ContestCard
                    key={`${model.election?.id ?? "unknown"}:${index}`}
                    contest={contest}
                  />
                ))}
              </>
            )}
            {hasSupport && (
              <View style={s.support}>
                <BallotLanguages items={[]} showRecovery={false} />
                {hasContests && !votingExpanded && (
                  <View style={s.confirm}>
                    <Text style={s.secondary}>
                      Check your complete ballot and current voting details with
                      your election office.
                    </Text>
                    <SourceLink
                      label={
                        officeUrl
                          ? "Visit election office"
                          : "Find your election office"
                      }
                      url={
                        officeUrl ?? "https://www.usa.gov/state-election-office"
                      }
                    />
                  </View>
                )}
              </View>
            )}
            {data.provider && (
              <View style={s.provider}>
                <Text style={s.secondary}>
                  Ballot data from Democracy Works. Coverage is partial.
                </Text>
                {data.provider.sourceUrl && (
                  <SourceLink
                    label="View ballot data source"
                    url={data.provider.sourceUrl}
                  />
                )}
              </View>
            )}
            {model.isCalifornia &&
              model.election &&
              (props.renderCaliforniaResults ? (
                props.renderCaliforniaResults(data)
              ) : (
                <ElectionResultsSection
                  contests={model.contests}
                  electionDay={model.election.electionDay}
                  electionName={model.election.name}
                />
              ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: 16, gap: 12 },
  card: { gap: 10, borderRadius: 14, padding: 16 },
  provider: { paddingTop: 12, gap: 4 },
  coverageNotice: {
    borderLeftWidth: 3,
    borderLeftColor: P.spark,
    paddingLeft: 12,
    gap: 6,
  },
  withdrawn: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: P.inkOnNight,
  },
  form: { gap: 16, padding: 16, borderRadius: 16 },
  pageTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    color: P.inkOnNight,
  },
  electionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 22.5,
    color: P.inkOnNight,
  },
  entryTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  votingEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  electionHeader: { gap: 4, paddingTop: 4 },
  electionMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stackedRow: { flexDirection: "column", alignItems: "flex-start", gap: 0 },
  textButton: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editButton: {
    backgroundColor: P.canvas,
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  linkText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: P.primary,
    flexShrink: 1,
  },
  coverage: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
    opacity: 0.75,
    marginBottom: 2,
  },
  choices: {
    padding: 12,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: 10,
    gap: 4,
  },
  support: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.cardBorder,
  },
  confirm: { paddingTop: 20, gap: 4 },
  invalidInput: { borderColor: P.spark },
  errorText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    color: P.spark,
  },
  flex: { flex: 1, gap: 4 },
  eyebrow: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: P.inkOnNight,
  },
  contestTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  secondary: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
    opacity: 0.8,
  },
  actionText: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.inkOnNight,
    flexShrink: 1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  addressLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1,
    color: P.inkOnNight,
    opacity: 0.8,
  },
  addressText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  primaryButton: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    backgroundColor: P.inkOnNight,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fontBody.bold, fontSize: 16, color: P.canvas },
  input: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: P.quiet,
    borderRadius: 12,
    fontFamily: fontBody.regular,
    fontSize: 16,
    color: P.inkOnNight,
  },
  loading: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  electionOption: {
    minHeight: 48,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  candidate: {
    paddingVertical: 6,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.cardBorder,
  },
  candidateName: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  disclosure: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  details: { gap: 12, paddingTop: 8 },
});
