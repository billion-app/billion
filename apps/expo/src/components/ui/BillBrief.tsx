/**
 * BillBrief — the structured replacement for a wall of markdown.
 *
 * The old explainer rendered one long markdown blob, so the reader's only
 * choices were "read all of it" or "read none of it". A brief is a stack of
 * self-contained blocks the reader can leave at any point and still have
 * learned something true:
 *
 *   hook      → one sentence, always visible
 *   facts     → scannable tiles, no reading required
 *   changes   → before → after, source quote one tap away
 *   affected  → who this lands on
 *   unknowns  → what the text does not settle
 *   terms     → glossary, collapsed
 *   sections  → the long prose version, collapsed
 *
 * Two brand constraints shape the visual language here:
 *
 *  - Nothing color-codes a verdict. A group that "loses" access is drawn with
 *    the same neutral treatment as one that "gains" it — direction is carried
 *    by an arrow and a word, never by green/red. Coloring outcomes would read
 *    as an editorial position, and red-vs-green sits one step from
 *    red-vs-blue.
 *  - Every claim keeps a path back to the source. Change cards expose the
 *    verbatim provision that backs them, and the block ends by pointing at the
 *    official text rather than presenting itself as the last word.
 */
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Markdown from "@ronradtke/react-native-markdown-display";

import type { IconName } from "./Icon";
import {
  colors,
  darkTheme,
  fontBody,
  fontEditorial,
  getMarkdownStyles,
  hair,
  planes,
} from "~/styles";
import { Icon } from "./Icon";

/* ---------- data shape ---------- */
// Mirrors @acme/validators' BillBriefRecord. Redeclared rather than imported so
// the native app keeps no dependency on server-side validation code, matching
// how LensData is handled next door.

export type BriefChangeKind =
  | "creates"
  | "repeals"
  | "expands"
  | "restricts"
  | "requires"
  | "waives"
  | "funds"
  | "transfers";

export interface BriefQuote {
  text: string;
  locator?: string;
}

export interface BillBriefData {
  hook: string;
  legalStatus: "proposed" | "enacted";
  facts: { label: string; value: string; note?: string; quote?: BriefQuote }[];
  changes: {
    kind: BriefChangeKind;
    title: string;
    before: string;
    after: string;
    quote?: BriefQuote;
  }[];
  affected: {
    group: string;
    effect: string;
    direction: "gains" | "loses" | "mixed" | "unclear";
  }[];
  unknowns: string[];
  terms: { term: string; plain: string }[];
  sections: { heading: string; body: string }[];
}

const CHANGE_KIND_LABEL: Record<BriefChangeKind, string> = {
  creates: "CREATES",
  repeals: "REPEALS",
  expands: "EXPANDS",
  restricts: "RESTRICTS",
  requires: "REQUIRES",
  waives: "WAIVES",
  funds: "FUNDS",
  transfers: "TRANSFERS",
};

/**
 * Direction glyphs are all one neutral color on purpose — see the file header.
 * The arrow encodes flow (toward or away from the group); the label spells it
 * out for anyone who reads the arrow differently.
 */
const DIRECTION: Record<
  BillBriefData["affected"][number]["direction"],
  { icon: IconName; label: string }
> = {
  gains: { icon: "arrowUp", label: "Gains" },
  loses: { icon: "arrowDown", label: "Loses" },
  mixed: { icon: "minus", label: "Mixed" },
  unclear: { icon: "help", label: "Unclear" },
};

/* ---------- Hook — the one sentence that must land ---------- */
function Hook({
  text,
  legalStatus,
  accent,
}: {
  text: string;
  legalStatus: BillBriefData["legalStatus"];
  accent: string;
}) {
  return (
    <View style={s.hookWrap}>
      <View style={[s.hookBar, { backgroundColor: accent }]} />
      <View style={s.hookBody}>
        <Text style={s.hookKicker}>
          {legalStatus === "enacted" ? "THIS IS LAW" : "PROPOSED — NOT LAW"}
        </Text>
        <Text style={s.hookText} testID="brief-hook">
          {text}
        </Text>
      </View>
    </View>
  );
}

