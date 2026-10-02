import { View } from "react-native";

import type { CandidateBrief } from "@acme/validators";

import { Text } from "~/components/Themed";
import { Card } from "~/components/ui";
import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";
import { SourceLink } from "./BallotEvidence";

const labels = {
  priorities: "Priorities",
  record: "Documented record",
  mechanisms: "How policy could change",
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
export function CandidateIndependentBrief({
  brief,
  reviewedAt,
}:
  | { brief: CandidateBrief; reviewedAt: string }
  | { brief?: undefined; reviewedAt?: undefined }) {
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
      {!brief ? (
        <Card style={{ padding: sp[4], gap: sp[3] }}>
          <Text
            style={{
              color: P.inkOnNight,
              fontFamily: fontBody.regular,
              fontSize: 15,
              lineHeight: 23,
            }}
          >
            Independent analysis is not available for this race. Billion has not
            published reviewed briefs for the complete candidate roster.
          </Text>
          <Text
            style={{
              color: P.inkOnNight,
              fontFamily: fontBody.regular,
              fontSize: 13,
              lineHeight: 20,
            }}
          >
            A missing brief says nothing about a candidate’s qualifications. Any
            candidate statement is their own claim.
          </Text>
        </Card>
      ) : (
        <>
          <Text style={{ color: P.inkOnNight }}>
            {brief.authorship.kind === "generated"
              ? "AI-assisted Billion explanation · "
              : "Billion explanation · "}
            Editorially reviewed {reviewedAt} · Revision {brief.revisionId}
          </Text>
          {brief.correction ? (
            <Text style={{ color: P.inkOnNight }}>
              Correction: {brief.correction.reason}
            </Text>
          ) : null}
          {brief.sections.map((section) => (
            <Card key={section.topic} style={{ padding: sp[4], gap: sp[3] }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: P.inkOnNight,
                  fontFamily: fontEditorial.bold,
                  fontSize: 17,
                }}
              >
                {labels[section.topic]}
              </Text>
              {section.claims.map((claim) => (
                <View key={claim.id} style={{ gap: sp[2] }}>
                  <Text
                    style={{
                      color: P.inkOnNight,
                      fontFamily: fontBody.semibold,
                    }}
                  >
                    {kinds[claim.kind]}
                  </Text>
                  <Text
                    selectable
                    style={{
                      color: P.inkOnNight,
                      fontFamily: fontBody.regular,
                      fontSize: 15,
                      lineHeight: 23,
                    }}
                  >
                    {claim.text}
                  </Text>
                  {claim.evidenceIds.map((id) => {
                    const evidence = brief.evidence.find((e) => e.id === id);
                    return evidence ? (
                      <SourceLink
                        key={id}
                        label={`${evidence.publisher} · ${evidence.locator}`}
                        url={evidence.url}
                      />
                    ) : null;
                  })}
                </View>
              ))}
              {section.missingEvidence ? (
                <Text
                  style={{
                    color: P.inkOnNight,
                    fontFamily: fontBody.regular,
                    fontSize: 14,
                    lineHeight: 22,
                  }}
                >
                  Evidence gap: {section.missingEvidence}
                </Text>
              ) : null}
            </Card>
          ))}
        </>
      )}
    </View>
  );
}
