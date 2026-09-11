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
import { useRelativeActivity } from "~/hooks/useRelativeActivity";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { toCardItem } from "~/utils/content";
import { contentImageSource } from "~/utils/editorial-visuals";
import { featuredBillAccessibilityLabel } from "~/utils/featured-bills";

const CARD_GAP = DigestSpace.railGap;

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
  const relativeActivity = useRelativeActivity(card.activityAt);
  const status = [card.status, relativeActivity].filter(Boolean).join(" · ");
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
        </View>
        <Text style={s.title} numberOfLines={3}>
          {item.title}
        </Text>
        <Text style={s.takeaway} numberOfLines={3}>
          {item.featureTakeaway ?? item.description}
        </Text>
        <Text style={s.status} numberOfLines={2}>
          {status}
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
  section: { marginTop: 10, marginBottom: 4 },
  heading: {
    paddingHorizontal: DigestSpace.screenPadX,
    // Tighten header→card air (CRAFT pass-02 / premium).
    marginBottom: 0,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: DigestPalette.spark,
  },
  subtitle: {
    marginTop: 0,
    marginBottom: 0,
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: DigestPalette.quiet,
  },
  row: {
    // Eat dek descender gap (premium header→card).
    marginTop: -2,
    paddingHorizontal: DigestSpace.screenPadX,
    gap: CARD_GAP,
    alignItems: "flex-start",
  },
  skeletonRow: {
    flexDirection: "row",
    marginTop: -2,
    paddingHorizontal: DigestSpace.screenPadX,
    gap: CARD_GAP,
  },
  card: {
    overflow: "hidden",
    borderRadius: DigestRadii.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
  },
  skeletonCard: { opacity: 0.72 },
  artwork: {
    // Fixed photo band OK; copy below hugs (CRAFT.md).
    height: 152,
    overflow: "hidden",
    backgroundColor: DigestPalette.stone,
  },
  artworkFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DigestPalette.night,
  },
  fallbackCode: {
    fontFamily: fontDisplay.bold,
    fontSize: 50,
    lineHeight: 54,
    color: "rgba(247,244,238,0.22)",
  },
  fallbackLabel: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: DigestPalette.quiet,
  },
  artworkBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: DigestRadii.sourcePill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: DigestPalette.paper,
  },
  artworkBadgeText: {
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: DigestPalette.ink,
  },
  cardCopy: {
    // Hug content — pad only, no minHeight well (CRAFT.md / eggbot).
    paddingHorizontal: DigestSpace.cardBodyPadX,
    paddingTop: 12,
    paddingBottom: 10,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  billNumber: {
    flex: 1,
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: DigestPalette.spark,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
  },
  takeaway: {
    marginTop: 4,
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: DigestPalette.quiet,
  },
  status: {
    // Tight card→meta gap (eggbot: hug / no empty navy under short deks).
    marginTop: 6,
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
    lineHeight: 16,
    color: DigestPalette.spark,
  },
  skeletonPlane: { backgroundColor: "rgba(247,244,238,0.08)" },
  skeletonLine: {
    height: 12,
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: "rgba(247,244,238,0.08)",
  },
});
