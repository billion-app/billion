/**
 * MethodCard — one way to vote, collapsed to a scannable row and expanded to a
 * numbered checklist plus the locations it applies to.
 *
 * Collapsed is the default because the whole point of the screen is that a
 * voter can see every option at once and pick one. Expanding is what reveals
 * procedure; only one card is open at a time (owned by the parent).
 */
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import type { IconName } from "~/components/ui";
import type { VotingMethod, VotingMethodId } from "~/utils/voting";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import {
  LinkRow,
  LocationList,
  StatusChip,
  StepList,
  UnavailableNote,
} from "./parts";

const METHOD_ICON: Record<VotingMethodId, IconName> = {
  mail: "mail",
  dropBox: "inbox",
  earlyInPerson: "calendar",
  electionDay: "pin",
};

const LOCATION_ACCENT: Record<VotingMethodId, string> = {
  mail: colors.bill,
  dropBox: colors.green[500],
  earlyInPerson: colors.bill,
  electionDay: colors.green[500],
};

/** Kicker above the location list, per method. */
const LOCATION_TITLE: Record<VotingMethodId, string> = {
  mail: "WHERE TO SEND IT",
  dropBox: "DROP BOX LOCATIONS",
  earlyInPerson: "EARLY VOTE SITES",
  electionDay: "POLLING PLACES",
};

export function MethodCard({
  method,
  expanded,
  onToggle,
  authorityName,
  locationFinderUrl,
}: {
  method: VotingMethod;
  expanded: boolean;
  onToggle: () => void;
  /** Named above the steps, so whose words they are is clear before reading. */
  authorityName?: string;
  /** Official location finder — the fallback when nothing is published. */
  locationFinderUrl?: string;
}) {
  const [showAllLocations, setShowAllLocations] = useState(false);
  const dimmed = method.status === "limited" || method.status === "closed";

  return (
    <View
      style={[
        s.card,
        expanded && s.cardOpen,
        dimmed && !expanded && s.cardDimmed,
      ]}
    >
      <TouchableOpacity
        style={s.head}
        activeOpacity={0.85}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${method.title}. ${method.chip.label}. ${method.subtitle}`}
        accessibilityHint={
          expanded ? "Double-tap to collapse" : "Double-tap for the steps"
        }
      >
        <View style={[s.iconTile, expanded && s.iconTileOpen]}>
          <Icon
            name={METHOD_ICON[method.id]}
            size={19}
            color={dimmed ? colors.textSecondary : colors.bill}
          />
        </View>
        <View style={s.body}>
          <Text style={[s.title, dimmed && s.titleDimmed]}>{method.title}</Text>
          {method.subtitle ? (
            <Text style={s.subtitle}>{method.subtitle}</Text>
          ) : null}
          <View style={s.chips}>
            <StatusChip chip={method.chip} />
          </View>
        </View>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={expanded ? colors.white : "#5B6172"}
          style={s.chevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={s.open}>
          {/* Steps are a summary of the authority's instructions, never
              Billion's own advice — so they only render when we can name and
              link the source they came from. */}
          {method.steps.length > 0 && (
            <>
              <Text style={s.kicker}>
                {authorityName
                  ? `SUMMARIZED FROM ${authorityName.toUpperCase()}`
                  : "SUMMARIZED FROM YOUR ELECTION OFFICE"}
              </Text>
              <StepList steps={method.steps} />
              <LinkRow
                label="Full instructions from the source"
                url={method.instructionsUrl}
              />
            </>
          )}

          {method.steps.length === 0 && (
            <LinkRow
              label="Instructions from your election office"
              url={method.instructionsUrl ?? locationFinderUrl}
            />
          )}

          {method.locations.length > 0 ? (
            <>
              <View style={s.rule} />
              <Text style={s.kicker}>{LOCATION_TITLE[method.id]}</Text>
              <LocationList
                locations={method.locations}
                accent={LOCATION_ACCENT[method.id]}
                expanded={showAllLocations}
                onToggle={() => setShowAllLocations((v) => !v)}
              />
            </>
          ) : method.status === "unknown" ? (
            <>
              <View style={s.rule} />
              <UnavailableNote
                title="Billion doesn't have these details yet"
                body="We won't guess at a date or a location. Your county election office is always authoritative."
              />
              <LinkRow
                label="Find locations on the official site"
                url={locationFinderUrl}
              />
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
    overflow: "hidden",
  },
  cardOpen: { borderColor: hair[3] },
  cardDimmed: { opacity: 0.62 },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  iconTileOpen: { backgroundColor: planes.hi },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: colors.white,
  },
  titleDimmed: { color: colors.textSecondary },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  chevron: { marginTop: 11 },
  open: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: hair[1],
  },
  rule: { height: 1, backgroundColor: hair[2], marginVertical: 14 },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 10,
  },
});