/* ---------- Facts — scannable tiles ---------- */
function Facts({ facts }: { facts: BillBriefData["facts"] }) {
  if (facts.length === 0) return null;
  return (
    <View style={s.factGrid} testID="brief-facts">
      {facts.map((f, i) => (
        <View key={i} style={s.factTile}>
          <Text style={s.factLabel} numberOfLines={1}>
            {f.label.toUpperCase()}
          </Text>
          <Text style={s.factValue} numberOfLines={2} adjustsFontSizeToFit>
            {f.value}
          </Text>
          {f.note ? (
            <Text style={s.factNote} numberOfLines={2}>
              {f.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ---------- Quote disclosure — provenance, one tap away ---------- */
// Collapsed by default: the reader asked for plain language, so raw statutory
// text is opt-in. But it is always one tap away, never a dead end.
function QuoteDisclosure({ quote }: { quote: BriefQuote }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.quoteWrap}>
      <TouchableOpacity
        style={s.quoteToggle}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open ? "Hide the source text" : "Show the source text"
        }
      >
        <Icon name="quote" size={11} color={colors.textSecondary} />
        <Text style={s.quoteToggleText}>
          {quote.locator ? `In the text · ${quote.locator}` : "In the text"}
        </Text>
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={13} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={s.quoteBody}>
          <Text style={s.quoteText}>{quote.text}</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- Changes — before → after ---------- */
function Changes({
  changes,
  accent,
}: {
  changes: BillBriefData["changes"];
  accent: string;
}) {
  return (
    <View style={s.changeList} testID="brief-changes">
      {changes.map((c, i) => (
        <View key={i} style={s.changeCard}>
          <View style={s.changeHead}>
            <View style={[s.kindChip, { borderColor: accent }]}>
              <Text style={[s.kindChipText, { color: accent }]}>
                {CHANGE_KIND_LABEL[c.kind]}
              </Text>
            </View>
            <Text style={s.changeIndex}>
              {i + 1}/{changes.length}
            </Text>
          </View>
          <Text style={s.changeTitle}>{c.title}</Text>

          <View style={s.deltaRow}>
            <View style={s.deltaCol}>
              <Text style={s.deltaLabel}>NOW</Text>
              <Text style={s.deltaText}>{c.before}</Text>
            </View>
            <View style={s.deltaArrow}>
              <Icon name="arrowRight" size={14} color={colors.textSecondary} />
            </View>
            <View style={s.deltaCol}>
              <Text style={s.deltaLabel}>UNDER THIS BILL</Text>
              <Text style={[s.deltaText, s.deltaTextAfter]}>{c.after}</Text>
            </View>
          </View>

          {c.quote ? <QuoteDisclosure quote={c.quote} /> : null}
        </View>
      ))}
    </View>
  );
}

/* ---------- Affected — who this lands on ---------- */
function Affected({ affected }: { affected: BillBriefData["affected"] }) {
  return (
    <View style={s.affectedList} testID="brief-affected">
      {affected.map((a, i) => {
        const d = DIRECTION[a.direction];
        return (
          <View key={i} style={s.affectedRow}>
            <View style={s.affectedIcon}>
              <Icon name={d.icon} size={14} color={colors.white} />
            </View>
            <View style={s.affectedBody}>
              <View style={s.affectedHead}>
                <Text style={s.affectedGroup}>{a.group}</Text>
                <Text style={s.affectedDirection}>{d.label}</Text>
              </View>
              <Text style={s.affectedEffect}>{a.effect}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Unknowns — the honesty block ---------- */
// Deliberately given the same visual weight as the analysis blocks. Burying it
// would let a brief read as more settled than the source actually is.
function Unknowns({ unknowns }: { unknowns: string[] }) {
  if (unknowns.length === 0) return null;
  return (
    <View style={s.unknownCard} testID="brief-unknowns">
      <View style={s.unknownHead}>
        <Icon name="help" size={15} color={colors.textSecondary} />
        <Text style={s.unknownTitle}>What the text doesn&apos;t settle</Text>
      </View>
      {unknowns.map((u, i) => (
        <View key={i} style={s.unknownRow}>
          <View style={s.bullet} />
          <Text style={s.unknownText}>{u}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- Terms — collapsed glossary ---------- */
function Terms({ terms }: { terms: BillBriefData["terms"] }) {
  const [open, setOpen] = useState(false);
  if (terms.length === 0) return null;
  return (
    <View style={s.disclosureCard}>
      <TouchableOpacity
        style={s.disclosureHead}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Icon name="book" size={15} color={colors.textSecondary} />
        <Text style={s.disclosureTitle}>Jargon, translated</Text>
        <Text style={s.disclosureCount}>{terms.length}</Text>
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={15} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
      {open &&
        terms.map((t, i) => (
          <View key={i} style={s.termRow}>
            <Text style={s.termName}>{t.term}</Text>
            <Text style={s.termPlain}>{t.plain}</Text>
          </View>
        ))}
    </View>
  );
}

/* ---------- Sections — the long version, for people who want it ---------- */
// "Sometimes people just want to read." The prose never disappeared; it stopped
// being the only entry point.
function Sections({ sections }: { sections: BillBriefData["sections"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // This screen always renders on the dark navy canvas regardless of the
  // phone's appearance setting, so the markdown styles are pinned to dark.
  const markdownStyles = getMarkdownStyles(darkTheme);
  if (sections.length === 0) return null;
  return (
    <View style={s.sectionList} testID="brief-sections">
      {sections.map((sec, i) => {
        const open = openIndex === i;
        return (
          <View key={i} style={s.disclosureCard}>
            <TouchableOpacity
              style={s.disclosureHead}
              activeOpacity={0.7}
              onPress={() => setOpenIndex(open ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Icon name="doc" size={15} color={colors.textSecondary} />
              <Text style={s.disclosureTitle}>{sec.heading}</Text>
              <View style={s.spacer} />
              <View style={open ? s.chevFlip : undefined}>
                <Icon name="chevD" size={15} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
            {open && (
              <View style={s.sectionBody}>
                <Markdown style={markdownStyles}>{sec.body}</Markdown>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Section heading ---------- */
function BlockTitle({ children }: { children: string }) {
  return <Text style={s.blockTitle}>{children}</Text>;
}

/* ---------- BillBrief ---------- */
export function BillBrief({
  data,
  accent = colors.civicBlue,
}: {
  data: BillBriefData;
  accent?: string;
}) {
  return (
    <View style={s.root} testID="bill-brief">
      <Hook text={data.hook} legalStatus={data.legalStatus} accent={accent} />
      <Facts facts={data.facts} />

      <BlockTitle>What would change</BlockTitle>
      <Changes changes={data.changes} accent={accent} />

      <BlockTitle>Who it lands on</BlockTitle>
      <Affected affected={data.affected} />

      <Unknowns unknowns={data.unknowns} />
      <Terms terms={data.terms} />
      <Sections sections={data.sections} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 18 },

  /* hook */
  hookWrap: { flexDirection: "row", gap: 14 },
  hookBar: { width: 3, borderRadius: 2 },
  hookBody: { flex: 1, gap: 7 },
  hookKicker: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.textSecondary,
  },
  hookText: {
    fontFamily: fontEditorial.bold,
    fontSize: 21,
    lineHeight: 29,
    color: colors.white,
  },

  /* facts */
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  factTile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 12,
    padding: 13,
    gap: 3,
  },
  factLabel: {
    fontFamily: fontBody.medium,
    fontSize: 9.5,
    letterSpacing: 0.9,
    color: colors.textSecondary,
  },
  factValue: {
    fontFamily: fontEditorial.bold,
    fontSize: 21,
    color: colors.white,
  },
  factNote: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  /* block heading */
  blockTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    color: colors.white,
    marginBottom: -6,
  },

  /* changes */
  changeList: { gap: 12 },
  changeCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 15,
    gap: 11,
  },
  changeHead: { flexDirection: "row", alignItems: "center" },
  kindChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  kindChipText: {
    fontFamily: fontBody.semibold,
    fontSize: 9.5,
    letterSpacing: 0.9,
  },
  changeIndex: {
    marginLeft: "auto",
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  changeTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  deltaRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  deltaCol: { flex: 1, gap: 5 },
  deltaLabel: {
    fontFamily: fontBody.medium,
    fontSize: 9,
    letterSpacing: 0.9,
    color: colors.textSecondary,
  },
  deltaText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.66)",
  },
  // The "after" column carries the actual change, so it reads at full strength
  // while "now" recedes. This is emphasis, not endorsement.
  deltaTextAfter: { color: "rgba(255,255,255,0.92)" },
  deltaArrow: { paddingTop: 18 },

  /* quote disclosure */
  quoteWrap: {
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingTop: 10,
    gap: 9,
  },
  quoteToggle: { flexDirection: "row", alignItems: "center", gap: 7 },
  quoteToggleText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  quoteBody: {
    backgroundColor: planes.ink,
    borderRadius: 10,
    padding: 12,
  },
  quoteText: {
    fontFamily: fontEditorial.italic,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
  },

  /* affected */
  affectedList: { gap: 10 },
  affectedRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
  },
  affectedIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  affectedBody: { flex: 1, gap: 4 },
  affectedHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  affectedGroup: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  affectedDirection: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  affectedEffect: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
  },

  /* unknowns */
  unknownCard: {
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 14,
    padding: 15,
    gap: 10,
  },
  unknownHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  unknownTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 15,
    color: colors.white,
  },
  unknownRow: { flexDirection: "row", gap: 9 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: colors.textSecondary,
    marginTop: 7,
  },
  unknownText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
  },

  /* disclosures (terms + sections) */
  disclosureCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  disclosureHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  disclosureTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  disclosureCount: {
    marginLeft: "auto",
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  spacer: { flex: 1 },
  chevFlip: { transform: [{ rotate: "180deg" }] },

  /* terms */
  termRow: { marginTop: 13, gap: 3 },
  termName: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  termPlain: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.74)",
  },

  /* sections */
  sectionList: { gap: 10 },
  sectionBody: { marginTop: 4 },
});
