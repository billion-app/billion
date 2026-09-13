import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { SectionFlourish, SponsorCrest } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import {
  Avatar,
  Card,
  ContentCard,
  Kicker,
  NavHeader,
  PrimaryButton,
} from "~/components/ui";
import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { formatDate } from "~/utils/dates";

const cardChrome = {
  backgroundColor: P.card,
  borderRadius: DigestRadii.card,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: DigestHair.cardBorder,
} as const;

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
        <ActivityIndicator size="large" color={P.spark} />
        <Text style={s.loadingText}>Loading sponsor profile…</Text>
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={s.screen}>
        <NavHeader
          title="Bill sponsor"
          tone="dark"
          onBack={() => router.back()}
        />
        <View style={s.fullCenter}>
          <Text style={s.errorTitle}>Sponsor profile unavailable</Text>
          <Text style={s.errorText}>
            This bill does not include sponsor information yet.
          </Text>
        </View>
      </View>
    );
  }

  const { jurisdiction, sponsor, sponsoredBills, sourceUrl } = query.data;
  const isStateSponsor = jurisdiction !== "federal";
  const location = [
    sponsor.state,
    sponsor.district && `District ${sponsor.district}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={s.screen}>
      <NavHeader
        title="Bill sponsor"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroMark}>
          <SponsorCrest size={36} />
        </View>
        <Card style={[s.hero, cardChrome]}>
          <View style={s.heroRow}>
            <Avatar
              name={sponsor.initials}
              imageUri={sponsor.imageUrl}
              size={72}
            />
            <View style={s.heroCopy}>
              <Text style={s.eyebrow}>
                {isStateSponsor ? "Primary author" : "Primary sponsor"}
              </Text>
              <Text style={s.name}>{sponsor.name}</Text>
              <Text style={s.role}>{sponsor.role}</Text>
              {sponsor.party || location ? (
                <Text style={s.meta}>
                  {[sponsor.party, location].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        <View style={s.section}>
          <Kicker style={s.kicker}>About this role</Kicker>
          <View style={s.flourishWrap}>
            <SectionFlourish width={96} />
          </View>
          <Card style={[cardChrome, s.aboutCard]}>
            <Text style={s.body}>
              {isStateSponsor
                ? "The primary author is the state legislator who formally introduced the bill. Authors guide legislation through the state Legislature while other members may join as coauthors."
                : "The primary sponsor is the member of Congress who formally introduced the bill. Sponsors guide legislation through the process, while other members may join as cosponsors."}
            </Text>
          </Card>
        </View>

        <View style={s.sectionWide}>
          <Kicker
            style={s.kicker}
          >{`Sponsored legislation · ${sponsoredBills.length}`}</Kicker>
          <View style={s.billList}>
            {sponsoredBills.map((bill) => (
              <ContentCard
                key={bill.id}
                item={{
                  id: bill.id,
                  type: "bill",
                  tag: isStateSponsor
                    ? bill.billNumber.replace(/\s+\([^)]+\)$/, "")
                    : bill.billNumber,
                  title: bill.title,
                  gist: bill.description,
                  status: bill.status,
                  updated: bill.introducedDate
                    ? `Introduced ${formatDate(bill.introducedDate)}`
                    : undefined,
                  thumbnailUrl: bill.thumbnailUrl,
                  imageUri: bill.imageUri,
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
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: DigestSpace.coverPadX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: P.canvas,
  },
  loadingText: {
    marginTop: 14,
    fontFamily: fontBody.regular,
    color: P.quiet,
  },
  errorTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    color: P.inkOnNight,
  },
  errorText: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: fontBody.regular,
    color: P.quiet,
  },
  heroMark: {
    alignItems: "center",
    marginBottom: 12,
  },
  hero: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroCopy: { flex: 1, gap: 4 },
  kicker: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  flourishWrap: { marginBottom: 12, alignItems: "flex-start" },
  eyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
  },
  name: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.45,
    color: P.inkOnNight,
  },
  role: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
  },
  meta: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: P.quiet,
  },
  section: { marginTop: 28 },
  sectionWide: { marginTop: 32 },
  aboutCard: { paddingVertical: 4 },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  billList: { gap: 12, marginTop: 8 },
  sourceButton: { marginTop: 24, width: "100%" },
});
