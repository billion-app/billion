import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { FeaturedBillItem } from "~/utils/featured-bills";
import { Text } from "~/components/Themed";
import {
  DigestPalette,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
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
          </View>
        )}
        <LinearGradient
          colors={[
            "transparent",
            "rgba(14,21,48,0.2)",
            "rgba(14,21,48,0.78)",
            DigestPalette.canvas,
          ]}
          locations={[0.12, 0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.overlay}>
          {card.tag ? (
            <Text style={s.billNumber} numberOfLines={1}>
              {card.tag}
            </Text>
          ) : null}
          <Text style={s.title} numberOfLines={3}>
            {item.title}
          </Text>
        </View>
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
        </View>
      ))}
    </View>
  );
}

export function FeaturedBills({
  items,
  loading,
  onOpen,
  onLockParent,
}: {
  items: readonly FeaturedBillItem[];
  loading: boolean;
  onOpen: (item: FeaturedBillItem, index: number) => void;
  /** Freeze the enclosing vertical list while a card is being swiped. */
  onLockParent?: (locked: boolean) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.max(280, Math.min(screenWidth * 0.84, 380));
  const lock = (held: boolean) => onLockParent?.(held);

  if (!loading && items.length === 0) return null;

  return (
    <View
      style={s.section}
      testID="featured-bills"
      onTouchStart={() => lock(true)}
      onTouchEnd={() => lock(false)}
      onTouchCancel={() => lock(false)}
    >
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
          directionalLockEnabled
          nestedScrollEnabled
          alwaysBounceVertical={false}
          alwaysBounceHorizontal
          overScrollMode="never"
          onScrollEndDrag={() => lock(false)}
          onMomentumScrollEnd={() => lock(false)}
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
  section: { marginTop: 4, marginBottom: 8 },
  row: {
    paddingHorizontal: DigestSpace.screenPadX,
    gap: CARD_GAP,
    alignItems: "flex-start",
  },
  skeletonRow: {
    flexDirection: "row",
    paddingHorizontal: DigestSpace.screenPadX,
    gap: CARD_GAP,
  },
  card: {
    overflow: "hidden",
    borderRadius: DigestRadii.card,
  },
  skeletonCard: { opacity: 0.72 },
  artwork: {
    height: 280,
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
    fontSize: 56,
    lineHeight: 60,
    color: "rgba(247,244,238,0.22)",
  },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
  billNumber: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(247,244,238,0.88)",
    marginBottom: 6,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: DigestPalette.inkOnNight,
    textShadowColor: "rgba(14,21,48,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  skeletonPlane: { backgroundColor: "rgba(247,244,238,0.08)" },
});
