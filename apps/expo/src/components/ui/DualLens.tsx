/**
 * Dual-Lens — the signature recurring pattern.
 * LensStrip: compact spectrum read-out (tap to expand).
 * LensPanel: two-column "both sides, side by side" card.
 */
import { useState } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useLanguage } from "~/hooks/useLanguage";
import {
  colors,
  fontBody,
  hair,
  planes,
  BillReaderPalette as R,
} from "~/styles";
import { Icon } from "./Icon";

export interface LensSource {
  id: number;
  title: string;
  url: string;
}

export interface LensPoint {
  text: string;
  example?: string | { fact: string; relevance: string };
  sourceIds: number[];
}

export type LensFraming = "proponent_opponent" | "left_right";

export interface LensData {
  // `left_right` is accepted only for compatibility with older cached rows.
  // The UI always presents the two sides as proponents and opponents.
  framing?: LensFraming;
  // Points may be the new cited shape or legacy bare strings (old cached rows).
  left: { stance: string; points: (LensPoint | string)[] };
  right: { stance: string; points: (LensPoint | string)[] };
  sources?: LensSource[];
}

/** Normalize a point to the cited shape, tolerating legacy string points. */
function toPoint(p: LensPoint | string): LensPoint {
  return typeof p === "string" ? { text: p, sourceIds: [] } : p;
}

const NEUTRAL_SIDE_LABELS = [
  { kicker: "PROPONENTS", stance: "Proponents argue" },
  { kicker: "OPPONENTS", stance: "Opponents counter" },
] as const;

function sideLabels(data: LensData) {
  if (data.framing === "left_right") return NEUTRAL_SIDE_LABELS;

  const kicker = (stance: string, fallback: "PROPONENTS" | "OPPONENTS") => {
    if (/^proponents?\b/i.test(stance)) return "PROPONENTS";
    if (/^opponents?\b/i.test(stance)) return "OPPONENTS";
    return fallback;
  };

  return [
    {
      kicker: kicker(data.left.stance, "PROPONENTS"),
      stance: data.left.stance,
    },
    {
      kicker: kicker(data.right.stance, "OPPONENTS"),
      stance: data.right.stance,
    },
  ] as const;
}

