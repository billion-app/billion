/**
 * RepsSection — the state legislators for the user's address. Google retired
 * the Civic representatives endpoint (404 "Method not found"), so we derive the
 * user's State Assembly/Senate districts from the ballot contests (Civic leaves
 * the district OCD id null, but the office / district.name carry the chamber +
 * number, e.g. "28th Assembly District") and look the members up via Open
 * States, which the app already integrates. Shared Card/Icon design system.
 */
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQueries } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon } from "~/components/ui";
import { colors, fontBody } from "~/styles";
import { trpc } from "~/utils/api";

interface RepsSectionProps {
  /** Ballot contests — their district OCD ids tell us which districts to look up. */
  contests?: Contest[];
}

interface DistrictRef {
  chamber: "upper" | "lower";
  number: string;
}

/**
 * Pull the user's State Senate + Assembly districts out of the ballot contests.
 * Civic leaves the district OCD id null, so we read the chamber + number from
 * the office string or district.name — e.g. "Member of the State Assembly,
 * District 28" / "28th Assembly District" → { lower, "28" }.
 */
function extractDistricts(contests: Contest[]): DistrictRef[] {
  const seen = new Set<string>();
  const out: DistrictRef[] = [];
  for (const c of contests) {
    const text = `${c.office ?? ""} ${c.district?.name ?? ""}`;
    // Skip federal seats — those aren't in the CA state jurisdiction we query.
    if (/\b(u\.?s\.?|united states|congress|representative)\b/i.test(text)) {
      continue;
    }
    const chamber: DistrictRef["chamber"] | null = /assembly/i.test(text)
      ? "lower"
      : /senate|senator/i.test(text)
        ? "upper"
        : null;
    if (!chamber) continue;
    // "District 28" or "28th ... District" → 28
    const number = (/district\s+(\d+)/i.exec(text) ??
      /\b(\d+)(?:st|nd|rd|th)\b/i.exec(text))?.[1];
    if (!number) continue;
    const key = `${chamber}:${number}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ chamber, number });
    }
  }
  return out;
}

const CHAMBER_LABEL: Record<DistrictRef["chamber"], string> = {
  upper: "State Senate",
  lower: "State Assembly",
};

function RepCard({
  rep,
}: {
  rep: {
    name: string;
    party?: string;
    image?: string;
    title: string;
    phone?: string;
    url?: string;
  };
}) {
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
          {rep.title}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {rep.name}
        </Text>
        {rep.party ? (
          <Text style={styles.party} numberOfLines={1}>
            {rep.party}
          </Text>
        ) : null}
        {(rep.phone ?? rep.url) && (
          <View style={styles.actions}>
            {rep.phone ? (
              <Text
                style={styles.action}
                suppressHighlighting
                onPress={() => void Linking.openURL(`tel:${rep.phone}`)}
              >
                <Icon name="message" size={12} color={colors.bill} /> Call
              </Text>
            ) : null}
            {rep.url ? (
              <Text
                style={styles.action}
                suppressHighlighting
                onPress={() => void Linking.openURL(rep.url ?? "")}
              >
                <Icon name="external" size={12} color={colors.bill} /> Website
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </Card>
  );
}

export function RepsSection({ contests }: RepsSectionProps) {
  const districts = extractDistricts(contests ?? []);

  // One lookup per district, run at the parent so it can own the loading /
  // empty state — otherwise the heading renders above children that each
  // bail to null, leaving an orphaned title with nothing under it.
  const queries = useQueries({
    queries: districts.map((d) =>
      trpc.openStates.getLegislators.queryOptions({
        stateCode: "ca",
        district: d.number,
        orgClassification: d.chamber,
      }),
    ),
  });

  // Nothing to look up until the ballot has resolved with district info.
  if (districts.length === 0) return null;

  const isLoading = queries.some((q) => q.isLoading);
  const reps = districts.flatMap((d, i) =>
    (queries[i]?.data?.results ?? []).map((p) => ({
      key: `${p.id}-${d.chamber}-${d.number}`,
      name: p.name,
      party: p.party,
      image: p.image,
      title: `${CHAMBER_LABEL[d.chamber]} · District ${d.number}`,
      phone: p.offices?.find((o) => o.voice)?.voice,
      url: p.links?.[0]?.url,
    })),
  );

  // Don't show a bare heading while loading produces nothing yet, and drop the
  // section entirely if no legislators came back for any district.
  if (!isLoading && reps.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Your State Legislators</Text>
      {isLoading && reps.length === 0 ? (
        <ActivityIndicator color={colors.bill} style={styles.loader} />
      ) : (
        reps.map(({ key, ...rep }) => <RepCard key={key} rep={rep} />)
      )}
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
});
