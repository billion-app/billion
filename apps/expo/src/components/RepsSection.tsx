/**
 * Current federal and state lawmakers for a user's registered address.
 * Districts come from Google Civic's supported divisionsByAddress endpoint;
 * office-holder data comes from Open States' nightly public exports.
 */
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import type { ElectedOfficial } from "@acme/api";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import {
  DigestHair,
  DigestPalette,
  DigestSpace,
  fontBody,
  fontDisplay,
} from "~/styles";
import { trpc } from "~/utils/api";

interface RepsSectionProps {
  address?: string | null;
  enabled?: boolean;
}

function openUrl(url: string) {
  void Linking.openURL(url);
}

function RepCard({ rep }: { rep: ElectedOfficial }) {
  return (
    <View style={styles.repCard}>
      {rep.image ? (
        <Image source={{ uri: rep.image }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Icon name="user" size={18} color={DigestPalette.quiet} />
        </View>
      )}
      <View style={styles.repBody}>
        <Text style={styles.office} numberOfLines={1}>
          {rep.office}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {rep.name}
        </Text>
        {rep.party ? (
          <Text style={styles.party} numberOfLines={1}>
            {rep.party}
          </Text>
        ) : null}
        {(rep.phone ?? rep.email ?? rep.url) && (
          <View style={styles.actions}>
            {rep.phone ? (
              <Text
                style={styles.action}
                suppressHighlighting
                onPress={() => openUrl(`tel:${rep.phone}`)}
              >
                Call
              </Text>
            ) : null}
            {rep.email ? (
              <Text
                style={styles.action}
                suppressHighlighting
                onPress={() => openUrl(`mailto:${rep.email}`)}
              >
                Email
              </Text>
            ) : null}
            {rep.url ? (
              <Text
                style={styles.action}
                suppressHighlighting
                onPress={() => openUrl(rep.url ?? "")}
              >
                Website
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

export function RepsSection({ address, enabled = true }: RepsSectionProps) {
  const query = useQuery({
    ...trpc.civic.getElectedOfficials.queryOptions({ address: address ?? "" }),
    enabled: enabled && !!address,
  });

  if (!enabled || !address) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Representatives</Text>
      {query.isLoading ? (
        <ActivityIndicator color={DigestPalette.spark} style={styles.loader} />
      ) : query.isError ? (
        <Text style={styles.empty}>
          Couldn&apos;t load officials for this address.
        </Text>
      ) : (
        query.data?.officials.map((rep, i) => (
          <View key={rep.id} style={i > 0 ? styles.rowHair : undefined}>
            <RepCard rep={rep} />
          </View>
        ))
      )}
      {query.data ? (
        <Text
          style={styles.source}
          suppressHighlighting
          onPress={() => openUrl(query.data.source.url)}
        >
          Current legislator data: Open States
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: DigestSpace.screenPadX,
    marginBottom: 16,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  loader: { marginVertical: 12 },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: DigestPalette.quiet,
    lineHeight: 22,
  },
  rowHair: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
  },
  repCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DigestPalette.stone,
    alignItems: "center",
    justifyContent: "center",
  },
  repBody: { flex: 1, gap: 2 },
  office: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  name: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: DigestPalette.inkOnNight,
  },
  party: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: DigestPalette.quiet,
  },
  actions: { flexDirection: "row", gap: 16, marginTop: 6 },
  action: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: DigestPalette.spark,
  },
  source: {
    fontFamily: fontBody.regular,
    color: DigestPalette.quiet,
    fontSize: 11.5,
    textDecorationLine: "underline",
  },
});
