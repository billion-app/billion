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

import { colors, fontBody, hair, planes } from "~/styles";
import { Icon } from "./Icon";

export interface LensSource {
  id: number;
  title: string;
  url: string;
}

export interface LensPoint {
  text: string;
  example?: string;
  sourceIds: number[];
}

export type LensFraming = "proponent_opponent" | "left_right";

export interface LensData {
  // How the two sides split: ideological (left/right) vs support-based
  // (proponent/opponent). Defaults to proponent/opponent when absent.
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

/** Column axis labels for the current framing (left side, right side). */
function kickers(framing: LensFraming | undefined): [string, string] {
  return framing === "left_right"
    ? ["PROGRESSIVE", "CONSERVATIVE"]
    : ["PROPONENTS", "OPPONENTS"];
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
          <Icon name="scale" size={16} color={colors.white} />
          <Text style={s.stripLabel} numberOfLines={1}>
            {label}
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
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <View style={s.panelIcon}>
          <Icon name="scale" size={18} color={colors.white} />
        </View>
        <View>
          <Text style={s.panelTitle}>Dual-Lens</Text>
          <Text style={s.panelSub}>Competing cases, with sources.</Text>
        </View>
      </View>
      <View style={s.cols}>
        {(["left", "right"] as const).map((k, i) => {
          const lensAccent = i === 0 ? "#6DD6C7" : "#F2B56B";
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
                {kickers(data.framing)[i]}
              </Text>
              <Text style={s.colStance}>{data[k].stance}</Text>
              <View style={s.points}>
                {data[k].points.map(toPoint).map((p, i) => (
                  <View key={i} style={s.pointGroup}>
                    <View style={s.point}>
                      <View style={[s.dot, { backgroundColor: lensAccent }]} />
                      <Text style={s.pointText}>{p.text}</Text>
                    </View>
                    {p.example ? (
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
                          <Text style={[s.exampleLabel, { color: lensAccent }]}>
                            REAL-WORLD EXAMPLE
                          </Text>
                          <Text style={s.exampleText}>
                            {p.example}
                            {p.sourceIds.length > 0 && (
                              <Text style={s.cite}>
                                {" "}
                                [{p.sourceIds.join(",")}]
                              </Text>
                            )}
                          </Text>
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
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {sources.length > 0 ? (
        <SourcesAccordion sources={sources} />
      ) : (
        <View style={s.footer}>
          <Icon name="info" size={14} color={colors.textSecondary} />
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

const s = StyleSheet.create({
  stripWrap: {
    backgroundColor: planes.surface,
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
    fontSize: 12.5,
    color: colors.white,
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
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  panel: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
    padding: 18,
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
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 17,
    color: colors.white,
  },
  panelSub: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  cols: { gap: 10 },
  col: {
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: hair[1],
  },
  colKicker: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  colStance: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 14.5,
    color: colors.white,
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
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 18,
  },
  cite: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 10.5,
    color: colors.civicBlue,
  },
  legacyCite: {
    marginLeft: 13,
    fontFamily: "AlbertSans-Medium",
    fontSize: 9.5,
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
    fontSize: 9,
    letterSpacing: 0.8,
  },
  exampleText: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 11.5,
    lineHeight: 16,
    color: "rgba(255,255,255,0.76)",
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 },
  footerText: {
    flex: 1,
    fontFamily: "AlbertSans-Regular",
    fontSize: 11.5,
    color: colors.textSecondary,
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
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  sourcesCount: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 10,
    color: colors.civicBlue,
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
    fontSize: 11,
    color: colors.civicBlue,
    minWidth: 14,
  },
  sourceTitle: {
    flex: 1,
    fontFamily: "AlbertSans-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },
});
