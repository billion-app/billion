import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { PollingLocation } from "@acme/api";

import type { VotingLogisticsData } from "~/utils/voting-logistics";
import {
  ElectionOfficeLink,
  SourceLink as InformationLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  planes,
  rd,
  sp,
  useTheme,
} from "~/styles";
import {
  describeVotingLocation,
  votingDateLabel,
  votingInformationLinks,
  votingLocationGroups,
} from "~/utils/voting-logistics";

export interface VotingLogisticsSectionProps {
  /** Supply only the successful response for the currently selected address/election. */
  data?: VotingLogisticsData;
  status: "idle" | "loading" | "error" | "ready";
}

function Disclosure({
  label,
  context,
  children,
}: {
  label: string;
  context: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${context}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [
          styles.control,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.action, { color: theme.foreground }]}>
          {label}
        </Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon
            name={expanded ? "chevD" : "chevR"}
            size={16}
            color={theme.textSecondary}
          />
        </View>
      </Pressable>
      {expanded ? <View style={styles.details}>{children}</View> : null}
    </View>
  );
}

function LocationRow({ location }: { location: PollingLocation }) {
  const { theme } = useTheme();
  const item = describeVotingLocation(location);
  const hours = location.pollingHours?.trim();
  const facts = [styles.body, { color: theme.foreground }];
  return (
    <View style={[styles.location, { borderColor: theme.border }]}>
      <Text style={[styles.name, { color: theme.foreground }]}>
        {item.name}
      </Text>
      <Text selectable style={facts}>
        {item.address}
      </Text>
      <Text selectable style={facts}>
        {hours === undefined || hours === ""
          ? "Hours not supplied"
          : `Hours: ${location.pollingHours}`}
      </Text>
      {location.startDate?.trim() || location.endDate?.trim() ? (
        <Text selectable style={facts}>
          {location.startDate?.trim() && location.startDate === location.endDate
            ? `Date: ${votingDateLabel(location.startDate)}`
            : [
                location.startDate?.trim()
                  ? `From ${votingDateLabel(location.startDate)}`
                  : undefined,
                location.endDate?.trim()
                  ? `Through ${votingDateLabel(location.endDate)}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
        </Text>
      ) : null}
      <Disclosure
        label={
          location.notes?.trim() || location.voterServices?.trim()
            ? "Notes & sources"
            : "Sources"
        }
        context={item.name}
      >
        {location.notes?.trim() ? (
          <View style={styles.noteSection}>
            <Text
              selectable
              style={[styles.reading, { color: theme.foreground }]}
            >
              {location.notes}
            </Text>
          </View>
        ) : null}
        {location.voterServices?.trim() ? (
          <Text selectable style={facts}>
            Services: {location.voterServices}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[styles.sourceHeading, { color: theme.foreground }]}
        >
          Sources
        </Text>
        {item.sources.length ? (
          item.sources.map((source, index) =>
            source.url ? (
              <InformationLink
                key={index}
                label={source.label}
                url={source.url}
              />
            ) : (
              <Text key={index} style={facts}>
                {source.label}
              </Text>
            ),
          )
        ) : (
          <Text style={facts}>Source attribution not supplied.</Text>
        )}
      </Disclosure>
    </View>
  );
}

function LocationGroup({
  group,
}: {
  group: ReturnType<typeof votingLocationGroups>[number];
}) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  return (
    <View style={styles.surface}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group.title}, ${group.locations.length} ${group.locations.length === 1 ? "location" : "locations"} supplied`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [
          styles.groupHeader,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View
          style={styles.iconTile}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon
            name={group.title === "Early voting" ? "calendar" : "pin"}
            size={20}
            color={colors.bill}
          />
        </View>
        <View style={styles.groupLabel}>
          <Text style={[styles.groupTitle, { color: theme.foreground }]}>
            {group.title}
          </Text>
          <Text style={[styles.summary, { color: theme.foreground }]}>
            {group.locations.length}{" "}
            {group.locations.length === 1 ? "location" : "locations"} supplied
          </Text>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon
            name={expanded ? "chevD" : "chevR"}
            size={18}
            color={theme.foreground}
          />
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.groupBody}>
          {group.locations.map((location, index) => (
            <LocationRow key={index} location={location} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Presentation only: no network requests, eligibility checks, or deadline arithmetic. */
export function VotingLogisticsSection({
  data,
  status,
}: VotingLogisticsSectionProps) {
  const { theme } = useTheme();
  const secondary = [styles.body, { color: theme.textSecondary }];
  const heading = (
    <Text
      accessibilityRole="header"
      style={[styles.title, { color: theme.foreground }]}
    >
      Voting locations
    </Text>
  );
  if (status !== "ready") {
    return (
      <View style={styles.section}>
        {heading}
        <View style={styles.status}>
          {status === "loading" ? (
            <ActivityIndicator
              accessibilityLabel="Loading voting locations"
              color={theme.textSecondary}
            />
          ) : null}
          <Text
            accessibilityLiveRegion="polite"
            style={[...secondary, styles.flex]}
          >
            {status === "idle"
              ? "Choose an address and election to see voting locations."
              : status === "loading"
                ? "Loading locations…"
                : "Voting locations couldn’t be loaded."}
          </Text>
        </View>
      </View>
    );
  }
  const current = data ?? {};
  const groups = votingLocationGroups(current);
  const missing = groups.filter((group) => !group.locations.length);
  const links = votingInformationLinks(current);
  const offices = [...new Set(links.map((link) => link.office))];
  return (
    <View style={styles.section}>
      {missing.length < groups.length ? heading : null}
      {groups
        .filter((group) => group.locations.length)
        .map((group) => (
          <LocationGroup key={group.title} group={group} />
        ))}
      <View style={[styles.surface, styles.resources]}>
        <View style={styles.resourceHeader}>
          <View
            style={styles.iconTile}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="globe" size={20} color={colors.bill} />
          </View>
          <Text
            accessibilityRole="header"
            style={[
              styles.groupTitle,
              styles.flex,
              { color: theme.foreground },
            ]}
          >
            Voting information links
          </Text>
        </View>
        {current.mailOnly === true ? (
          <Text style={[styles.body, { color: theme.foreground }]}>
            This lookup lists your precinct as mail-only. Confirm how to return
            your ballot with your election office.
          </Text>
        ) : null}
        {missing.length ? (
          <Text style={[styles.body, { color: theme.foreground }]}>
            {missing.length === groups.length
              ? "No voting locations were returned for this lookup."
              : `Not supplied: ${missing.map((group) => group.title.toLowerCase()).join(", ")}.`}
          </Text>
        ) : null}
        {links.length ? (
          offices.map((office) => (
            <View key={office} style={styles.officeLinks}>
              <Text style={[styles.caption, { color: theme.foreground }]}>
                {office}
              </Text>
              {links
                .filter((link) => link.office === office)
                .map((link) => (
                  <InformationLink
                    key={link.url}
                    label={link.label}
                    url={link.url}
                    prominence={
                      missing.length === groups.length && link === links[0]
                        ? "primary"
                        : "secondary"
                    }
                  />
                ))}
            </View>
          ))
        ) : (
          <ElectionOfficeLink
            prominence={
              missing.length === groups.length ? "primary" : "secondary"
            }
          />
        )}
      </View>
      <Disclosure label="About this information" context="voting locations">
        <Text style={[styles.body, { color: theme.foreground }]}>
          Missing details don’t establish whether a voting option is available.
          Check official registration information for deadlines and
          requirements. This lookup doesn’t confirm your registration or track
          your mail ballot.
        </Text>
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: sp[4] },
  title: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  groupTitle: { fontFamily: fontEditorial.bold, fontSize: 16, lineHeight: 19 },
  sourceHeading: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  name: { fontFamily: fontBody.semibold, fontSize: 17 },
  body: { fontFamily: fontBody.regular, fontSize: 16, lineHeight: 24 },
  caption: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  surface: {
    backgroundColor: planes.slate,
    borderColor: hair[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rd.lg,
  },
  groupHeader: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    padding: sp[4],
    gap: sp[3],
  },
  groupLabel: { flex: 1, gap: sp[1] },
  summary: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: rd.md,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  groupBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[2],
    padding: sp[4],
    gap: sp[4],
  },
  resources: { padding: sp[4], gap: sp[3] },
  resourceHeader: { flexDirection: "row", alignItems: "center", gap: sp[3] },
  officeLinks: { gap: sp[2] },
  location: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: sp[1],
    gap: sp[2],
  },
  control: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
    paddingVertical: sp[2],
  },
  action: { fontFamily: fontBody.medium, fontSize: 15, flex: 1 },
  details: {
    backgroundColor: planes.ink,
    gap: sp[2],
    padding: sp[4],
    marginBottom: sp[3],
    borderRadius: rd.md,
  },
  noteSection: { marginBottom: sp[3] },
  reading: { fontFamily: fontBody.regular, fontSize: 16, lineHeight: 25 },
  status: { flexDirection: "row", alignItems: "center", gap: sp[3] },
  flex: { flex: 1 },
});
