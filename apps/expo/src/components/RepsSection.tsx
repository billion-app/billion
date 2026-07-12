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
import { colors, fontBody } from "~/styles";
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
    <Card style={styles.repCard}>
      {rep.image ? (
        <Image source={{ uri: rep.image }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Icon name="user" size={20} color={colors.textSecondary} />
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
      <Text style={styles.sectionTitle}>Your Elected Officials</Text>
      {query.isLoading ? (
        <ActivityIndicator color={colors.bill} style={styles.loader} />
      ) : query.isError ? (
        <Card>
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
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.white,
  },
  loader: { marginVertical: 12 },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  repCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  repBody: { flex: 1, gap: 2 },
  office: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: { fontFamily: fontBody.semibold, fontSize: 15, color: colors.white },
  party: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  actions: { flexDirection: "row", gap: 16, marginTop: 6 },
  action: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: colors.bill,
  },
  source: {
    fontFamily: fontBody.regular,
    color: colors.textSecondary,
    fontSize: 11.5,
    textDecorationLine: "underline",
  },
});
