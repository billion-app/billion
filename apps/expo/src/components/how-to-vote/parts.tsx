/**
 * Shared atoms for the How to Vote screen.
 *
 * These are the pieces the design spec calls out as reusable: the status chip
 * (icon + word + colour, in that order of importance), the fact row, the
 * numbered checklist, the location row, and the official-source footer.
 *
 * Status is never communicated by colour alone — every chip carries a word and
 * an icon so the screen survives greyscale, colour-blindness, and VoiceOver.
 */
import { Linking, StyleSheet, TouchableOpacity, View } from "react-native";

import type { Address, PollingLocation } from "@acme/api";

import type { IconName } from "~/components/ui";
import type { MethodChip, OfficialSource, VotingStep } from "~/utils/voting";
import { Text } from "~/components/Themed";
import { Card, Icon } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { formatCivicAddress } from "~/utils/voting";

/** Civic returns every county vote center under one address; cap each group. */
const COLLAPSED_COUNT = 3;

const TONE_COLOR: Record<MethodChip["tone"], string> = {
  positive: colors.green[500],
  urgent: colors.yellow[500],
  neutral: colors.textSecondary,
  negative: colors.red[500],
};

const TONE_BORDER: Record<MethodChip["tone"], string> = {
  positive: "rgba(16,185,129,0.34)",
  urgent: "rgba(245,158,11,0.34)",
  neutral: hair[2],
  negative: "rgba(239,68,68,0.34)",
};

/* ---------- StatusChip ---------- */

export function StatusChip({ chip }: { chip: MethodChip }) {
  const color = TONE_COLOR[chip.tone];
  return (
    <View style={[s.chip, { borderColor: TONE_BORDER[chip.tone] }]}>
      <Icon name={chip.icon as IconName} size={11} color={color} />
      <Text style={[s.chipText, { color }]}>{chip.label}</Text>
    </View>
  );
}

/* ---------- FactRow — deadlines, requirements, registration ---------- */

