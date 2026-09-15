import type { ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";
import {
  ballotElectionOptions,
  ballotModel,
  ballotWebUrl,
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
  /** #330 source/status and #331 logistics receive this exact election response. */
  renderSourceStatus?: (
    state: Pick<
      BallotLookupViewProps,
      "data" | "loading" | "failed" | "address" | "onRetry"
    >,
  ) => ReactNode;
  renderLogistics?: (data: BallotResponse) => ReactNode;
  /** Optional renderer for fixture verification without contacting the CA feed. */
  renderCaliforniaResults?: (data: BallotResponse) => ReactNode;
}

export function BallotLookupView(props: BallotLookupViewProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.address);
  const [linkFailed, setLinkFailed] = useState(false);
  const model = props.data ? ballotModel(props.data) : undefined;
  const elections = ballotElectionOptions(props.discovery, props.data);
  const submit = () => {
    if (draft.trim()) props.onAddress(draft.trim());
  };
  const open = (url: string | undefined) => {
    if (!url) return;
    setLinkFailed(false);
    void Linking.openURL(url).catch(() => setLinkFailed(true));
  };
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
          accessibilityLabel="Voting address"
          placeholder="Street, city, state, ZIP"
          placeholderTextColor={P.quiet}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="search"
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !draft.trim() }}
          disabled={!draft.trim()}
          onPress={submit}
          style={s.button}
        >
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
        {props.renderSourceStatus?.(props)}
        {!props.renderSourceStatus && props.failed && (
          <View style={s.section}>
            <Text accessibilityRole="alert" style={s.body}>
              We couldn’t retrieve this ballot. Check the address or try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={props.onRetry}
              style={s.button}
            >
              <Text style={s.link}>Try again</Text>
            </Pressable>
          </View>
        )}
        {model && props.data && (
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
                The information below belongs to the address and election shown.
                Confirm your ballot with your election office.
              </Text>
            </View>
            {!props.renderSourceStatus && model.empty && (
              <Text style={s.body}>
                No contests were returned for this lookup. This does not
                establish whether a ballot has been published or whether you are
                eligible to vote.
              </Text>
            )}
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
                  <Text key={i} style={s.body}>
                    {candidate.name}
                    {candidate.party ? ` · ${candidate.party}` : ""}
                  </Text>
                ))}
                {ballotWebUrl(contest.referendumUrl) && (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => open(ballotWebUrl(contest.referendumUrl))}
                    style={s.button}
                  >
                    <Text style={s.link}>Measure source</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {props.renderLogistics?.(props.data)}
            {/* Existing California results self-hide outside their results season. */}
            {model.isCalifornia &&
              model.election &&
              (props.renderCaliforniaResults ? (
                props.renderCaliforniaResults(props.data)
              ) : (
                <ElectionResultsSection
                  contests={model.contests}
                  electionDay={model.election.electionDay}
                  electionName={model.election.name}
                />
              ))}
            {props.data.state?.map((region, index) => (
              <View key={index} style={s.section}>
                <Text style={s.heading}>{region.name} election office</Text>
                {[region, region.localJurisdiction].map((area, i) => {
                  const url = ballotWebUrl(
                    area?.electionAdministrationBody?.electionInfoUrl,
                  );
                  return url ? (
                    <Pressable
                      key={i}
                      accessibilityRole="link"
                      onPress={() => open(url)}
                      style={s.button}
                    >
                      <Text style={s.link}>
                        {area?.name}: official election information
                      </Text>
                    </Pressable>
                  ) : null;
                })}
              </View>
            ))}
          </>
        )}
        {linkFailed && (
          <Text accessibilityRole="alert" style={s.body}>
            This link could not be opened. Please try again.
          </Text>
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
