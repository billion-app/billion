import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { VotingLogisticsData } from "~/utils/voting-logistics";
import type { PlanMethod } from "~/utils/voting-plan";
import {
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card, Segmented } from "~/components/ui";
import { fontBody, fontEditorial, sp, useTheme } from "~/styles";
import {
  planStorageKey,
  readPlanMethod,
  registrationCheck,
} from "~/utils/voting-plan";

const ca = "https://www.sos.ca.gov/elections";

/** Routing and personal intent only. Sourced dates/locations stay in VotingLogisticsSection. */
export function VotingPlanSection({
  election,
  data,
  california = false,
}: {
  election?: {
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  };
  data?: VotingLogisticsData;
  california?: boolean;
}) {
  const key = election ? planStorageKey(election) : undefined;
  // Remount state when the election changes; an old storage read cannot leak into it.
  return (
    <Plan
      key={key ?? "unknown"}
      storageKey={key}
      electionName={election?.name}
      data={data}
      california={california}
    />
  );
}

function Plan({
  storageKey,
  electionName,
  data,
  california,
}: {
  storageKey?: string;
  electionName?: string;
  data?: VotingLogisticsData;
  california: boolean;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [method, setMethod] = useState<PlanMethod>("undecided");
  const [loaded, setLoaded] = useState(!storageKey);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    void AsyncStorage.getItem(storageKey).then(
      (raw) => {
        if (active) {
          setMethod(readPlanMethod(raw));
          setLoaded(true);
        }
      },
      () => {
        if (active) {
          setLoaded(true);
          setStorageFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [storageKey]);
  const writeQueue = useRef(Promise.resolve());
  function choose(value: PlanMethod) {
    setMethod(value);
    if (storageKey)
      writeQueue.current = writeQueue.current
        .then(() => AsyncStorage.setItem(storageKey, value))
        .then(
          () => setStorageFailed(false),
          () => setStorageFailed(true),
        );
  }
  const body = [s.body, { color: theme.textSecondary }];
  const heading = [s.heading, { color: theme.foreground }];
  const check = registrationCheck(data);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.open}
      >
        <Text style={heading}>Make your voting plan</Text>
        <Text style={body}>
          {expanded ? "Hide steps" : "Registration → voting method → deadlines"}
        </Text>
      </Pressable>
      {expanded && (
        <View style={s.steps}>
          <Text style={body}>
            {electionName ?? "Choose an election to save a plan."} This plan is
            a personal reminder, not verification of registration or
            eligibility.
          </Text>
          <View style={s.step}>
            <Text accessibilityRole="header" style={heading}>
              1. Check registration
            </Text>
            <Text style={body}>
              First time voting, already registered, or unsure? Check with the
              official service before making your plan.
            </Text>
            {check ? (
              <>
                <Text style={body}>{check.name}</Text>
                <SourceLink label="Check registration" url={check.url} />
              </>
            ) : california ? (
              <SourceLink
                label="Check registration · California Secretary of State"
                url="https://voterstatus.sos.ca.gov/EN/Authenticate"
              />
            ) : (
              <ElectionOfficeLink />
            )}
            {california && (
              <SourceLink
                label="Registration application and requirements · California"
                url={`${ca}/voter-registration`}
              />
            )}
          </View>
          <View style={s.step}>
            <Text accessibilityRole="header" style={heading}>
              2. Check primary eligibility
            </Text>
            <Text style={body}>
              For a primary, ask the election office which contests you can vote
              in, whether party enrollment matters, and whether you need to
              request a different ballot. Confirm any party enrollment or ballot
              request deadline separately.
            </Text>
            {california ? (
              <SourceLink
                label="Primary voting rules · California Secretary of State"
                url={`${ca}/primary-elections-california`}
              />
            ) : (
              <ElectionOfficeLink />
            )}
          </View>
          <View style={s.step}>
            <Text accessibilityRole="header" style={heading}>
              3. Choose how you want to vote
            </Text>
            <Text style={body}>
              Confirm that your election office offers your preferred method for
              this election. Missing locations do not mean a method is
              unavailable.
            </Text>
            {loaded ? (
              <Segmented<PlanMethod>
                value={method}
                onChange={choose}
                options={[
                  { id: "undecided", label: "Unsure" },
                  { id: "mail", label: "By mail" },
                  { id: "in-person", label: "In person" },
                ]}
              />
            ) : (
              <Text style={body}>Loading your saved choice…</Text>
            )}
            <Text accessibilityLiveRegion="polite" style={body}>
              {storageFailed
                ? "Couldn’t save on this device. Your choice may be lost when you leave."
                : storageKey
                  ? "Your method preference stays on this device for this election only."
                  : "Choose an election before saving a method preference."}
            </Text>
            {method === "mail" && (
              <Text style={body}>
                Confirm ballot request, postmark and receipt deadlines
                separately, plus return instructions.
              </Text>
            )}
            {method === "in-person" && (
              <Text style={body}>
                Confirm your voting location, early-voting dates or Election Day
                hours, and what to bring.
              </Text>
            )}
            {california ? (
              <SourceLink
                label="Voting methods and requirements · California Secretary of State"
                url={`${ca}/voting-resources/voting-california`}
              />
            ) : (
              <ElectionOfficeLink />
            )}
          </View>
          <View style={s.step}>
            <Text accessibilityRole="header" style={heading}>
              4. Confirm dates and locations
            </Text>
            <Text style={body}>
              Use sourced dates and locations when available in your ballot
              lookup. Ask your election office about any missing registration,
              party enrollment, ballot request, postmark, receipt, early-voting
              or Election Day details.
            </Text>
            {california ? (
              <SourceLink
                label="Find your county elections office · California"
                url={`${ca}/voting-resources/county-elections-offices`}
              />
            ) : (
              <ElectionOfficeLink />
            )}
            {california && method === "mail" && (
              <SourceLink
                label="Track a mail ballot · California Secretary of State"
                url={`${ca}/ballot-status/wheres-my-ballot`}
              />
            )}
            <Text style={body}>
              Billion cannot check registration or track a ballot. These links
              open the authority’s service. Return to Billion to continue here
              with the same election and ballot view.
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}
const s = StyleSheet.create({
  open: { minHeight: 44, gap: sp[2], paddingVertical: sp[2] },
  steps: { gap: sp[5], paddingTop: sp[3] },
  step: { gap: sp[3] },
  heading: { fontFamily: fontEditorial.bold, fontSize: 19, lineHeight: 26 },
  body: { fontFamily: fontBody.regular, fontSize: 15, lineHeight: 23 },
});
