import { useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import type { RouterOutputs } from "~/utils/api";
import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { fontBody, DigestPalette as P } from "~/styles";

type Snapshot = RouterOutputs["civic"]["getCaliforniaGuideStandings"];
export type GuidePoll = Extract<Snapshot["governor"], { kind: "poll" }>["poll"];
export function GuidePollResult({
  poll,
  title,
}: {
  poll: GuidePoll;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const { t, language } = useAppTranslation();
  const { report, observation } = poll;
  const percentage = (share: number) =>
    `${new Intl.NumberFormat(language).format(share)}%`;
  const date = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(language, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const choiceLabel = (choice: GuidePoll["observation"]["choices"][number]) => {
    if (choice.kind === "candidate")
      return choice.candidateName ?? choice.label;
    if (choice.kind === "yes") return t("Yes");
    if (choice.kind === "no") return t("No");
    if (choice.kind === "undecided") return t("Undecided");
    return /^neither/i.test(choice.label) ? t("Neither") : choice.label;
  };
  const mainChoices = observation.choices.filter((choice) =>
    ["candidate", "yes", "no"].includes(choice.kind),
  );
  const otherChoices = observation.choices.filter(
    (choice) => !mainChoices.includes(choice),
  );
  const sorted = [...mainChoices].sort((a, b) => b.share - a.share);
  const first = sorted[0];
  const second = sorted[1];
  const gap = first && second ? first.share - second.share : null;
  const notReported = t("Not reported");
  const details = [
    [t("Publisher"), report.publisher],
    [t("Pollster"), report.pollster],
    [t("Sponsor"), report.sponsor ?? notReported],
    [t("Field dates"), `${report.fieldStart} – ${report.fieldEnd}`],
    [t("Published"), report.publishedAt ?? notReported],
    [t("Population"), t("California statewide likely voters")],
    [
      t("Question sample"),
      observation.sampleSize?.toLocaleString(language) ?? notReported,
    ],
    [
      t("Survey likely voters"),
      report.sampleSize?.toLocaleString(language) ?? notReported,
    ],
    [
      t("Survey margin of error"),
      report.marginOfError === null
        ? notReported
        : `±${report.marginOfError} ${t("percentage points")}`,
    ],
    [t("Margin of error scope"), report.marginOfErrorScope ?? notReported],
    [t("Method"), report.methodology ?? notReported],
    [t("Question"), observation.locator],
  ];
  return (
    <View style={s.container}>
      {title && <Text style={s.title}>{title}</Text>}
      <Text style={s.label}>{t("Poll")}</Text>
      {mainChoices.map((choice) => (
        <View
          key={choice.label}
          accessible
          accessibilityLabel={`${choiceLabel(choice)}, ${percentage(choice.share)}, ${t("in this poll")}`}
          style={s.choice}
        >
          <View style={s.choiceLabel}>
            <Text style={s.text}>{choiceLabel(choice)}</Text>
            <Text style={s.text}>{percentage(choice.share)}</Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${choice.share}%` }]} />
          </View>
        </View>
      ))}
      {otherChoices.length > 0 && (
        <Text style={s.note}>
          {otherChoices
            .map(
              (choice) => `${choiceLabel(choice)} ${percentage(choice.share)}`,
            )
            .join(" · ")}
        </Text>
      )}
      {gap !== null && first && (
        <Text style={s.note}>
          {gap === 0
            ? t("Equal in this poll")
            : t("{name} ahead by {points} points in this poll", {
                name: choiceLabel(first),
                points: new Intl.NumberFormat(language, {
                  maximumFractionDigits: 1,
                }).format(gap),
              })}
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("Poll details")}
        onPress={() => setOpen(true)}
        style={s.action}
      >
        <Text style={s.link}>
          {report.publisher} · {date(report.fieldStart)}–{date(report.fieldEnd)}{" "}
          · {t("Poll details")}
        </Text>
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.backdrop}>
          <View accessibilityViewIsModal style={s.sheet}>
            <TouchableOpacity
              accessibilityRole="button"
              style={s.action}
              onPress={() => setOpen(false)}
            >
              <Text style={s.link}>{t("Close")}</Text>
            </TouchableOpacity>
            <ScrollView contentContainerStyle={s.sheetContent}>
              <Text accessibilityRole="header" style={s.title}>
                {t("Poll details")}
              </Text>
              <Text style={s.text}>
                {t("A poll measures opinions. It is not counted votes.")}
              </Text>
              {details.map(([label, value]) => (
                <View key={label} style={s.detail}>
                  <Text style={s.label}>{label}</Text>
                  <Text style={s.text}>{value}</Text>
                </View>
              ))}
              <Text style={s.text}>{observation.questionText}</Text>
              {observation.choices.map((choice) => (
                <Text key={choice.label} style={s.text}>
                  {choice.kind === "candidate"
                    ? choice.label
                    : choiceLabel(choice)}{" "}
                  {percentage(choice.share)}
                </Text>
              ))}
              <Text style={s.note}>
                {t(
                  "Published percentages may total 99% or 101% because of rounding. Bars use the published values.",
                )}
              </Text>
              <TouchableOpacity
                accessibilityRole="link"
                style={s.action}
                onPress={() => void Linking.openURL(report.sourceUrl)}
              >
                <Text style={s.link}>{t("Read the poll source")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 8, padding: 14 },
  title: {
    fontFamily: fontBody.bold,
    fontSize: 21,
    lineHeight: 28,
    color: P.inkOnNight,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  text: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  choice: { gap: 5 },
  choiceLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: `${P.quiet}44`,
    overflow: "hidden",
  },
  fill: { height: 5, backgroundColor: P.linkOnNight },
  action: { minHeight: 44, justifyContent: "center" },
  link: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 20,
    color: P.linkOnNight,
  },
  backdrop: { flex: 1, backgroundColor: "#0009", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: P.card,
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetContent: { padding: 24, paddingBottom: 40, gap: 16 },
  detail: { gap: 3 },
});
