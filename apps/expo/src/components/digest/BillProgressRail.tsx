import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontBody, DigestPalette as P } from "~/styles";
import { billProgressFromStatus, stageIsReached } from "~/utils/bill-progress";

export function BillProgressRail({
  status,
  jurisdiction,
  compact = false,
  updatedLabel,
}: {
  status?: string | null;
  jurisdiction?: string | null;
  compact?: boolean;
  updatedLabel?: string;
}) {
  if (!status) return null;

  const progress = billProgressFromStatus(status, jurisdiction);

  return (
    <View
      style={compact ? s.compact : s.full}
      accessibilityRole="text"
      accessibilityLabel={[
        progress.stages
          .map((stage) => {
            const filled = stageIsReached(progress, stage.id);
            const here = progress.current === stage.id;
            return `${stage.label}${filled ? ", reached" : ""}${here ? ", current" : ""}`;
          })
          .join(". "),
        updatedLabel,
      ]
        .filter(Boolean)
        .join(". ")}
    >
      <View style={s.row}>
        {progress.stages.map((stage, index) => {
          const filled = stageIsReached(progress, stage.id);
          const here = progress.current === stage.id;
          return (
            <Fragment key={stage.id}>
              {index > 0 ? (
                <View style={[s.rule, filled ? s.ruleOn : null]} />
              ) : null}
              <View
                style={[
                  compact ? s.dotSm : s.dot,
                  filled ? s.dotOn : null,
                  here && !filled ? s.dotHere : null,
                ]}
              />
            </Fragment>
          );
        })}
      </View>
      {compact ? null : (
        <View style={s.labels}>
          {progress.stages.map((stage) => (
            <Text
              key={stage.id}
              style={[
                s.label,
                stageIsReached(progress, stage.id) ||
                progress.current === stage.id
                  ? s.labelOn
                  : null,
              ]}
              numberOfLines={1}
            >
              {stage.label}
            </Text>
          ))}
        </View>
      )}
      {updatedLabel ? <Text style={s.updated}>{updatedLabel}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  compact: {
    marginTop: 10,
    marginBottom: 4,
  },
  full: {
    marginTop: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(247,244,238,0.18)",
    marginHorizontal: 6,
  },
  ruleOn: {
    backgroundColor: P.spark,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: P.quiet,
    backgroundColor: "transparent",
  },
  dotSm: {
    width: 6,
    height: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: P.quiet,
    backgroundColor: "transparent",
  },
  dotOn: {
    borderColor: P.spark,
    backgroundColor: P.spark,
  },
  dotHere: {
    borderColor: P.spark,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  label: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    letterSpacing: 0.2,
    color: P.quiet,
  },
  labelOn: {
    color: P.inkOnNight,
  },
  updated: {
    marginTop: 8,
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: P.quiet,
  },
});
