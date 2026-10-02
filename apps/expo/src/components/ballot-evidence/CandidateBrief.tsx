import { View } from "react-native";

import type { CandidateBrief } from "@acme/validators";

import { Text } from "~/components/Themed";
import { Card } from "~/components/ui";
import {
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  sp,
} from "~/styles";
import { SourceLink } from "./BallotEvidence";
import {
  candidateDetailText,
  CandidateDisclosure,
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
export function CandidateCoverage({
  hasStatement,
  officeUrl,
}: {
  hasStatement: boolean;
  officeUrl: string;
}) {
  return (
    <View style={{ gap: sp[3] }}>
      <Text
        accessibilityRole="header"
        style={{
          color: P.inkOnNight,
          fontFamily: fontEditorial.bold,
          fontSize: 19,
        }}
      >
        {hasStatement
          ? "No independent analysis yet"
          : "Information is limited"}
      </Text>
      <Text style={candidateDetailText}>
        {hasStatement
          ? "Billion hasn’t published independent analysis for this race."
          : "Billion has no statement or independent analysis for this candidate yet."}{" "}
        Missing coverage is not a judgment of their qualifications.
      </Text>
      <SourceLink
        label="Find your election office"
        url={officeUrl}
        prominence="primary"
      />
      <Text style={candidateDetailText}>
        Look for the official candidate list and voter guide.
      </Text>
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
}: {
  brief: CandidateBrief;
  reviewedAt: string;
}) {
  return (
    <View style={{ gap: sp[3] }}>
      <Text
        accessibilityRole="header"
        style={{
          color: P.inkOnNight,
          fontFamily: fontEditorial.bold,
          fontSize: 19,
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
        "effects",
        "priorities",
        "record",
        "mechanisms",
        "tradeoffs",
        "unknowns",
      ].map((topic) => {
        const section = brief.sections.find((item) => item.topic === topic);
        if (!section) return null;
        const firstClaim = section.claims[0];
        const sources = (claim: typeof firstClaim) =>
          claim?.evidenceIds.map((id) => {
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
                <Text selectable style={candidateDetailText}>
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
                <Text
                  style={{
                    color: P.inkOnNight,
                    fontFamily: fontBody.semibold,
                    fontSize: 12,
                  }}
                >
                  {kinds[claim.kind]}
                </Text>
                <Text
                  selectable
                  style={{
                    ...candidateDetailText,
                    fontSize: 15,
                    lineHeight: 23,
                  }}
                >
                  {claim.text}
                </Text>
                <CandidateDisclosure
                  title="Sources"
                  label={`Sources for ${labels[section.topic]}${section.claims.length > 1 ? `, point ${index + 1}` : ""}`}
                >
                  {sources(claim)}
                </CandidateDisclosure>
              </View>
            ))}
            {section.missingEvidence ? (
              <Text style={candidateDetailText}>{section.missingEvidence}</Text>
            ) : null}
          </>
        );
        return section.topic === "effects" && firstClaim ? (
          <Card key={topic} style={{ padding: sp[4], gap: sp[2] }}>
            {body}
          </Card>
        ) : (
          <View
            key={topic}
            style={{
              paddingVertical: sp[3],
              gap: sp[2],
              borderBottomWidth: 1,
              borderBottomColor: hair[2],
            }}
          >
            {body}
          </View>
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
