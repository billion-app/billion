import { StyleSheet, View } from "react-native";

import { Text } from "~/components/Themed";
import { Card, GhostButton, Kicker, PrimaryButton } from "~/components/ui";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";

export interface BillEvidenceRecord {
  billNumber: string;
  jurisdiction: string;
  congress?: number;
  chamber?: string;
  sponsor?: string;
  introducedDate?: string;
  status?: string;
  statusAsOf?: string;
  latestAction?: {
    date: string;
    text: string;
    type?: string;
  };
  officialTextUrl: string;
  sourceName: string;
  sourceUpdatedAt: string;
}

interface BillEvidenceCardProps {
  evidence: BillEvidenceRecord;
  recordUrl?: string;
  onOpenUrl: (url: string, kind: "official_text" | "bill_record") => void;
}

function exactDate(value?: string): string | undefined {
  return value ? /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0] : undefined;
}

function ordinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function BillEvidenceCard({
  evidence,
  recordUrl,
  onOpenUrl,
}: BillEvidenceCardProps) {
  const introducedDate = exactDate(evidence.introducedDate);
  const statusAsOf = exactDate(
    evidence.statusAsOf ?? evidence.latestAction?.date,
  );
  const sourceUpdatedAt = exactDate(evidence.sourceUpdatedAt);
  const legislature = [
    evidence.congress ? `${ordinal(evidence.congress)} Congress` : undefined,
    evidence.chamber,
  ]
    .filter(Boolean)
    .join(" · ");
  const facts = [
    { label: "Bill", value: evidence.billNumber },
    { label: "Jurisdiction", value: evidence.jurisdiction },
    { label: "Legislature", value: legislature || undefined },
    { label: "Primary sponsor", value: evidence.sponsor },
    { label: "Introduced", value: introducedDate },
  ].filter((fact): fact is { label: string; value: string } => !!fact.value);

  return (
    <View testID="bill-evidence" style={styles.section}>
      <Kicker>Official record</Kicker>
      <Card>
        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>
            {statusAsOf
              ? `CURRENT STATUS · AS OF ${statusAsOf}`
              : "CURRENT STATUS"}
          </Text>
          <Text style={styles.statusValue}>
            {evidence.status ?? "Status unavailable"}
          </Text>
        </View>

        <View style={styles.factList}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.factRow}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text selectable style={styles.factValue}>
                {fact.value}
              </Text>
            </View>
          ))}
        </View>

        {evidence.latestAction ? (
          <View style={styles.latestAction}>
            <Text style={styles.latestActionLabel}>
              LATEST ACTION · {exactDate(evidence.latestAction.date)}
            </Text>
            <Text style={styles.latestActionText}>
              {evidence.latestAction.text}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sourceNote}>
          Source: {evidence.sourceName}
          {sourceUpdatedAt ? ` · Record checked ${sourceUpdatedAt}` : ""}
        </Text>

        <PrimaryButton
          label="Read official text"
          icon="external"
          onPress={() => onOpenUrl(evidence.officialTextUrl, "official_text")}
          style={styles.primaryButton}
        />
        {recordUrl ? (
          <GhostButton
            label="Open full bill record"
            onPress={() => onOpenUrl(recordUrl, "bill_record")}
            style={styles.recordButton}
          />
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 4 },
  statusBlock: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: hair[2],
  },
  statusLabel: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.9,
    color: colors.civicBlue,
    marginBottom: 7,
  },
  statusValue: {
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.white,
  },
  factList: { paddingVertical: 5 },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: hair[1],
  },
  factLabel: {
    width: 98,
    fontFamily: fontBody.semibold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  factValue: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.white,
  },
  latestAction: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hair[2],
    backgroundColor: planes.surface,
  },
  latestActionLabel: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.civicBlue,
    marginBottom: 7,
  },
  latestActionText: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.white,
  },
  sourceNote: {
    marginTop: 13,
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  primaryButton: { marginTop: 16 },
  recordButton: { width: "100%", marginTop: 6 },
});
