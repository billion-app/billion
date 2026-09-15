import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { VotingLogisticsData } from "~/utils/voting-logistics";
import { sp, typography, useTheme } from "~/styles";
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
    <Text
      accessibilityRole="link"
      accessibilityHint="Opens in your browser"
      style={[typography.body, styles.link, { color: theme.primary }]}
      onPress={() => {
        void Linking.openURL(url).catch(() =>
          Alert.alert(
            "Could not open link",
            "Please try again. You can also visit your election office's website directly.",
          ),
        );
      }}
    >
      {label}
    </Text>
  );
}

/** Presentation only: no network requests, eligibility checks, or deadline arithmetic. */
export function VotingLogisticsSection({
  data,
  status,
}: VotingLogisticsSectionProps) {
  const { theme } = useTheme();
  const textStyle = [typography.body, { color: theme.foreground }];
  if (status !== "ready") {
    return (
      <View style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[typography.h3, { color: theme.foreground }]}
        >
          Voting logistics
        </Text>
        {status === "loading" ? (
          <ActivityIndicator accessibilityLabel="Loading voting logistics" />
        ) : null}
        <Text style={textStyle}>
          {status === "idle"
            ? "Look up an address and election to see voting logistics."
            : status === "loading"
              ? "Loading voting information…"
              : "Voting logistics could not be loaded. Try the lookup again or check with your election office."}
        </Text>
      </View>
    );
  }
  const current = data ?? {};
  const links = votingInformationLinks(current);
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[typography.h3, { color: theme.foreground }]}
      >
        Voting logistics
      </Text>
      {current.mailOnly === true ? (
        <Text style={textStyle}>
          The supplied data marks this precinct as mail-only. Check your
          election office's instructions for ballot return options and
          requirements.
        </Text>
      ) : null}
      {votingLocationGroups(current).map((group) => (
        <View key={group.title} style={styles.group}>
          <Text
            accessibilityRole="header"
            style={[typography.h4, { color: theme.foreground }]}
          >
            {group.title}
          </Text>
          {group.locations.length === 0 ? (
            <Text style={textStyle}>
              No locations were supplied in this lookup. This does not establish
              whether this voting option is available. Check with your election
              office.
            </Text>
          ) : (
            group.locations.map((location, index) => {
              const item = describeVotingLocation(location);
              return (
                <View
                  key={index}
                  style={[styles.card, { borderColor: theme.border }]}
                >
                  <Text style={[typography.h4, { color: theme.foreground }]}>
                    {item.name}
                  </Text>
                  <Text selectable style={textStyle}>
                    {item.address}
                  </Text>
                  {item.details.map((detail, detailIndex) => (
                    <Text key={detailIndex} selectable style={textStyle}>
                      {detail}
                    </Text>
                  ))}
                  {item.sources.length ? (
                    item.sources.map((source, sourceIndex) =>
                      source.url ? (
                        <InformationLink
                          key={sourceIndex}
                          label={`Source: ${source.label}`}
                          url={source.url}
                        />
                      ) : (
                        <Text key={sourceIndex} style={textStyle}>
                          Source: {source.label}
                        </Text>
                      ),
                    )
                  ) : (
                    <Text style={textStyle}>
                      Source attribution was not supplied for this location.
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      ))}
      <Text
        accessibilityRole="header"
        style={[typography.h4, { color: theme.foreground }]}
      >
        Official voting information
      </Text>
      {links.map((link) => (
        <InformationLink
          key={`${link.office}-${link.label}-${link.url}`}
          label={`${link.label} · ${link.office}`}
          url={link.url}
        />
      ))}
      {!links.length ? (
        <Text style={textStyle}>
          Election-office links were not supplied in this lookup. Contact your
          state or local election office for voting information.
        </Text>
      ) : null}
      <Text style={textStyle}>
        Check official registration information for deadlines and requirements.
        This lookup does not confirm your registration or track your mail
        ballot.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: sp[4], gap: sp[4] },
  group: { gap: sp[3] },
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: sp[3],
    gap: sp[2],
  },
  link: {
    minHeight: 44,
    paddingVertical: sp[2],
    textDecorationLine: "underline",
  },
});
