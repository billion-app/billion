import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import type { ContextClaim, PublicPropositionContext } from "@acme/validators";
import { contextMoneyPresentation } from "@acme/validators";

import { Icon } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { fontBody, fontEditorial, hair, DigestPalette as P } from "~/styles";
import { BallotText as Text } from "./BallotText";
import { webUrl } from "./model";

const layers = {
  "legal-text": "Legal text",
  "official-summary": "Official summary",
  "official-analysis": "Official analysis",
  "submitted-advocacy": "Submitted advocacy",
  "independent-research": "Independent research",
  "official-record": "Official record",
} as const;
const kinds = {
  "source-summary": "Source summary",
  "billion-inference": "Billion inference",
  illustration: "Illustration, not a forecast",
  unknown: "Evidence limit",
} as const;
const statuses = {
  "not-specified": "Not specified by the measure",
  "later-legislation": "Requires later legislation",
  "evidence-unavailable": "Evidence unavailable",
  "uncertain-effect": "Uncertain effect",
} as const;

export function PropositionContext({
  analysis,
  preview = false,
}: {
  analysis: PublicPropositionContext;
  preview?: boolean;
}) {
  const { t: tx } = useAppTranslation();

  const claim = (value: ContextClaim) => (
    <CitedClaim value={value} sources={analysis.sources} />
  );
  return (
    <View style={[s.stack, s.reader]}>
      <Text style={s.meta}>
        {preview
          ? tx("Source-backed pilot · {value1} · pending editorial review", {
              value1:
                analysis.authorship === "ai-assisted"
                  ? tx("AI-assisted")
                  : tx("Human-authored"),
            })
          : tx("Billion contextual explanation · {value1}", {
              value1:
                analysis.authorship === "ai-assisted"
                  ? tx("AI-assisted")
                  : tx("Human-authored"),
            })}
      </Text>
      <Text accessibilityRole="header" style={s.heading}>
        {tx("What changes, and why?")}
      </Text>
      <Text style={s.lead}>{analysis.takeaway.text}</Text>
      <MoneyContext value={analysis.takeaway} />
      <Disclosure title={tx("Evidence for the short answer")}>
        {claim(analysis.takeaway)}
      </Disclosure>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.label}>
          {tx("TODAY")}
        </Text>
        {claim(analysis.today)}
        <View style={s.divider} />
        <Text accessibilityRole="header" style={s.label}>
          {tx("PROPOSED CHANGE")}
        </Text>
        {claim(analysis.change)}
      </View>
      {analysis.terms.map((item) => (
        <View key={item.term} style={s.term}>
          <Text accessibilityRole="header" style={s.subheading}>
            {tx("What “{value1}” means here", { value1: item.term })}
          </Text>
          {claim(item.meaning)}
        </View>
      ))}
      <Disclosure title={tx("Why is this proposed?")}>
        {claim(analysis.rationale)}
      </Disclosure>
      <Disclosure
        title={analysis.mechanismQuestion}
        subtitle={tx("Follow the rule → action → possible outcome")}
      >
        {analysis.chain.map((step, index) => (
          <View key={index} style={s.step}>
            <Text style={s.stepNumber}>{index + 1}</Text>
            <View style={s.stepBody}>
              <Text accessibilityRole="header" style={s.subheading}>
                {step.actor}
              </Text>
              {claim(step.action)}
            </View>
          </View>
        ))}
      </Disclosure>
      <Disclosure title={tx("Tradeoffs and practical examples")}>
        {analysis.tradeoffs.map((item, i) => (
          <View key={i}>{claim(item)}</View>
        ))}
        {analysis.scenarios.map((item) => (
          <View key={item.title} style={s.term}>
            <Text accessibilityRole="header" style={s.subheading}>
              {item.title}
            </Text>
            {claim(item.claim)}
          </View>
        ))}
        {analysis.magnitude.map((item, i) => (
          <View key={i} style={s.term}>
            <Text style={s.label}>
              {tx(
                (
                  {
                    projection: "Projection",
                    measured: "Measured",
                    illustrative: "Illustrative",
                  } as const
                )[item.basis],
              )}{" "}
              · {item.period}
            </Text>
            {claim(item.amount)}
            {claim(item.comparison)}
          </View>
        ))}
      </Disclosure>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.subheading}>
          {tx("What is still unknown?")}
        </Text>
        {analysis.unknowns.slice(0, 1).map((item, i) => (
          <View key={i}>
            <Text style={s.meta}>{tx(statuses[item.status])}</Text>
            {claim(item.claim)}
          </View>
        ))}
        {analysis.unknowns.length > 1 && (
          <Disclosure title={tx("More limits and failure modes")}>
            {analysis.unknowns.slice(1).map((item, i) => (
              <View key={i} style={s.stack}>
                <Text style={s.meta}>{tx(statuses[item.status])}</Text>
                {claim(item.claim)}
              </View>
            ))}
          </Disclosure>
        )}
      </View>
      {analysis.history.length > 0 && (
        <Disclosure
          title={tx("What past evidence can tell us")}
          subtitle={tx("Findings, follow-through and limits of comparison")}
        >
          {analysis.history.map((item, i) => (
            <View key={i} style={s.stack}>
              <Text style={s.subheading}>{item.date}</Text>
              {claim(item.finding)}
              {claim(item.followThrough)}
              {claim(item.outcome)}
              {claim(item.limit)}
            </View>
          ))}
        </Disclosure>
      )}
      <Disclosure
        title={tx("Questions to investigate")}
        subtitle={tx("A starting point for your research")}
      >
        {analysis.questions.map((item) => (
          <View key={item.question} style={s.stack}>
            <Text style={s.subheading}>{item.question}</Text>
            {claim(item.path)}
          </View>
        ))}
      </Disclosure>
      <Disclosure title={tx("Version and review")}>
        <Text style={s.meta}>
          {tx("Evidence captured {value1} · Revision {value2}", {
            value1: analysis.preparedAt.slice(0, 10),
            value2: analysis.revision,
          })}
        </Text>
        <Text style={s.body}>
          {analysis.review.state === "approved"
            ? tx("Reviewed by {value1} on {value2}. {value3}", {
                value1: analysis.review.reviewer,
                value2: analysis.review.reviewedAt.slice(0, 10),
                value3: analysis.review.findings,
              })
            : tx("Editorial review is pending. This pilot is not published.")}
        </Text>
      </Disclosure>
    </View>
  );
}
function MoneyContext({ value }: { value: ContextClaim }) {
  const { language } = useAppTranslation();

  if (!value.money?.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {value.money.map((item, i) => {
        const parts = contextMoneyPresentation(item, language);
        return (
          <View key={i} style={s.money}>
            <Text style={[s.body, { fontFamily: fontBody.semibold }]}>
              {parts.nominal}
            </Text>
            <Text style={s.body}>{parts.comparison}</Text>
            {parts.reason && <Text style={s.body}>{parts.reason}</Text>}
            <Text style={s.moneyScope}>{parts.scope}</Text>
          </View>
        );
      })}
    </View>
  );
}
function CitedClaim({
  value,
  sources,
}: {
  value: ContextClaim;
  sources: PublicPropositionContext["sources"];
}) {
  const { t: tx } = useAppTranslation();

  return (
    <View style={s.claim}>
      <Text style={s.body}>{value.text}</Text>
      <MoneyContext value={value} />
      <Disclosure
        title={tx("{value1} · Evidence", { value1: tx(kinds[value.kind]) })}
        compact
      >
        {[
          ...value.evidence,
          ...(value.money ?? []).flatMap((item) =>
            item.comparison.state === "available"
              ? item.comparison.denominator.evidence
              : [],
          ),
        ]
          .filter(
            (ref, index, refs) =>
              refs.findIndex(
                (item) =>
                  item.sourceId === ref.sourceId &&
                  item.locator === ref.locator,
              ) === index,
          )
          .map((ref, i) => {
            const source = sources.find((item) => item.id === ref.sourceId);
            return source ? (
              <SourceLink key={i} source={source} locator={ref.locator} />
            ) : (
              <Text key={i} style={s.meta}>
                {tx("Supporting evidence unavailable.")}
              </Text>
            );
          })}
      </Disclosure>
    </View>
  );
}
function SourceLink({
  source,
  locator,
}: {
  source: PublicPropositionContext["sources"][number];
  locator: string;
}) {
  const { t: tx } = useAppTranslation();

  const [failed, setFailed] = useState(false);
  const href = webUrl(source.url);
  return (
    <View style={s.stack}>
      <Text style={s.meta}>
        {tx("{value1} · {value2} · Retrieved {value3}", {
          value1: tx(layers[source.layer]),
          value2: locator,
          value3: source.retrievedAt.slice(0, 10),
        })}
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={tx("Open {value1}: {value2}", {
          value1: source.name,
          value2: locator,
        })}
        style={s.link}
        onPress={() => {
          if (href)
            void Linking.openURL(href).then(
              () => setFailed(false),
              () => setFailed(true),
            );
        }}
      >
        <Text style={s.linkText}>{source.name}</Text>
        <Icon name="external" size={14} color={P.quiet} />
      </Pressable>
      {(!href || failed) && (
        <Text accessibilityRole="alert" style={s.meta}>
          {tx("Could not open this source. Try again.")}
        </Text>
      )}
    </View>
  );
}
function Disclosure({
  title,
  subtitle,
  children,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={!compact && s.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={s.trigger}
        onPress={() => setOpen(!open)}
      >
        <View style={{ flex: 1 }}>
          <Text style={compact ? s.evidence : s.subheading}>{title}</Text>
          {subtitle && <Text style={s.meta}>{subtitle}</Text>}
        </View>
        <Icon name={open ? "chevD" : "chevR"} size={14} color={P.quiet} />
      </Pressable>
      {open && <View style={s.expanded}>{children}</View>}
    </View>
  );
}
export function ContextUnavailable({
  state = "missing",
  sourceUrl,
}: {
  sourceUrl?: string;
  state?: "missing" | "stale" | "error";
}) {
  const { t: tx } = useAppTranslation();

  const [failed, setFailed] = useState(false);
  const href = webUrl(sourceUrl);
  return (
    <View style={s.card}>
      <Text style={s.subheading}>
        {state === "stale"
          ? tx("Explanation needs a new review")
          : state === "error"
            ? tx("Explanation could not load")
            : tx("Contextual explanation not available yet")}
      </Text>
      <Text style={s.body}>
        {state === "stale"
          ? tx(
              "The source or explanation changed. The previous version is withheld.",
            )
          : tx(
              "Consult the official record to investigate the proposed rule and its limits.",
            )}
      </Text>
      {href && (
        <Pressable
          accessibilityRole="link"
          style={s.link}
          onPress={() => {
            void Linking.openURL(href).then(
              () => setFailed(false),
              () => setFailed(true),
            );
          }}
        >
          <Text style={s.linkText}>{tx("Open official record")}</Text>
          <Icon name="external" size={14} color={P.quiet} />
        </Pressable>
      )}
      {failed && (
        <Text accessibilityRole="alert" style={s.meta}>
          {tx("Could not open the source. Tap to retry.")}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  stack: { gap: 12 },
  reader: { width: "100%", maxWidth: 680, alignSelf: "center" },
  claim: { gap: 0 },
  card: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 22,
    lineHeight: 28,
    color: P.inkOnNight,
  },
  lead: {
    fontFamily: fontEditorial.regular,
    fontSize: 20,
    lineHeight: 29,
    color: P.inkOnNight,
  },
  money: { gap: 4 },
  moneyScope: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  subheading: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 23,
    color: P.inkOnNight,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 18,
    color: P.quiet,
  },
  meta: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.quiet,
  },
  evidence: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  term: { gap: 6, borderLeftWidth: 2, borderColor: hair[2], paddingLeft: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: hair[1],
    marginVertical: 6,
  },
  disclosure: { borderTopWidth: 1, borderColor: hair[1] },
  trigger: {
    minHeight: 44,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  expanded: { gap: 16, paddingBottom: 12 },
  step: { flexDirection: "row", gap: 12 },
  stepBody: { flex: 1, gap: 5 },
  stepNumber: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 23,
    color: P.quiet,
  },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  linkText: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
    flexShrink: 1,
  },
});
