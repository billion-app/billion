import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { IconName } from "~/components/ui/Icon";
import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { financeResearchSource } from "./finance-source";

/** The How to Vote disclosure language, with availability rather than candidate ratings. */
export function CandidateResearchCard({
  title,
  question,
  availability,
  icon,
  children,
}: {
  title: string;
  question: string;
  availability: string;
  icon: IconName;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${question}. ${availability}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [s.header, pressed && { opacity: 0.7 }]}
      >
        <View
          style={s.icon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name={icon} size={18} color={colors.bill} />
        </View>
        <View style={s.headerText}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.question}>{question}</Text>
          <View style={s.status}>
            <Text style={s.statusText}>{availability}</Text>
          </View>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name={open ? "chevD" : "chevR"} size={16} color={P.quiet} />
        </View>
      </Pressable>
      {open && <View style={s.details}>{children}</View>}
    </View>
  );
}

/**
 * Candidate-authored statements stay at the official source. This chapter
 * points readers there and gives scanable questions — it does not reprint the
 * statement or invent priority bullets from it.
 */
export function CandidateStatementChapter({
  attribution,
  sourceLabel,
  sourceUrl,
}: {
  attribution: string;
  sourceLabel?: string;
  sourceUrl?: string;
}) {
  return (
    <View style={s.content}>
      <Text style={s.note}>{attribution}</Text>
      <Text style={s.note}>
        Billion does not reprint the statement here. Open the original and use
        the questions below while you read.
      </Text>
      {sourceUrl && sourceLabel ? (
        <SourceLink label={sourceLabel} url={sourceUrl} prominence="primary" />
      ) : (
        <Text style={s.note}>Statement source link unavailable</Text>
      )}
      <View style={s.research}>
        <Text style={s.label}>QUESTIONS TO TAKE TO THE STATEMENT</Text>
        <Text style={s.body}>What specific change do they say they want?</Text>
        <Text style={s.body}>
          Do they name a timeline, a cost, or who else must agree?
        </Text>
        <Text style={s.body}>
          Which claims have no linked document or outside record behind them?
        </Text>
      </View>
      <Text style={s.note}>
        Candidate-authored statements are advocacy. They are not a checked
        record of past votes or qualifications.
      </Text>
    </View>
  );
}

/** Official filing portals are research resources, not candidate findings. */
export function CandidateMoneyChapter({
  state,
  office,
}: {
  state?: string;
  office?: string;
}) {
  const resource = financeResearchSource(state, office);
  return (
    <View style={s.content}>
      <Text style={s.note}>
        Donor records are not connected here yet. That does not mean this
        candidate has raised no money.
      </Text>
      <SourceLink
        label={resource.label}
        url={resource.url}
        prominence="primary"
      />
      <View style={s.research}>
        <Text style={s.label}>QUESTIONS TO TAKE TO THE FILINGS</Text>
        <Text style={s.body}>
          Which individuals, committees, or organizations are listed as
          contributors?
        </Text>
        <Text style={s.body}>What reporting period do the amounts cover?</Text>
        <Text style={s.body}>
          Are other groups reporting spending for or against the candidate?
        </Text>
      </View>
      <Text style={s.note}>
        Campaign contributions and outside spending are separate records. Match
        the candidate and committee before comparing reports. A donor’s listed
        employer is not necessarily the donor. Contributions alone do not
        establish how a candidate will vote.
      </Text>
    </View>
  );
}

/** Discrete follow-up prompts — one line each, never a paragraph dump. */
export function CandidateResearchPrompt({
  questions,
}: {
  questions: string[];
}) {
  return (
    <View style={s.research}>
      <Text style={s.label}>KEEP EXPLORING</Text>
      {questions.map((question) => (
        <Text key={question} style={s.body}>
          {question}
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: planes.slate,
    borderColor: hair[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  header: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 5 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  question: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: P.inkOnNight,
    opacity: 0.75,
  },
  status: {
    alignSelf: "flex-start",
    backgroundColor: planes.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hair[2],
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    lineHeight: 14,
    color: P.inkOnNight,
    opacity: 0.75,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[2],
    padding: 14,
    gap: 14,
  },
  content: { gap: 14 },
  research: {
    backgroundColor: planes.surface,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    color: P.quiet,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 19,
    color: P.inkOnNight,
    opacity: 0.75,
  },
});
