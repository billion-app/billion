import { View } from "react-native";

import type { CandidateBrief } from "@acme/validators";

import { Text } from "~/components/Themed";
import { Card, Icon } from "~/components/ui";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";
import {
  candidateDetailText,
  CandidateDisclosure,
  CandidateSourceLink as SourceLink,
} from "./CandidateDisclosure";

const labels = {
  priorities: "Priorities",
  record: "Documented record",
  mechanisms: "How plans could work",
  effects: "Potential effects",
  tradeoffs: "Tradeoffs",
  unknowns: "What remains unknown",
};
const kinds = {
  promise: "Candidate promise",
  fact: "Documented fact",
  disputed: "Disputed claim",
  analysis: "Billion analysis",
};
/** Visual categories describe evidence origin, never candidate merit. */
function ClaimKindLabel({ kind }: { kind: keyof typeof kinds | "missing" }) {
  const icon = {
    promise: "quote",
    fact: "doc",
    disputed: "help",
    analysis: "layers",
    missing: "help",
  } as const;
  const accent =
    kind === "analysis"
      ? P.badgeIndigo
      : kind === "promise"
        ? P.badgeBlue
        : P.inkOnNight;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: sp[2],
        alignSelf: "stretch",
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <Icon name={icon[kind]} size={14} color={accent} />
      </View>
      <Text
        style={{
          color: P.inkOnNight,
          fontFamily: fontBody.semibold,
          fontSize: 10.5,
          flex: 1,
        }}
      >
        {kind === "missing" ? "Information missing" : kinds[kind]}
      </Text>
    </View>
  );
}

export function CandidateCoverage({
  hasStatement,
  officeUrl,
}: {
  hasStatement: boolean;
  officeUrl: string;
}) {
  return (
    <View
      style={{
        gap: 9,
        backgroundColor: planes.surface,
        borderWidth: 1,
        borderColor: hair[2],
        borderRadius: 12,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Icon name="info" size={16} color={colors.bill} />
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontEditorial.bold,
            fontSize: 16,
            color: P.inkOnNight,
            flex: 1,
          }}
        >
          {hasStatement
            ? "No independent analysis yet"
            : "Information is limited"}
        </Text>
      </View>
      <Text style={{ ...candidateDetailText, fontSize: 13, lineHeight: 19 }}>
        {hasStatement
          ? "Billion hasn’t published independent analysis for this race."
          : "Billion has no statement or independent analysis for this candidate yet."}{" "}
        Missing coverage is not a judgment of their qualifications.
      </Text>
      <SourceLink label="Find your official candidate list" url={officeUrl} />
      <CandidateDisclosure title="About our coverage">
        <Text style={candidateDetailText}>
          We publish independent briefs only after reviewing everyone in a
          verified race. A submitted statement alone does not establish a
          complete candidate list.
        </Text>
      </CandidateDisclosure>
    </View>
  );
}

export function CandidateIndependentBrief({
  brief,
  reviewedAt,
  topics,
}: {
  brief: CandidateBrief;
  reviewedAt: string;
  topics?: CandidateBrief["sections"][number]["topic"][];
}) {
  return (
    <View style={{ gap: sp[3] }}>
      <Text
        accessibilityRole="header"
        style={{
          color: P.inkOnNight,
          fontFamily: fontEditorial.bold,
          fontSize: 18,
        }}
      >
        Independent brief
      </Text>
      <Text style={candidateDetailText}>
        {brief.authorship.kind === "generated"
          ? "AI-assisted Billion explanation"
          : "Billion explanation"}{" "}
        · Reviewed {reviewedAt}
      </Text>
      {brief.correction ? (
        <Text style={{ color: P.inkOnNight }}>
          Correction: {brief.correction.reason}
        </Text>
      ) : null}
      {[
        "priorities",
        "record",
        "mechanisms",
        "effects",
        "tradeoffs",
        "unknowns",
      ].map((topic) => {
        if (
          topics &&
          !topics.includes(topic as CandidateBrief["sections"][number]["topic"])
        )
          return null;
        const section = brief.sections.find((item) => item.topic === topic);
        if (!section) return null;
        const sources = (claim: (typeof section.claims)[number]) =>
          claim.evidenceIds.map((id) => {
            const evidence = brief.evidence.find((e) => e.id === id);
            return evidence ? (
              <View key={id} style={{ gap: sp[2] }}>
                <Text
                  style={[
                    candidateDetailText,
                    { fontFamily: fontBody.semibold },
                  ]}
                >
                  {evidence.publisher}
                </Text>
                <Text
                  selectable
                  style={{
                    ...candidateDetailText,
                    fontFamily: fontEditorial.italic,
                    backgroundColor: planes.ink,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  {evidence.excerpt}
                </Text>
                <Text style={candidateDetailText}>{evidence.locator}</Text>
                <Text style={candidateDetailText}>
                  Source retrieved{" "}
                  {new Date(evidence.retrievedAt).toLocaleDateString("en-US", {
                    timeZone: "UTC",
                  })}
                </Text>
                <SourceLink label="Open original source" url={evidence.url} />
              </View>
            ) : null;
          });
        const body = (
          <>
            <Text
              accessibilityRole="header"
              style={{
                color: P.inkOnNight,
                fontFamily: fontEditorial.bold,
                fontSize: 18,
              }}
            >
              {labels[section.topic]}
            </Text>
            {section.claims.map((claim, index) => (
              <View key={claim.id} style={{ gap: sp[2] }}>
                <ClaimKindLabel kind={claim.kind} />
                <Text
                  selectable
                  style={{
                    ...candidateDetailText,
                    fontSize: topic === "priorities" ? 15 : 13.5,
                    lineHeight: topic === "priorities" ? 23 : 20,
                  }}
                >
                  {claim.text}
                </Text>
                <CandidateDisclosure
                  title={
                    claim.kind === "analysis"
                      ? "Sources for this analysis"
                      : claim.kind === "promise"
                        ? "Source for this promise"
                        : claim.kind === "fact"
                          ? "Sources for this fact"
                          : "Sources for this disputed claim"
                  }
                  label={`Sources for ${labels[section.topic]}${section.claims.length > 1 ? `, point ${index + 1}` : ""}`}
                >
                  {sources(claim)}
                </CandidateDisclosure>
              </View>
            ))}
            {section.missingEvidence ? (
              <View style={{ gap: sp[2] }}>
                <ClaimKindLabel kind="missing" />
                <Text style={candidateDetailText}>
                  {section.missingEvidence}
                </Text>
              </View>
            ) : null}
          </>
        );
        return (
          <Card
            key={topic}
            style={{
              backgroundColor: planes.slate,
              borderWidth: 1,
              borderColor: hair[1],
              borderLeftWidth: topic === "priorities" ? 3 : 1,
              borderLeftColor: topic === "priorities" ? P.badgeBlue : hair[1],
              borderRadius: 14,
              padding: 14,
              gap: 10,
            }}
          >
            {body}
          </Card>
        );
      })}
      <CandidateDisclosure title="Review details">
        <Text style={candidateDetailText}>Revision {brief.revisionId}</Text>
        {brief.authorship.kind === "generated" ? (
          <Text style={candidateDetailText}>
            Model: {brief.authorship.model} · Prompt:{" "}
            {brief.authorship.promptVersion}
          </Text>
        ) : null}
      </CandidateDisclosure>
    </View>
  );
}