export function FactRow({
  icon,
  iconColor = colors.textSecondary,
  label,
  value,
  action,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  value?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={s.factRow}>
      <Icon name={icon} size={15} color={iconColor} style={s.factIcon} />
      <View style={s.factBody}>
        <Text style={s.factLabel}>{label}</Text>
        {value ? <Text style={s.factValue}>{value}</Text> : null}
      </View>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <Text style={s.factAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- StepList — numbered checklist ---------- */

export function StepList({ steps }: { steps: VotingStep[] }) {
  return (
    <View style={s.steps}>
      {steps.map((step, i) => (
        <View key={step.title} style={s.step}>
          <View style={s.stepBadge}>
            <Text style={s.stepNum}>{i + 1}</Text>
          </View>
          <View style={s.stepBody}>
            <Text style={s.stepTitle}>{step.title}</Text>
            {step.detail ? (
              <Text style={s.stepDetail}>{step.detail}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- LocationRow ---------- */

/** Open the platform maps app with the location as a search query. */
export function openDirections(loc: PollingLocation) {
  const q = encodeURIComponent(
    [loc.name ?? loc.address.locationName, formatCivicAddress(loc.address)]
      .filter(Boolean)
      .join(" "),
  );
  void Linking.openURL(`https://maps.apple.com/?q=${q}`);
}

export function LocationRow({
  loc,
  accent,
}: {
  loc: PollingLocation;
  accent: string;
}) {
  const name = loc.name ?? loc.address.locationName ?? "Voting location";
  const address: Address = loc.address;
  return (
    <View style={s.loc}>
      <View style={[s.locSpine, { backgroundColor: accent }]} />
      <View style={s.locBody}>
        <Text style={s.locName} numberOfLines={2}>
          {name}
        </Text>
        <Text style={s.locAddr}>{formatCivicAddress(address)}</Text>
        <View style={s.locHoursRow}>
          <Icon name="clock" size={12} color={colors.textSecondary} />
          <Text style={s.locHours}>
            {loc.pollingHours ?? "Hours not published"}
          </Text>
        </View>
        {loc.notes ? <Text style={s.locNotes}>{loc.notes}</Text> : null}
        <TouchableOpacity
          style={s.dirBtn}
          activeOpacity={0.8}
          hitSlop={8}
          onPress={() => openDirections(loc)}
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${name}`}
          accessibilityHint="Opens in Maps"
        >
          <Icon name="pin" size={13} color={colors.bill} />
          <Text style={s.dirText}>Get directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** A titled group of locations, collapsed to COLLAPSED_COUNT with a toggle. */
export function LocationList({
  locations,
  accent,
  expanded,
  onToggle,
}: {
  locations: PollingLocation[];
  accent: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const overflow = locations.length - COLLAPSED_COUNT;
  const visible =
    expanded || overflow <= 0 ? locations : locations.slice(0, COLLAPSED_COUNT);

  return (
    <View style={s.locList}>
      {visible.map((loc, i) => (
        <LocationRow
          key={`${loc.name ?? "loc"}-${i}`}
          loc={loc}
          accent={accent}
        />
      ))}
      {overflow > 0 && (
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          style={s.showAll}
          accessibilityRole="button"
        >
          <Text style={s.showAllText}>
            {expanded ? "Show fewer" : `Show all ${locations.length}`}
          </Text>
          <Icon
            name={expanded ? "chevD" : "chevR"}
            size={14}
            color={colors.bill}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- LinkRow — an explicit, labelled hand-off out of the app ---------- */

export function LinkRow({
  label,
  url,
  onPress,
}: {
  label: string;
  url?: string;
  onPress?: () => void;
}) {
  if (!url && !onPress) return null;
  return (
    <TouchableOpacity
      style={s.linkRow}
      activeOpacity={0.8}
      onPress={() => {
        if (onPress) return onPress();
        if (url) void Linking.openURL(url);
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Opens in your browser"
    >
      <Text style={s.linkText}>{label}</Text>
      <Icon name="external" size={15} color={colors.bill} />
    </TouchableOpacity>
  );
}

/* ---------- UnavailableNote — a named gap, never a silent one ---------- */

export function UnavailableNote({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={s.unavailable}>
      <Icon
        name="alert"
        size={15}
        color={colors.textSecondary}
        style={s.factIcon}
      />
      <View style={s.factBody}>
        <Text style={s.unavailableTitle}>{title}</Text>
        <Text style={s.unavailableBody}>{body}</Text>
      </View>
    </View>
  );
}

/* ---------- SourceFooter — the last card on every state ---------- */

export function SourceFooter({
  source,
  note,
}: {
  source?: OfficialSource;
  /** Overrides the default verification line (e.g. "Last checked …"). */
  note?: string;
}) {
  return (
    <Card style={s.source}>
      <View style={s.sourceHead}>
        <Icon name="shield" size={15} color={colors.textSecondary} />
        <Text style={s.sourceKicker}>OFFICIAL INFORMATION</Text>
      </View>
      <Text style={s.sourceName}>
        {source?.name ?? "Your state or county election office"}
      </Text>
      <Text style={s.sourceVerified}>
        {note ??
          "Locations and contacts come from Google Civic. Deadlines aren't verified in Billion yet — confirm them with your county."}
      </Text>
      <LinkRow
        label="Open the election office site"
        url={source?.electionInfoUrl ?? source?.electionRulesUrl}
      />
      <LinkRow label="Find my state election office" url="https://vote.gov" />
    </Card>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: planes.surface,
    alignSelf: "flex-start",
  },
  chipText: { fontFamily: fontBody.semibold, fontSize: 11 },

  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  factIcon: { marginTop: 2 },
  factBody: { flex: 1, minWidth: 0 },
  factLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.white,
  },
  factValue: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 1,
  },
  factAction: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.bill,
    paddingLeft: 8,
  },

  steps: { gap: 13 },
  step: { flexDirection: "row", gap: 10 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontFamily: fontBody.bold, fontSize: 11, color: colors.white },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.white,
  },
  stepDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },

  locList: { gap: 10 },
  loc: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: planes.surface,
    borderRadius: 12,
    padding: 13,
  },
  locSpine: { width: 3, borderRadius: 2 },
  locBody: { flex: 1, minWidth: 0, gap: 3 },
  locName: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.white,
  },
  locAddr: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  locHoursRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locHours: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  locNotes: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.7)",
  },
  dirBtn: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: planes.hi,
    borderWidth: 1,
    borderColor: hair[2],
    alignSelf: "flex-start",
  },
  dirText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: colors.bill,
  },
  showAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 2,
  },
  showAllText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.bill,
  },

  linkRow: {
    marginTop: 12,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
  },
  linkText: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.bill,
  },

  unavailable: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: hair[2],
  },
  unavailableTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.white,
  },
  unavailableBody: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },

  source: { borderColor: hair[2] },
  sourceHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  sourceKicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 0.9,
    color: colors.textSecondary,
  },
  sourceName: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.white,
    marginTop: 10,
  },
  sourceVerified: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 5,
  },
});