/* ---------- LensStrip ---------- */
export function LensStrip({
  weight = 50,
  label,
  onExpand,
}: {
  weight?: number; // 0–100, visual balance only
  label?: string;
  onExpand?: () => void;
}) {
  const { t: tr } = useLanguage();
  return (
    <TouchableOpacity
      activeOpacity={onExpand ? 0.8 : 1}
      onPress={onExpand}
      style={s.stripWrap}
    >
      <View style={s.stripHead}>
        <View style={s.stripHeadLeft}>
          <Icon name="scale" size={16} color={colors.white} />
          <Text style={s.stripLabel} numberOfLines={1}>
            {label ?? tr("readerUi.spectrum")}
          </Text>
        </View>
        {onExpand && (
          <Icon name="chevR" size={15} color={colors.textSecondary} />
        )}
      </View>
      <View style={s.track}>
        <View style={[s.node, { left: "8%", backgroundColor: "#9aa0b3" }]} />
        <View
          style={[
            s.node,
            {
              left: `${weight}%`,
              backgroundColor: colors.white,
              width: 13,
              height: 13,
              marginLeft: -6.5,
            },
          ]}
        />
        <View style={[s.node, { left: "92%", backgroundColor: "#9aa0b3" }]} />
      </View>
      <View style={s.poles}>
        <Text style={s.pole}>{tr("readerUi.progressive")}</Text>
        <Text style={s.pole}>{tr("readerUi.center")}</Text>
        <Text style={s.pole}>{tr("readerUi.conservative")}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ---------- LensPanel ---------- */
export function LensPanel({
  data,
  reader = false,
}: {
  data: LensData;
  reader?: boolean;
}) {
  const s = reader ? readerStyles : defaultStyles;
  const { t: tr } = useLanguage();
  const sources = data.sources ?? [];
  const labels = sideLabels(data);
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <View style={s.panelIcon}>
          <Icon name="scale" size={18} color={colors.white} />
        </View>
        <View>
          <Text style={s.panelTitle}>{tr("readerUi.dualLens")}</Text>
          <Text style={s.panelSub}>{tr("readerUi.competing")}</Text>
        </View>
      </View>
      <View style={s.cols}>
        {(["left", "right"] as const).map((k, i) => {
          const lensAccent = reader ? R.muted : i === 0 ? "#6DD6C7" : "#F2B56B";
          const label = i === 0 ? labels[0] : labels[1];
          return (
            <View
              key={k}
              style={[
                s.col,
                {
                  borderLeftColor: lensAccent,
                  backgroundColor: reader ? "transparent" : `${lensAccent}10`,
                  ...(reader ? { borderWidth: 0, borderLeftWidth: 0 } : {}),
                },
              ]}
            >
              <Text style={[s.colKicker, { color: lensAccent }]}>
                {tr(
                  label.kicker === "PROPONENTS"
                    ? "readerUi.proponents"
                    : "readerUi.opponents",
                )}
              </Text>
              <Text style={s.colStance}>
                {data.framing === "left_right" ||
                label.stance === NEUTRAL_SIDE_LABELS[i]?.stance
                  ? tr(
                      i === 0
                        ? "readerUi.proponentsArgue"
                        : "readerUi.opponentsCounter",
                    )
                  : label.stance}
              </Text>
              <View style={s.points}>
                {data[k].points.map(toPoint).map((p, i) => {
                  const example =
                    typeof p.example === "string"
                      ? { fact: p.example, relevance: undefined }
                      : p.example;
                  return (
                    <View key={i} style={s.pointGroup}>
                      <View style={s.point}>
                        <View
                          style={[s.dot, { backgroundColor: lensAccent }]}
                        />
                        <Text style={s.pointText}>{p.text}</Text>
                      </View>
                      {example ? (
                        <View
                          style={[
                            s.example,
                            {
                              borderColor: `${lensAccent}55`,
                              backgroundColor: reader
                                ? "transparent"
                                : `${lensAccent}0D`,
                            },
                          ]}
                        >
                          <Icon name="pin" size={13} color={lensAccent} />
                          <View style={s.exampleCopy}>
                            <Text
                              style={[s.exampleLabel, { color: lensAccent }]}
                            >
                              {tr("readerUi.example")}
                            </Text>
                            <Text style={s.exampleText}>
                              {example.fact}
                              {p.sourceIds.length > 0 && (
                                <Text style={s.cite}>
                                  {" "}
                                  [{p.sourceIds.join(",")}]
                                </Text>
                              )}
                            </Text>
                            {example.relevance && (
                              <View style={s.relevance}>
                                <Text
                                  style={[
                                    s.relevanceLabel,
                                    { color: lensAccent },
                                  ]}
                                >
                                  {tr("readerUi.shows")}
                                </Text>
                                <Text style={s.relevanceText}>
                                  {example.relevance}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ) : (
                        p.sourceIds.length > 0 && (
                          <Text style={[s.legacyCite, { color: lensAccent }]}>
                            {tr("readerUi.sourcesUpper")} [
                            {p.sourceIds.join(",")}]
                          </Text>
                        )
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      {sources.length > 0 ? (
        <SourcesAccordion sources={sources} reader={reader} />
      ) : (
        <View style={s.footer}>
          <Icon name="info" size={14} color={colors.textSecondary} />
          <Text style={s.footerText}>{tr("readerUi.framingNote")}</Text>
        </View>
      )}
    </View>
  );
}

/* ---------- SourcesAccordion ---------- */
// Sources can run to 20+ items, so keep them collapsed behind a tappable header
// (count + chevron) and expand on demand.
function SourcesAccordion({
  sources,
  reader = false,
}: {
  sources: LensSource[];
  reader?: boolean;
}) {
  const s = reader ? readerStyles : defaultStyles;
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={s.sources}>
      <TouchableOpacity
        style={s.sourcesHeader}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={s.sourcesLabel}>{tr("readerUi.sourcesUpper")}</Text>
        <Text style={s.sourcesCount}>{sources.length}</Text>
        <View style={s.sourcesSpacer} />
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={15} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
      {open &&
        sources.map((src) => (
          <TouchableOpacity
            key={src.id}
            style={s.sourceRow}
            activeOpacity={0.7}
            onPress={() => void Linking.openURL(src.url)}
          >
            <Text style={s.sourceNum}>{src.id}</Text>
            <Text style={s.sourceTitle} numberOfLines={1}>
              {src.title}
            </Text>
            <Icon name="chevR" size={13} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
    </View>
  );
}

function createLensStyles(reader = false) {
  const text = reader ? R.text : colors.white;
  const muted = reader ? R.muted : colors.textSecondary;
  const raised = reader ? R.surface : planes.slate;
  const surface = reader ? R.wash : planes.surface;
  return StyleSheet.create({
    stripWrap: {
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: hair[2],
      borderRadius: 12,
      padding: 14,
    },
    stripHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    stripHeadLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    stripLabel: {
      fontFamily: fontBody.semibold,
      fontSize: reader ? 15 : 12.5,
      color: text,
      flexShrink: 1,
    },
    track: {
      height: 6,
      borderRadius: 999,
      backgroundColor: "rgba(138,143,160,0.28)",
      justifyContent: "center",
    },
    node: {
      position: "absolute",
      width: 11,
      height: 11,
      borderRadius: 999,
      marginLeft: -5.5,
      borderWidth: 2,
      borderColor: planes.navy,
    },
    poles: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    pole: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 9.5,
      letterSpacing: 0.4,
      color: muted,
    },
    panel: {
      backgroundColor: reader ? "transparent" : raised,
      borderWidth: reader ? 0 : 1,
      borderColor: hair[1],
      borderRadius: reader ? 0 : 16,
      padding: reader ? 0 : 18,
    },
    panelHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 14,
    },
    panelIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: surface,
      alignItems: "center",
      justifyContent: "center",
    },
    panelTitle: {
      fontFamily: "InriaSerif-Bold",
      fontSize: 17,
      color: text,
    },
    panelSub: {
      fontFamily: "AlbertSans-Regular",
      fontSize: reader ? 15 : 12,
      color: muted,
    },
    cols: { gap: 10 },
    col: {
      borderLeftWidth: reader ? 0 : 3,
      borderRadius: reader ? 0 : 12,
      padding: reader ? 0 : 14,
      paddingTop: reader ? 16 : 14,
      borderTopWidth: 1,
      borderWidth: reader ? 0 : 1,
      borderColor: hair[1],
    },
    colKicker: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 10,
      letterSpacing: 1,
      color: muted,
      marginBottom: 8,
    },
    colStance: {
      fontFamily: "InriaSerif-Bold",
      fontSize: reader ? 15 : 14.5,
      color: text,
      marginBottom: 10,
    },
    points: { gap: 12 },
    pointGroup: { gap: 7 },
    point: { flexDirection: "row", gap: 8 },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 5,
      marginTop: 7,
    },
    pointText: {
      flex: 1,
      fontFamily: "AlbertSans-Regular",
      fontSize: reader ? 15 : 13,
      color: reader ? R.text : "rgba(255,255,255,0.82)",
      lineHeight: reader ? 26 : 18,
    },
    cite: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 10.5,
      color: reader ? R.link : colors.civicBlue,
    },
    legacyCite: {
      marginLeft: 13,
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 9.5,
      letterSpacing: 0.5,
    },
    example: {
      marginLeft: 13,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderWidth: 1,
      borderRadius: 9,
      padding: 10,
    },
    exampleCopy: { flex: 1, gap: 3 },
    exampleLabel: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 9,
      letterSpacing: 0.8,
    },
    exampleText: {
      fontFamily: "AlbertSans-Regular",
      fontSize: reader ? 15 : 11.5,
      lineHeight: reader ? 26 : 16,
      color: reader ? R.text : "rgba(255,255,255,0.76)",
    },
    relevance: {
      marginTop: 6,
      paddingTop: 7,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: reader ? R.text : "rgba(255,255,255,0.14)",
      gap: 3,
    },
    relevanceLabel: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 8.5,
      letterSpacing: 0.7,
    },
    relevanceText: {
      fontFamily: "AlbertSans-Regular",
      fontSize: reader ? 15 : 11.5,
      lineHeight: reader ? 26 : 16,
      color: reader ? R.text : "rgba(255,255,255,0.86)",
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 14,
    },
    footerText: {
      flex: 1,
      fontFamily: "AlbertSans-Regular",
      fontSize: reader ? 15 : 11.5,
      color: muted,
    },
    sources: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: hair[1],
      gap: 6,
    },
    sourcesHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 2,
    },
    sourcesLabel: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 10,
      letterSpacing: 1,
      color: muted,
    },
    sourcesCount: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 10,
      color: reader ? R.link : colors.civicBlue,
    },
    sourcesSpacer: { flex: 1 },
    chevFlip: { transform: [{ rotate: "180deg" }] },
    sourceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 3,
    },
    sourceNum: {
      fontFamily: "AlbertSans-Medium",
      fontSize: reader ? 15 : 11,
      color: reader ? R.link : colors.civicBlue,
      minWidth: 14,
    },
    sourceTitle: {
      flex: 1,
      fontFamily: "AlbertSans-Regular",
      fontSize: reader ? 15 : 12,
      color: reader ? R.text : "rgba(255,255,255,0.72)",
    },
  });
}
const defaultStyles = createLensStyles();
const readerStyles = createLensStyles(true);
const s = defaultStyles;
