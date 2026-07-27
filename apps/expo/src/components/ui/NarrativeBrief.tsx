import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import type { BriefQuote } from "./BillBrief";
import { Text } from "~/components/Themed";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";
import { Icon } from "./Icon";

export interface NarrativeBriefData {
  kind: "court_case";
  presentation: "court_case";
  badge: string;
  hook: string;
  facts: {
    label: string;
    value: string;
    note?: string;
    quote?: BriefQuote;
  }[];
  sections: {
    title: string;
    items: { text: string; quote?: BriefQuote }[];
  }[];
  terms: { term: string; plain: string }[];
  unknowns: string[];
}

function EmphasizedText({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**")
          ? part
              .slice(2, -2)
              .split(/(\s+)/)
              .map((token, tokenIndex) =>
                /^\s+$/.test(token) ? (
                  token
                ) : (
                  <Text key={`${index}-${tokenIndex}`} style={s.inlineStrong}>
                    {token}
                  </Text>
                ),
              )
          : part,
      )}
    </Text>
  );
}

export function NarrativeBrief({
  data,
  accent,
  dualLens,
  onViewSource,
}: {
  data: NarrativeBriefData;
  accent: string;
  dualLens?: ReactNode;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <View>
      <View style={[s.hook, { borderLeftColor: accent }]}>
        <View style={s.hookHead}>
          <View style={[s.iconTile, { backgroundColor: `${accent}22` }]}>
            <Icon name="scale" size={20} color={accent} />
          </View>
          <Text style={s.hookTitle}>Why this case matters</Text>
          <View style={[s.badge, { borderColor: `${accent}88` }]}>
            <Text style={[s.badgeText, { color: accent }]}>{data.badge}</Text>
          </View>
        </View>
        <EmphasizedText style={s.hookText}>{data.hook}</EmphasizedText>
      </View>

      {data.facts.length > 0 ? (
        <View style={s.factGrid}>
          {data.facts.map((fact, index) => (
            <View key={`${fact.label}-${index}`} style={s.fact}>
              <Text style={s.factLabel}>{fact.label.toUpperCase()}</Text>
              <Text style={s.factValue}>{fact.value}</Text>
              {fact.note ? <Text style={s.factNote}>{fact.note}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {data.terms.length > 0 ? (
        <View style={s.terms}>
          <TouchableOpacity
            style={s.termsHead}
            onPress={() => setTermsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: termsOpen }}
          >
            <View style={s.sectionTitleRow}>
              <Icon name="book" size={18} color={accent} />
              <Text style={s.sectionTitle}>Key terms</Text>
            </View>
            <Icon name="chevD" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {termsOpen
            ? data.terms.map((term) => (
                <View key={term.term} style={s.termRow}>
                  <Text style={s.termName}>{term.term}</Text>
                  <EmphasizedText style={s.termPlain}>
                    {term.plain}
                  </EmphasizedText>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {data.sections.map((section, sectionIndex) => (
        <View key={`${section.title}-${sectionIndex}`} style={s.section}>
          <Text style={s.sectionTitle}>{section.title}</Text>
          {section.items.map((item, itemIndex) => (
            <View key={`${sectionIndex}-${itemIndex}`} style={s.item}>
              <View style={[s.itemNumber, { backgroundColor: `${accent}20` }]}>
                <Text style={[s.itemNumberText, { color: accent }]}>
                  {String(itemIndex + 1).padStart(2, "0")}
                </Text>
              </View>
              <View style={s.itemBody}>
                <EmphasizedText style={s.itemText}>{item.text}</EmphasizedText>
                {item.quote && onViewSource ? (
                  <TouchableOpacity
                    style={s.sourceButton}
                    onPress={() => item.quote && onViewSource(item.quote)}
                    accessibilityRole="button"
                  >
                    <Icon name="quote" size={12} color={accent} />
                    <Text style={[s.sourceButtonText, { color: accent }]}>
                      View source
                    </Text>
                    <Icon name="arrowRight" size={13} color={accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ))}

      {data.unknowns.length > 0 ? (
        <View style={s.unknowns}>
          <View style={s.sectionTitleRow}>
            <Icon name="help" size={18} color={colors.textSecondary} />
            <Text style={s.sectionTitle}>What remains unsettled</Text>
          </View>
          {data.unknowns.map((unknown, index) => (
            <View key={index} style={s.unknownItem}>
              <Text style={[s.unknownNumber, { color: accent }]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <EmphasizedText style={s.unknownText}>{unknown}</EmphasizedText>
            </View>
          ))}
        </View>
      ) : null}

      {dualLens ? <View style={s.lens}>{dualLens}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  hook: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hair[2],
    borderLeftWidth: 4,
    backgroundColor: planes.slate,
    padding: 18,
    marginBottom: 18,
  },
  hookHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hookTitle: {
    flex: 1,
    color: colors.white,
    fontFamily: fontDisplay.bold,
    fontSize: 21,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  hookText: {
    color: colors.white,
    fontFamily: fontBody.regular,
    fontSize: 17,
    lineHeight: 26,
  },
  inlineStrong: {
    color: colors.white,
    fontFamily: fontBody.bold,
  },
  factGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  fact: {
    minWidth: "47%",
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: 14,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    padding: 14,
  },
  factLabel: {
    color: colors.textSecondary,
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  factValue: {
    color: colors.white,
    fontFamily: fontDisplay.bold,
    fontSize: 20,
  },
  factNote: {
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  terms: {
    borderRadius: 16,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    padding: 16,
    marginBottom: 22,
  },
  termsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  sectionTitle: {
    color: colors.white,
    fontFamily: fontDisplay.bold,
    fontSize: 20,
  },
  termRow: {
    borderTopWidth: 1,
    borderTopColor: hair[2],
    marginTop: 14,
    paddingTop: 14,
  },
  termName: {
    color: colors.white,
    fontFamily: fontBody.bold,
    fontSize: 15,
    marginBottom: 5,
  },
  termPlain: {
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  section: { marginBottom: 24 },
  item: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    padding: 16,
    marginTop: 10,
  },
  itemNumber: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  itemNumberText: { fontFamily: fontBody.bold, fontSize: 11 },
  itemBody: { flex: 1, minWidth: 0 },
  itemText: {
    color: colors.white,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  sourceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
  },
  sourceButtonText: { fontFamily: fontBody.bold, fontSize: 13 },
  unknowns: {
    borderRadius: 16,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    padding: 16,
    marginBottom: 24,
  },
  unknownItem: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: hair[2],
    paddingTop: 13,
    marginTop: 13,
  },
  unknownNumber: { fontFamily: fontBody.bold, fontSize: 12, paddingTop: 2 },
  unknownText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  lens: { marginTop: 4, marginBottom: 24 },
});
