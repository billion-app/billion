import { StyleSheet, View } from "react-native";
import { useIsFocused } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { GuideListStamp } from "./guide-list-stamp";
import type { RouterOutputs } from "~/utils/api";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { usePollVisibility } from "~/hooks/usePollVisibility";
import { fontBody, DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";
import { resultsReported } from "./guide-list-stamp";

type Snapshot = RouterOutputs["civic"]["getCaliforniaGuideResults"];
type Reported = Extract<Snapshot, { status: "reported" }>;
export type GuideVote =
  | Reported["candidates"][string]
  | Reported["measures"][string];

/** `row` is the short Elections tab line; `spoken` adds votes, reporting and time. */
type VoteLabelForm = "full" | "row" | "spoken";

export function formatReportedAt(iso: string, language: string) {
  return new Date(iso).toLocaleString(language, {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function useGuideVoteLabel(
  result: GuideVote | undefined,
  status: Snapshot["status"] | "loading",
  form: VoteLabelForm = "full",
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
    if (form === "row")
      return result.yes.standing === "tied"
        ? t("Tied")
        : result.yes.standing === "leading"
          ? `${t("Yes")} ${percent(result.yes.share)} · ${t("ahead")}`
          : `${t("No")} ${percent(result.no.share)} · ${t("ahead")}`;
    const label = `${t("Yes")} ${percent(result.yes.share)} · ${t("No")} ${percent(result.no.share)} · ${t(result.yes.standing === "tied" ? "Tied" : result.yes.standing === "leading" ? "Yes is ahead" : "No is ahead")}`;
    return form === "spoken"
      ? `${label}. ${t("Yes")} ${count(result.yes.votes)}, ${t("No")} ${count(result.no.votes)}. ${result.reportingLabel}. ${new Date(result.reportedAt).toLocaleString(language)}`
      : label;
  }
  if (form === "row")
    return result.standing === "leading"
      ? `${percent(result.share)} · ${t("Leading")}`
      : result.standing === "tied"
        ? `${percent(result.share)} · ${t("Tied")}`
        : percent(result.share);
  const label = `${percent(result.share)} · ${t("{count} votes", { count: count(result.votes) })}${result.standing === "leading" ? ` · ${t("Leading")}` : result.standing === "tied" ? ` · ${t("Tied")}` : ` · ${t("{rank} of {total}", { rank: result.rank, total: result.fieldSize })}`}`;
  return form === "spoken"
    ? `${label}. ${result.reportingLabel}. ${new Date(result.reportedAt).toLocaleString(language)}`
    : label;
}

/**
 * `row` drops the results label and timestamp because the Elections tab
 * states them once for the whole list.
 */
export function GuideVoteResult({
  result,
  status,
  variant = "full",
}: {
  result?: GuideVote;
  status: Snapshot["status"] | "loading";
  variant?: "full" | "row";
}) {
  const label = useGuideVoteLabel(result, status, variant);
  const { language, t } = useAppTranslation();
  const full = variant === "full";
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
      {full && result && result.totalVotes > 0 && (
        <Text style={s.timestamp}>{t("Reported results")}</Text>
      )}
      <Text style={s.label}>{label}</Text>
      {full && result && (
        <Text style={s.timestamp}>
          {formatReportedAt(result.reportedAt, language)}
        </Text>
      )}
    </View>
  );
}
const POLL_NOTE = {
  loading: "Checking polls…",
  unavailable: "Polling unavailable",
  none: "No polls in our sources",
  other: "No other polls in our sources",
} as const;

export function GuideListStampLine({ stamp }: { stamp: GuideListStamp }) {
  const { t, language } = useAppTranslation();
  const time =
    stamp.results && formatReportedAt(stamp.results.reportedAt, language);
  const polls = stamp.polls && t(POLL_NOTE[stamp.polls]);
  return (
    <Text
      style={s.timestamp}
      accessibilityLabel={[
        stamp.results &&
          [t("Reported results"), stamp.results.reportingLabel, time]
            .filter(Boolean)
            .join(", "),
        polls,
      ]
        .filter(Boolean)
        .join(". ")}
    >
      {[stamp.results && `${t("Reported results")} · ${time}`, polls]
        .filter(Boolean)
        .join(" · ")}
    </Text>
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
  const { showPolls } = usePollVisibility();
  const focused = useIsFocused();
  const query = useQuery(
    trpc.civic.getCaliforniaGuideStandings.queryOptions(undefined, {
      staleTime: 60_000,
      enabled: focused,
      refetchInterval: focused ? 60_000 : false,
    }),
  );
  const snapshot =
    !query.isError && query.data?.electionDate === electionDate
      ? query.data
      : undefined;
  const standing = snapshot?.candidates[candidateKey];
  const result = standing?.kind === "official" ? standing.result : undefined;
  return (
    <View style={{ gap: 8 }}>
      {result ? (
        <GuideVoteResult result={result} status="reported" />
      ) : showPolls && !resultsReported(snapshot) ? (
        <Text style={s.label}>
          {t(
            query.isPending
              ? "Checking polls…"
              : query.isError || !snapshot || !standing
                ? "Polling unavailable"
                : "No poll available in our sources",
          )}
        </Text>
      ) : null}
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
