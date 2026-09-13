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

import {
  DigestHair,
  DigestRadii,
  fontBody,
  fontDisplay,
  DigestPalette as P,
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
  label = "Across the spectrum",
  onExpand,
}: {
  weight?: number; // 0–100, visual balance only
  label?: string;
  onExpand?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onExpand ? 0.8 : 1}
      onPress={onExpand}
      style={s.stripWrap}
    >
      <View style={s.stripHead}>
        <View style={s.stripHeadLeft}>
          <Icon name="scale" size={16} color={P.inkOnNight} />
          <Text style={s.stripLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {onExpand && <Icon name="chevR" size={15} color={P.quiet} />}
      </View>
      <View style={s.track}>
        <View style={[s.node, { left: "8%", backgroundColor: P.quiet }]} />
        <View
          style={[
            s.node,
            {
              left: `${weight}%`,
              backgroundColor: P.spark,
              width: 13,
              height: 13,
              marginLeft: -6.5,
            },
          ]}
        />
        <View style={[s.node, { left: "92%", backgroundColor: P.quiet }]} />
      </View>
      <View style={s.poles}>
        <Text style={s.pole}>PROGRESSIVE</Text>
        <Text style={s.pole}>CENTER</Text>
        <Text style={s.pole}>CONSERVATIVE</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ---------- LensPanel ---------- */
export function LensPanel({ data }: { data: LensData }) {
  const sources = data.sources ?? [];
  const labels = sideLabels(data);
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <View style={s.panelIcon}>
          <Icon name="scale" size={18} color={P.spark} />
        </View>
        <View>
          <Text style={s.panelTitle}>Dual-Lens</Text>
          <Text style={s.panelSub}>Competing cases, with sources.</Text>
        </View>
      </View>
      <View style={s.cols}>
        {(["left", "right"] as const).map((k, i) => {
          const lensAccent = i === 0 ? P.badgeTeal : P.spark;
          const label = i === 0 ? labels[0] : labels[1];
          return (
            <View
              key={k}
              style={[
                s.col,
                {
                  borderLeftColor: lensAccent,
                  backgroundColor: `${lensAccent}10`,
                },
              ]}
            >
              <Text style={[s.colKicker, { color: lensAccent }]}>
                {label.kicker}
              </Text>
              <Text style={s.colStance}>{label.stance}</Text>
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
                              backgroundColor: `${lensAccent}0D`,
                            },
                          ]}
                        >
                          <Icon name="pin" size={13} color={lensAccent} />
                          <View style={s.exampleCopy}>
                            <Text
                              style={[s.exampleLabel, { color: lensAccent }]}
                            >
                              REAL-WORLD EXAMPLE
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
                                  WHAT IT SHOWS
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
                            SOURCES [{p.sourceIds.join(",")}]
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
        <SourcesAccordion sources={sources} />
      ) : (
        <View style={s.footer}>
          <Icon name="info" size={14} color={P.quiet} />
          <Text style={s.footerText}>
            Framing summarized from the official source text.
          </Text>
        </View>
      )}
    </View>
  );
}

/* ---------- SourcesAccordion ---------- */
// Sources can run to 20+ items, so keep them collapsed behind a tappable header
// (count + chevron) and expand on demand.
function SourcesAccordion({ sources }: { sources: LensSource[] }) {
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
        <Text style={s.sourcesLabel}>SOURCES</Text>
        <Text style={s.sourcesCount}>{sources.length}</Text>
        <View style={s.sourcesSpacer} />
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={15} color={P.quiet} />
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
            <Icon name="chevR" size={13} color={P.quiet} />
          </TouchableOpacity>
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  stripWrap: {
    backgroundColor: P.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
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
    fontSize: 12.5,
    color: P.inkOnNight,
    flexShrink: 1,
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: DigestHair.sectionRule,
    justifyContent: "center",
  },
  node: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 999,
    marginLeft: -5.5,
    borderWidth: 2,
    borderColor: P.canvas,
  },
  poles: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pole: {
    fontFamily: fontBody.medium,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: P.quiet,
  },
  panel: {
    backgroundColor: P.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
    padding: 16,
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
    borderRadius: DigestRadii.menuRow,
    backgroundColor: DigestHair.tabActivePill,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: P.inkOnNight,
  },
  panelSub: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: P.quiet,
  },
  cols: { gap: 10 },
  col: {
    borderLeftWidth: 2,
    borderRadius: DigestRadii.menuRow,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  colKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: P.quiet,
    marginBottom: 8,
  },
  colStance: {
    fontFamily: fontDisplay.bold,
    fontSize: 14.5,
    letterSpacing: -0.2,
    color: P.inkOnNight,
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
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: "rgba(247,244,238,0.82)",
    lineHeight: 18,
  },
  cite: {
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    color: P.spark,
  },
  legacyCite: {
    marginLeft: 13,
    fontFamily: fontBody.medium,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  example: {
    marginLeft: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DigestRadii.menuRow,
    padding: 10,
  },
  exampleCopy: { flex: 1, gap: 3 },
  exampleLabel: {
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  exampleText: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(247,244,238,0.76)",
  },
  relevance: {
    marginTop: 6,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
    gap: 3,
  },
  relevanceLabel: {
    fontFamily: fontBody.bold,
    fontSize: 8.5,
    letterSpacing: 0.7,
  },
  relevanceText: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(247,244,238,0.86)",
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 },
  footerText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: P.quiet,
  },
  sources: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.cardBorder,
    gap: 6,
  },
  sourcesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  sourcesLabel: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: P.quiet,
  },
  sourcesCount: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    color: P.spark,
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
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: P.spark,
    minWidth: 14,
  },
  sourceTitle: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: "rgba(247,244,238,0.72)",
  },
});
