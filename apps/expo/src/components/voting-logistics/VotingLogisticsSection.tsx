import type { ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import type { PollingLocation } from "@acme/api";

import type { VotingLogisticsData } from "~/utils/voting-logistics";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import { fontBody, rd, sp, useTheme } from "~/styles";
import {
  describeVotingLocation,
  votingInformationLinks,
  votingLocationGroups,
} from "~/utils/voting-logistics";

export interface VotingLogisticsSectionProps {
  /** Supply only the successful response for the currently selected address/election. */
  data?: VotingLogisticsData;
  status: "idle" | "loading" | "error" | "ready";
}

function InformationLink({ label, url }: { label: string; url: string }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Opens in your browser"
      style={({ pressed }) => [styles.control, { opacity: pressed ? 0.6 : 1 }]}
      onPress={() => {
        void Linking.openURL(url).catch(() =>
          Alert.alert(
            "Could not open link",
            "Please try again or visit your election office's website.",
          ),
        );
      }}
    >
      <Text style={[styles.action, { color: theme.foreground }]}>{label}</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="external" size={16} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
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
        <Text style={[styles.action, { color: theme.textSecondary }]}>
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
      {expanded ? (
        <View style={[styles.details, { backgroundColor: theme.card }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

function LocationRow({ location }: { location: PollingLocation }) {
  const { theme } = useTheme();
  const item = describeVotingLocation(location);
  const hours = location.pollingHours?.trim();
  const secondary = [styles.body, { color: theme.textSecondary }];
  return (
    <View style={[styles.location, { borderColor: theme.border }]}>
      <Text style={[styles.name, { color: theme.foreground }]}>
        {item.name}
      </Text>
      <Text selectable style={secondary}>
        {item.address}
      </Text>
      <Text selectable style={secondary}>
        {hours === undefined || hours === ""
          ? "Hours not supplied"
          : location.pollingHours}
      </Text>
      {location.startDate?.trim() || location.endDate?.trim() ? (
        <Text selectable style={secondary}>
          {location.startDate?.trim() && location.startDate === location.endDate
            ? `Date: ${location.startDate}`
            : [
                location.startDate?.trim()
                  ? `From ${location.startDate}`
                  : undefined,
                location.endDate?.trim()
                  ? `Through ${location.endDate}`
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
              accessibilityRole="header"
              style={[styles.name, { color: theme.foreground }]}
            >
              Location notes
            </Text>
            <Text
              selectable
              style={[styles.reading, { color: theme.foreground }]}
            >
              {location.notes}
            </Text>
          </View>
        ) : null}
        {location.voterServices?.trim() ? (
          <Text selectable style={secondary}>
            Services: {location.voterServices}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[styles.groupTitle, { color: theme.foreground }]}
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
              <Text key={index} style={secondary}>
                {source.label}
              </Text>
            ),
          )
        ) : (
          <Text style={secondary}>Source attribution not supplied.</Text>
        )}
      </Disclosure>
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
                : "Couldn’t load voting locations. Try again or check with your election office."}
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
      {heading}
      {current.mailOnly === true ? (
        <Text style={secondary}>
          Listed as mail-only in this lookup. Check official ballot return
          instructions.
        </Text>
      ) : null}
      {groups
        .filter((group) => group.locations.length)
        .map((group) => (
          <View key={group.title} style={styles.group}>
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: theme.textSecondary }]}
            >
              {group.title}
            </Text>
            {group.locations.map((location, index) => (
              <LocationRow key={index} location={location} />
            ))}
          </View>
        ))}
      {missing.length ? (
        <Text style={secondary}>
          {missing.length === groups.length
            ? "Location details weren’t supplied in this lookup."
            : `Not supplied: ${missing.map((group) => group.title.toLowerCase()).join(", ")}.`}{" "}
          Check with your election office for available options.
        </Text>
      ) : null}
      {links.length ? (
        <View style={[styles.official, { borderColor: theme.border }]}>
          <Text
            accessibilityRole="header"
            style={[styles.groupTitle, { color: theme.textSecondary }]}
          >
            Official information
          </Text>
          {offices.map((office) => (
            <View key={office}>
              <Text style={[styles.caption, { color: theme.textSecondary }]}>
                {office}
              </Text>
              {links
                .filter((link) => link.office === office)
                .map((link) => (
                  <InformationLink
                    key={link.url}
                    label={link.label}
                    url={link.url}
                  />
                ))}
            </View>
          ))}
        </View>
      ) : (
        <Text style={secondary}>
          Official links weren’t supplied. Contact your state or local election
          office.
        </Text>
      )}
      <Disclosure label="About this information" context="voting locations">
        <Text style={secondary}>
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
  section: { padding: sp[4], gap: sp[4] },
  title: { fontFamily: fontBody.semibold, fontSize: 20, lineHeight: 28 },
  groupTitle: { fontFamily: fontBody.semibold, fontSize: 15 },
  name: { fontFamily: fontBody.semibold, fontSize: 17 },
  body: { fontFamily: fontBody.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontBody.regular, fontSize: 13, marginTop: sp[2] },
  group: { gap: sp[2] },
  location: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: sp[1],
    gap: sp[1],
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
    gap: sp[2],
    padding: sp[4],
    marginBottom: sp[3],
    borderRadius: rd.lg,
  },
  noteSection: { gap: sp[2], marginBottom: sp[3] },
  reading: { fontFamily: fontBody.regular, fontSize: 16, lineHeight: 25 },
  official: {
    paddingTop: sp[2],
    gap: sp[2],
  },
  status: { flexDirection: "row", alignItems: "center", gap: sp[3] },
  flex: { flex: 1 },
});
