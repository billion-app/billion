/**
 * Official documents, public-comment privacy note, and participation
 * guidance. Public-comment letters are link-only by policy: we show the
 * official link and a count — never names, attachment contents, or summaries.
 */
import { StyleSheet, Text, View } from "react-native";

import type { DecisionDetail } from "~/utils/local-government";
import { ExternalLink } from "~/components/ExternalLink";
import { Icon } from "~/components/ui/Icon";
import { colors, fontBody, useTheme } from "~/styles";
import { documentCategoryLabel } from "~/utils/local-government";

type Document = DecisionDetail["documents"][number];

export function DocumentsSection({
  documents,
  publicComments,
}: {
  documents: readonly Document[];
  publicComments: DecisionDetail["publicComments"];
}) {
  const { theme } = useTheme();

  return (
    <View style={s.wrap}>
      {documents.length > 0 ? (
        <>
          <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>
            Official documents
          </Text>
          <View style={[s.docCard, { backgroundColor: theme.card }]}>
            {documents.map((doc, index) => (
              <ExternalLink key={doc.id} href={doc.url}>
                <View
                  style={[
                    s.docRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.border,
                    },
                  ]}
                >
                  <Icon name="doc" size={15} color={theme.textSecondary} />
                  <View style={s.docText}>
                    <Text
                      style={[s.docCategory, { color: theme.foreground }]}
                      numberOfLines={1}
                    >
                      {documentCategoryLabel(doc.category)}
                      {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
                    </Text>
                    {doc.description ? (
                      <Text
                        style={[s.docDesc, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {doc.description}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="external" size={14} color={theme.textSecondary} />
                </View>
              </ExternalLink>
            ))}
          </View>
        </>
      ) : null}

      {publicComments.documentCount > 0 ? (
        <View style={[s.privacyNote, { borderColor: theme.border }]}>
          <Icon name="lock" size={14} color={theme.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.privacyTitle, { color: theme.foreground }]}>
              {publicComments.documentCount} public comment{" "}
              {publicComments.documentCount === 1 ? "letter" : "letters"} in the
              official record
            </Text>
            <Text style={[s.privacyBody, { color: theme.textSecondary }]}>
              Billion links to these letters without displaying commenter names
              or personal details.
            </Text>
            {publicComments.officialLinks[0] ? (
              <ExternalLink href={publicComments.officialLinks[0].url}>
                <Text style={[s.link, { color: theme.accent }]}>
                  View in the official record
                </Text>
              </ExternalLink>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ParticipationCard({
  participation,
}: {
  participation: DecisionDetail["participation"];
}) {
  const { theme } = useTheme();

  return (
    <View style={[s.participationCard, { backgroundColor: theme.card }]}>
      <View style={s.participationHead}>
        <Icon name="mic" size={16} color={theme.accent} />
        <Text
          style={[
            s.sectionLabel,
            { color: theme.textSecondary, marginBottom: 0 },
          ]}
        >
          How to participate
        </Text>
      </View>
      <Text style={[s.participationBody, { color: theme.foreground }]}>
        General guidance for this city — not instructions for this specific
        item.
      </Text>
      {participation.note ? (
        <Text style={[s.participationNote, { color: theme.textSecondary }]}>
          {participation.note}
        </Text>
      ) : null}
      {participation.instructionsUrl ? (
        <ExternalLink href={participation.instructionsUrl}>
          <View style={s.participationButton}>
            <Text style={s.participationButtonText}>
              Check the current agenda for how to comment
            </Text>
            <Icon name="external" size={13} color={colors.black} />
          </View>
        </ExternalLink>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  sectionLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  docCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  docText: { flex: 1, minWidth: 0 },
  docCategory: {
    fontFamily: fontBody.medium,
    fontSize: 13,
  },
  docDesc: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    marginTop: 1,
  },
  privacyNote: {
    flexDirection: "row",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  privacyTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
  },
  privacyBody: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  link: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    marginTop: 6,
  },
  participationCard: {
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  participationHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  participationBody: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  participationNote: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  participationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  participationButtonText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: colors.black,
  },
});
