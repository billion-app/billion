import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import {
  Avatar,
  Card,
  ContentCard,
  Kicker,
  NavHeader,
  PrimaryButton,
} from "~/components/ui";
import { colors, fontBody, fontDisplay, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { formatDate } from "~/utils/dates";

export default function BillSponsorProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const billId = Array.isArray(params.id) ? params.id[0] : params.id;
  const query = useQuery({
    ...trpc.content.getSponsorProfile.queryOptions({
      billId: billId ?? "00000000-0000-0000-0000-000000000000",
    }),
    enabled: !!billId,
  });

  if (query.isLoading) {
    return (
      <View style={s.fullCenter}>
        <ActivityIndicator size="large" color={colors.bill} />
        <Text style={s.loadingText}>Loading sponsor profile…</Text>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={s.screen}>
        <NavHeader title="Bill sponsor" onBack={() => router.back()} />
        <View style={s.fullCenter}>
          <Text style={s.errorTitle}>Sponsor profile unavailable</Text>
          <Text style={s.errorText}>
            This bill does not include sponsor information yet.
          </Text>
        </View>
      </View>
    );
  }

  const { sponsor, sponsoredBills, sourceUrl } = query.data;
  const location = [
    sponsor.state,
    sponsor.district && `District ${sponsor.district}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={s.screen}>
      <NavHeader title="Bill sponsor" onBack={() => router.back()} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={s.hero}>
          <Avatar name={sponsor.initials} size={76} />
          <Text style={s.eyebrow}>Primary sponsor</Text>
          <Text style={s.name}>{sponsor.name}</Text>
          <Text style={s.role}>{sponsor.role}</Text>
          {sponsor.party || location ? (
            <Text style={s.meta}>
              {[sponsor.party, location].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </Card>

        <View style={s.section}>
          <Kicker>About this role</Kicker>
          <Card>
            <Text style={s.body}>
              The primary sponsor is the member of Congress who formally
              introduced the bill. Sponsors guide legislation through the
              process, while other members may join as cosponsors.
            </Text>
          </Card>
        </View>

        <View style={s.section}>
          <Kicker>{`Sponsored legislation · ${sponsoredBills.length}`}</Kicker>
          <View style={s.billList}>
            {sponsoredBills.map((bill) => (
              <ContentCard
                key={bill.id}
                item={{
                  id: bill.id,
                  type: "bill",
                  tag: bill.billNumber,
                  title: bill.title,
                  gist: bill.description,
                  status: bill.status,
                  updated: bill.introducedDate
                    ? `Introduced ${formatDate(bill.introducedDate)}`
                    : undefined,
                  thumbnailUrl: bill.thumbnailUrl,
                }}
                onPress={() =>
                  router.push({
                    pathname: "/article-detail",
                    params: { id: bill.id },
                  })
                }
              />
            ))}
          </View>
        </View>

        <PrimaryButton
          label="View official bill record"
          icon="external"
          onPress={() => void Linking.openURL(sourceUrl)}
          style={s.sourceButton}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: planes.navy,
  },
  loadingText: {
    marginTop: 14,
    fontFamily: fontBody.regular,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    color: colors.white,
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: fontBody.regular,
    color: colors.textSecondary,
  },
  hero: { alignItems: "center", paddingVertical: 24 },
  eyebrow: {
    marginTop: 14,
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.bill,
  },
  name: {
    marginTop: 5,
    textAlign: "center",
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.white,
  },
  role: {
    marginTop: 5,
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.white,
  },
  meta: {
    marginTop: 3,
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  section: { marginTop: 24 },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.86)",
  },
  billList: { gap: 12 },
  sourceButton: { marginTop: 24, width: "100%" },
});
