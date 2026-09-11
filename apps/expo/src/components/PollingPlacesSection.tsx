/**
 * PollingPlacesSection — the "where do I actually vote" logistics that the
 * Civic voterinfo response already carries but the app never rendered.
 * Shows the assigned polling place, early-vote sites, and ballot drop boxes,
 * each with a one-tap Directions link. Built on the shared Card/Icon system
 * so it matches the main ballot tab instead of the old off-brand palette.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import type { Address, PollingLocation } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
/** Civic returns every county vote center under one address; cap each group. */
const COLLAPSED_COUNT = 3;

interface PollingPlacesSectionProps {
  pollingLocations?: PollingLocation[];
  earlyVoteSites?: PollingLocation[];
  dropOffLocations?: PollingLocation[];
  mailOnly?: boolean;
  isLoading?: boolean;
  /** True once an address is set — gates the "no data" copy vs. prompt. */
  hasAddress?: boolean;
}

/** One-line "100 Oak St, San Jose, CA 95112" from a Civic Address. */
function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.line3, `${a.city}, ${a.state} ${a.zip}`.trim()]
    .filter(Boolean)
    .join(", ");
}

/** Open the platform maps app with the location as a search query. */
function openDirections(loc: PollingLocation) {
  const q = encodeURIComponent(
    [loc.name ?? loc.address.locationName, formatAddress(loc.address)]
      .filter(Boolean)
      .join(" "),
  );
  void Linking.openURL(`https://maps.apple.com/?q=${q}`);
}

function LocationCard({
  loc,
  accent,
}: {
  loc: PollingLocation;
  accent: string;
}) {
  const name = loc.name ?? loc.address.locationName ?? "Voting location";
  return (
    <Card
      style={[
        styles.locCard,
        {
          borderRadius: DigestRadii.card,
          borderColor: DigestHair.cardBorder,
          backgroundColor: DigestPalette.card,
        },
      ]}
    >
      <View style={[styles.locDot, { backgroundColor: accent }]} />
      <View style={styles.locBody}>
        <Text style={styles.locName} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.locAddr} numberOfLines={2}>
          {formatAddress(loc.address)}
        </Text>
        {loc.pollingHours ? (
          <View style={styles.hoursRow}>
            <Icon name="clock" size={12} color={DigestPalette.quiet} />
            <Text style={styles.locHours} numberOfLines={2}>
              {loc.pollingHours}
            </Text>
          </View>
        ) : null}
        {loc.notes ? (
          <Text style={styles.locNotes} numberOfLines={3}>
            {loc.notes}
          </Text>
        ) : null}
        <Text
          style={styles.directions}
          onPress={() => openDirections(loc)}
          suppressHighlighting
        >
          <Icon name="pin" size={12} color={DigestPalette.spark} /> Directions
        </Text>
      </View>
    </Card>
  );
}

/** A titled group of locations, collapsed to COLLAPSED_COUNT with a toggle. */
function LocationGroup({
  title,
  locations,
  accent,
  keyPrefix,
}: {
  title: string;
  locations: PollingLocation[];
  accent: string;
  keyPrefix: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflow = locations.length - COLLAPSED_COUNT;
  const visible =
    expanded || overflow <= 0 ? locations : locations.slice(0, COLLAPSED_COUNT);

  return (
    <View style={styles.group}>
      <Kicker style={styles.groupKicker}>{title}</Kicker>
      {visible.map((loc, i) => (
        <LocationCard key={`${keyPrefix}-${i}`} loc={loc} accent={accent} />
      ))}
      {overflow > 0 && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          style={styles.showAll}
        >
          <Text style={styles.showAllText}>
            {expanded ? "Show fewer" : `Show all ${locations.length}`}
          </Text>
          <Icon
            name={expanded ? "chevD" : "chevR"}
            size={14}
            color={DigestPalette.spark}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function PollingPlacesSection({
  pollingLocations,
  earlyVoteSites,
  dropOffLocations,
  mailOnly,
  isLoading,
  hasAddress,
}: PollingPlacesSectionProps) {
  const polling = pollingLocations ?? [];
  const early = earlyVoteSites ?? [];
  const dropOff = dropOffLocations ?? [];
  const hasAny = polling.length + early.length + dropOff.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>VOTING LOCATIONS</Text>
      <Text style={styles.sectionTitle}>Where to Vote</Text>

      {isLoading && (
        <ActivityIndicator color={DigestPalette.spark} style={styles.loader} />
      )}

      {!isLoading && mailOnly && (
        <Card
          style={[
            styles.notice,
            {
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            },
          ]}
        >
          <Icon name="info" size={16} color={DigestPalette.spark} />
          <Text style={styles.noticeText}>
            This is a mail-ballot election — every voter is mailed a ballot. Use
            a drop box below or return it by mail.
          </Text>
        </Card>
      )}

      {!isLoading && polling.length > 0 && (
        <LocationGroup
          title="Your polling place"
          locations={polling}
          accent={DigestPalette.badgeTeal}
          keyPrefix="p"
        />
      )}

      {!isLoading && early.length > 0 && (
        <LocationGroup
          title="Early vote sites"
          locations={early}
          accent={DigestPalette.spark}
          keyPrefix="e"
        />
      )}

      {!isLoading && dropOff.length > 0 && (
        <LocationGroup
          title="Ballot drop boxes"
          locations={dropOff}
          accent={DigestPalette.badgeBlue}
          keyPrefix="d"
        />
      )}

      {!isLoading && !hasAny && (
        <Card
          style={{
            borderRadius: DigestRadii.card,
            borderColor: DigestHair.cardBorder,
            backgroundColor: DigestPalette.card,
          }}
        >
          <Text style={styles.empty}>
            {hasAddress
              ? "No polling locations published for this address yet. They're typically posted closer to election day."
              : "Add your address above to see your polling place."}
          </Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: DigestSpace.screenPadX,
    marginBottom: 24,
    gap: 16,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
  },
  groupKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
  },
  loader: { marginVertical: 12 },
  group: { gap: 10 },
  showAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  showAllText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.spark,
  },
  locCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    padding: 14,
  },
  locDot: { width: 4, borderRadius: 2 },
  locBody: { flex: 1, gap: 4 },
  locName: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: DigestPalette.inkOnNight,
  },
  locAddr: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: DigestPalette.quiet,
    lineHeight: 18,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 2,
  },
  locHours: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: DigestPalette.quiet,
    lineHeight: 17,
  },
  locNotes: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: DigestPalette.quiet,
    lineHeight: 18,
    marginTop: 2,
  },
  directions: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.spark,
    marginTop: 6,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: DigestPalette.inkOnNight,
    lineHeight: 19,
  },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    textAlign: "center",
  },
});
