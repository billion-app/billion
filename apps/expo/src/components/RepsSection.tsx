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
import { Card, Icon } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
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
    <Card
      style={[
        styles.repCard,
        {
          borderRadius: DigestRadii.card,
          borderColor: DigestHair.cardBorder,
          backgroundColor: DigestPalette.card,
        },
      ]}
    >
      {rep.image ? (
        <Image source={{ uri: rep.image }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Icon name="user" size={20} color={DigestPalette.quiet} />
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
    </Card>
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
      <Text style={styles.kicker}>REPRESENTATIVES</Text>
      <Text style={styles.sectionTitle}>Your Elected Officials</Text>
      {query.isLoading ? (
        <ActivityIndicator color={DigestPalette.spark} style={styles.loader} />
      ) : query.isError ? (
        <Card
          style={{
            borderRadius: DigestRadii.card,
            borderColor: DigestHair.cardBorder,
            backgroundColor: DigestPalette.card,
          }}
        >
          <Text style={styles.empty}>
            We couldn&apos;t load elected officials for this address right now.
          </Text>
        </Card>
      ) : (
        query.data?.officials.map((rep) => <RepCard key={rep.id} rep={rep} />)
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
    marginBottom: 24,
    gap: 12,
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
  loader: { marginVertical: 12 },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    lineHeight: 20,
  },
  repCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DigestHair.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  repBody: { flex: 1, gap: 2 },
  office: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
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
