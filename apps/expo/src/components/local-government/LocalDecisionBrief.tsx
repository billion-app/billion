import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import type { DecisionDetail } from "~/utils/local-government";
import { ExternalLink } from "~/components/ExternalLink";
import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  DigestPalette as P,
} from "~/styles";

export function LocalDecisionBrief({
  brief,
  documents,
}: {
  brief: NonNullable<DecisionDetail["brief"]>;
  documents: DecisionDetail["documents"];
}) {
  const { t, language } = useAppTranslation();
  return (
    <View style={s.wrap}>
      <Text style={s.note}>{t("localDetail.ai")}</Text>
      {language !== "en" && (
        <Text style={s.note}>{t("localDetail.english")}</Text>
      )}
      {brief.claims.map((claim, index) => (
        <View key={index} style={s.card}>
          <Text accessibilityLanguage="en" style={s.claim}>
            {claim.text}
          </Text>
          {claim.citations.map((citation, citationIndex) => {
            const document = documents.find(
              (item) => item.id === citation.documentId,
            );
            return document ? (
              <SourcePassage
                key={citationIndex}
                citation={citation}
                url={document.url}
                name={document.name}
              />
            ) : null;
          })}
        </View>
      ))}
    </View>
  );
}
function SourcePassage({
  citation,
  url,
  name,
}: {
  citation: NonNullable<
    DecisionDetail["brief"]
  >["claims"][number]["citations"][number];
  url: string;
  name: string;
}) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={s.button}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Text style={s.link}>
          {t("localDetail.quote", { page: citation.page })} {open ? "−" : "+"}
        </Text>
      </TouchableOpacity>
      {open && (
        <View style={s.quoteWrap}>
          <Text style={s.note}>{name}</Text>
          <Text accessibilityLanguage="en" style={s.quote}>
            “{citation.quote}”
          </Text>
          <ExternalLink
            href={`${url.split("#")[0]}#page=${citation.page}`}
            asChild
          >
            <TouchableOpacity style={s.button} accessibilityRole="link">
              <Text style={s.link}>
                {t("localDetail.document", { page: citation.page })}
              </Text>
            </TouchableOpacity>
          </ExternalLink>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 24 },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
    color: P.inkOnNight,
  },
  card: {
    backgroundColor: P.card,
    borderRadius: DigestRadii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    padding: 16,
    gap: 8,
  },
  claim: {
    fontFamily: fontBody.medium,
    fontSize: 16,
    lineHeight: 24,
    color: P.inkOnNight,
  },
  button: { minHeight: 44, justifyContent: "center" },
  link: { fontFamily: fontBody.semibold, fontSize: 12.5, color: P.spark },
  quoteWrap: { borderLeftWidth: 2, borderLeftColor: P.quiet, paddingLeft: 12 },
  quote: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 20,
    color: P.inkOnNight,
  },
});
