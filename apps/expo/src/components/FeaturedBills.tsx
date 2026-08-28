import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";

import type { FeaturedBillItem } from "~/utils/featured-bills";
import { Text } from "~/components/Themed";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";
import { toCardItem } from "~/utils/content";
import { contentImageSource } from "~/utils/editorial-visuals";
import { featuredBillAccessibilityLabel } from "~/utils/featured-bills";

const CARD_GAP = 12;

function FeaturedBillCard({
  item,
  index,
  total,
  width,
  onPress,
}: {
  item: FeaturedBillItem;
  index: number;
  total: number;
  width: number;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const card = toCardItem(item, { showJurisdiction: true });
  const imageSource = contentImageSource(item.imageUri ?? item.thumbnailUrl);

  return (
    <TouchableOpacity
      style={[s.card, { width }]}
      activeOpacity={0.86}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={featuredBillAccessibilityLabel(item, index, total)}
      testID="featured-bill-card"
    >
      <View style={s.artwork}>
        {imageSource && !imageFailed ? (
          <Image
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            onError={() => setImageFailed(true)}
            accessible={false}
          />
        ) : (
          <View style={s.artworkFallback}>
            <Text style={s.fallbackCode}>{item.jurisdictionCode ?? "US"}</Text>
            <Text style={s.fallbackLabel}>FEATURED BILL</Text>
          </View>
        )}
        <View style={s.artworkBadge}>
          <Text style={s.artworkBadgeText}>FEATURED</Text>
        </View>
      </View>

      <View style={s.cardCopy}>
        <View style={s.identityRow}>
          <Text style={s.billNumber} numberOfLines={1}>
            {card.tag ?? "BILL"}
          </Text>
          <Text style={s.position}>
            {index + 1}/{total}
          </Text>
        </View>
        <Text style={s.title} numberOfLines={3}>
          {item.title}
        </Text>
        <Text style={s.takeaway} numberOfLines={3}>
          {item.featureTakeaway ?? item.description}
        </Text>
        <Text style={s.status} numberOfLines={2}>
          {card.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function FeaturedBillsSkeleton({ width }: { width: number }) {
  return (
    <View
      style={s.skeletonRow}
      accessibilityLabel="Loading featured bills"
      accessibilityRole="progressbar"
    >
      {[0, 1].map((index) => (
        <View key={index} style={[s.card, s.skeletonCard, { width }]}>
          <View style={[s.artwork, s.skeletonPlane]} />
          <View style={s.cardCopy}>
            <View style={[s.skeletonLine, { width: "28%" }]} />
            <View style={[s.skeletonLine, { width: "88%", height: 20 }]} />
            <View style={[s.skeletonLine, { width: "70%", height: 14 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function FeaturedBills({
  items,
  loading,
  onOpen,
}: {
  items: readonly FeaturedBillItem[];
  loading: boolean;
  onOpen: (item: FeaturedBillItem, index: number) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(264, Math.min(screenWidth * 0.79, 360));

  if (!loading && items.length === 0) return null;

  return (
    <View style={s.section} testID="featured-bills">
      <View style={s.heading}>
        <Text style={s.kicker}>FEATURED BILLS</Text>
        <Text style={s.subtitle}>Legislation worth your attention</Text>
      </View>
      {loading ? (
        <FeaturedBillsSkeleton width={cardWidth} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          snapToInterval={cardWidth + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          nestedScrollEnabled
        >
          {items.map((item, index) => (
            <FeaturedBillCard
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              width={cardWidth}
              onPress={() => onOpen(item, index)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 20 },
  heading: { paddingHorizontal: 20, marginBottom: 12 },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.bill,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  row: { paddingHorizontal: 20, gap: CARD_GAP },
  skeletonRow: { flexDirection: "row", paddingHorizontal: 20, gap: CARD_GAP },
  card: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hair[2],
    backgroundColor: planes.slate,
  },
  skeletonCard: { opacity: 0.72 },
  artwork: {
    height: 164,
    overflow: "hidden",
    backgroundColor: planes.surface,
  },
  artworkFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18356F",
  },
  fallbackCode: {
    fontFamily: fontDisplay.bold,
    fontSize: 50,
    lineHeight: 54,
    color: "rgba(255,255,255,0.22)",
  },
  fallbackLabel: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.72)",
  },
  artworkBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "rgba(14,21,48,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  artworkBadgeText: {
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.white,
  },
  cardCopy: { minHeight: 208, padding: 16 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 9,
  },
  billNumber: {
    flex: 1,
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.bill,
  },
  position: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 21,
    lineHeight: 25,
    color: colors.white,
  },
  takeaway: {
    marginTop: 8,
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  status: {
    marginTop: 12,
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.bill,
  },
  skeletonPlane: { backgroundColor: planes.hi },
  skeletonLine: {
    height: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: planes.hi,
  },
});
