import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { BallotResponse } from "~/utils/ballot-lookup";
import {
  BallotLanguages,
  BallotSources,
  BallotStatusNotice,
} from "~/components/ballot-evidence/BallotEvidence";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";
import {
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

export function BallotLookupView(props: BallotLookupViewProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.address);
  const [invalid, setInvalid] = useState(false);
  const addressInput = useRef<TextInput>(null);
  // Suppress cached data during every transition, including a failed/invalid lookup.
  const data =
    props.loading || props.failed || invalid ? undefined : props.data;
  const model = data ? ballotModel(data) : undefined;
  const elections = ballotElectionOptions(props.discovery, data);
  const submit = () => {
    const valid = validateBallotAddress(draft);
    setInvalid(!valid);
    if (valid) props.onAddress(draft.trim());
  };
  const officeUrl = data ? ballotOfficeUrl(data) : undefined;
  const evidence = invalid
    ? { kind: "invalid-input" as const }
    : props.failed
      ? { kind: "provider-failure" as const }
      : !props.loading && props.settled
        ? {
            kind: "result" as const,
            electionKnown: !!model?.election,
            contestCount: model?.contests.length ?? 0,
          }
        : undefined;
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={s.button}
        >
          <Text style={s.link}>Back</Text>
        </Pressable>
        <Text style={s.title}>Your ballot</Text>
        <Text style={s.body}>
          Look up the ballot information available for your voting address.
          Coverage varies by election and location.
        </Text>
        <TextInput
          ref={addressInput}
          accessibilityLabel="Voting address"
          placeholder="Street, city, state, ZIP"
          placeholderTextColor={P.quiet}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="search"
          style={s.input}
        />
        <Pressable accessibilityRole="button" onPress={submit} style={s.button}>
          <Text style={s.link}>Look up ballot</Text>
        </Pressable>
        {elections.length > 1 && (
          <View style={s.section}>
            <Text style={s.heading}>Elections for this address</Text>
            {elections.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityState={{ selected: model?.election?.id === e.id }}
                onPress={() => props.onElection(e.id)}
                style={s.button}
              >
                <Text style={s.link}>
                  {e.name} · {e.electionDay}
                  {model?.election?.id === e.id ? " · Selected" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {props.loading && (
          <ActivityIndicator
            accessibilityLabel="Looking up ballot"
            color={P.spark}
          />
        )}
        {evidence && (
          <BallotStatusNotice
            evidence={evidence}
            officialOfficeUrl={officeUrl}
            onRetry={
              invalid ? () => addressInput.current?.focus() : props.onRetry
            }
          />
        )}
        {invalid && (
          <Text accessibilityRole="alert" style={s.body}>
            Enter an address between 5 and 300 characters.
          </Text>
        )}
        {data?.election &&
          props.requestedElectionId &&
          data.election.id !== props.requestedElectionId && (
            <Text accessibilityRole="alert" style={s.body}>
              The provider returned a different election. Showing{" "}
              {data.election.name} (ID {data.election.id}), not the requested
              election (ID {props.requestedElectionId}).
            </Text>
          )}
        {model && data && (
          <>
            <View style={s.section}>
              <Text style={s.heading}>
                {model.election?.name ?? "Election information"}
              </Text>
              {model.election?.electionDay && (
                <Text style={s.body}>
                  Election day: {model.election.electionDay}
                </Text>
              )}
              <Text style={s.body}>
                Confirm the returned information and your complete ballot with
                your election office.
              </Text>
            </View>
            {model.contests.map((contest, index) => (
              <View key={index} style={s.section}>
                <Text style={s.heading}>
                  {contest.referendumTitle ??
                    contest.office ??
                    "Ballot contest"}
                </Text>
                {!!contest.district?.name && (
                  <Text style={s.body}>{contest.district.name}</Text>
                )}
                {!!contest.referendumSubtitle && (
                  <Text style={s.body}>{contest.referendumSubtitle}</Text>
                )}
                {!!contest.referendumText && (
                  <Text style={s.body}>{contest.referendumText}</Text>
                )}
                {contest.candidates?.map((candidate, i) => (
                  <View key={i} style={{ gap: 8 }}>
                    <Text style={s.body}>
                      {candidate.name}
                      {candidate.party ? ` · ${candidate.party}` : ""}
                    </Text>
                    {!!candidate.citations?.length && (
                      <BallotSources
                        citations={candidate.citations}
                        contentKind="citations"
                      />
                    )}
                  </View>
                ))}
                <BallotSources
                  citations={contestBallotCitations(contest)}
                  contentKind="source"
                />
              </View>
            ))}
            <BallotLanguages items={[]} officialOfficeUrl={officeUrl} />
            <Text style={s.heading}>Address-specific voting information</Text>
            <VotingLogisticsSection status="ready" data={data} />
            {/* Existing California results self-hide outside their results season. */}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: 24, gap: 16 },
  section: { gap: 12, paddingVertical: 12 },
  title: { fontFamily: fontDisplay.bold, fontSize: 32, color: P.inkOnNight },
  heading: { fontFamily: fontDisplay.bold, fontSize: 22, color: P.inkOnNight },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  link: { fontFamily: fontBody.semibold, fontSize: 16, color: P.spark },
  button: { minHeight: 44, justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderColor: P.quiet,
    padding: 12,
    borderRadius: 8,
    color: P.inkOnNight,
    fontSize: 16,
  },
});
