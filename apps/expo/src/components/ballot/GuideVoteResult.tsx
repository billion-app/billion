import { StyleSheet, View } from "react-native";
import { useIsFocused } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { fontBody, DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";

type Snapshot = RouterOutputs["civic"]["getCaliforniaGuideResults"];
type Reported = Extract<Snapshot, { status: "reported" }>;
export type GuideVote =
  | Reported["candidates"][string]
  | Reported["measures"][string];

export function useGuideVoteLabel(
  result: GuideVote | undefined,
  status: Snapshot["status"] | "loading",
  accessible = false,
) {
  const { t, language } = useAppTranslation();
  const percent = (value: number) =>
    `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)}%`;
  const count = (value: number) =>
    new Intl.NumberFormat(language).format(value);
  if (!result)
    return t(
      status === "pending"
        ? "Results pending"
        : status === "loading"
          ? "Checking results…"
          : "Results unavailable",
    );
  if (!result.totalVotes) return t("No votes counted yet");
  if ("yes" in result) {
    const label = `${t("Yes")} ${percent(result.yes.share)} · ${t("No")} ${percent(result.no.share)} · ${t(result.yes.standing === "tied" ? "Tied" : result.yes.standing === "leading" ? "Yes is ahead" : "No is ahead")}`;
    return accessible
      ? `${label}. ${t("Yes")} ${count(result.yes.votes)}, ${t("No")} ${count(result.no.votes)}. ${result.reportingLabel}. ${new Date(result.reportedAt).toLocaleString(language)}`
      : label;
  }
  const label = `${percent(result.share)} · ${t("{count} votes", { count: count(result.votes) })}${result.standing === "leading" ? ` · ${t("Leading")}` : result.standing === "tied" ? ` · ${t("Tied")}` : ` · ${t("{rank} of {total}", { rank: result.rank, total: result.fieldSize })}`}`;
  return accessible
    ? `${label}. ${result.reportingLabel}. ${new Date(result.reportedAt).toLocaleString(language)}`
    : label;
}

export function GuideVoteResult({
  result,
  status,
}: {
  result?: GuideVote;
  status: Snapshot["status"] | "loading";
}) {
  const label = useGuideVoteLabel(result, status);
  const { language } = useAppTranslation();
  return (
    <View style={s.container} accessible={false}>
      {result && result.totalVotes > 0 && (
        <View
          style={[
            s.track,
            "yes" in result && result.no.standing === "leading"
              ? { backgroundColor: P.spark }
              : undefined,
          ]}
          accessible={false}
        >
          <View
            style={[
              s.fill,
              {
                width: `${"yes" in result ? result.yes.share : result.share}%`,
                backgroundColor: (
                  "yes" in result
                    ? result.yes.standing === "leading"
                    : result.standing === "leading"
                )
                  ? P.spark
                  : P.quiet,
              },
            ]}
          />
        </View>
      )}
      <Text style={s.label}>{label}</Text>
      {result && (
        <Text style={s.timestamp}>
          {new Date(result.reportedAt).toLocaleString(language, {
            timeZone: "America/Los_Angeles",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </Text>
      )}
    </View>
  );
}
export function GuideVoteDetails({
  electionDate,
  candidateKey,
}: {
  electionDate: string;
  candidateKey: string;
}) {
  const { t } = useAppTranslation();
  const focused = useIsFocused();
  const query = useQuery(
    trpc.civic.getCaliforniaGuideResults.queryOptions(undefined, {
      staleTime: 60_000,
      enabled: focused,
      refetchInterval: focused ? 60_000 : false,
    }),
  );
  const snapshot =
    !query.isError && query.data?.electionDate === electionDate
      ? query.data
      : undefined;
  const result =
    snapshot?.status === "reported"
      ? snapshot.candidates[candidateKey]
      : undefined;
  return (
    <View style={{ gap: 8 }}>
      <GuideVoteResult
        result={result}
        status={
          snapshot?.status ?? (query.isPending ? "loading" : "unavailable")
        }
      />
      <SourceLink
        label={t("Official election results")}
        url={result?.sourceUrl ?? "https://electionresults.sos.ca.gov/"}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 5, marginTop: 5 },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: `${P.quiet}55`,
  },
  fill: { height: 4 },
  label: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  timestamp: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
});
