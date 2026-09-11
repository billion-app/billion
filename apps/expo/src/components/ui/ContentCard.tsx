/**
 * ContentCard — Browse / Saved / search-result card.
 * Spine + badge + tag + bookmark + serif title + gist + status + timestamp.
 */
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

import type { ContentTypeKey } from "~/styles";
import { useRelativeActivity } from "~/hooks/useRelativeActivity";
import {
  contentType,
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { contentImageSource } from "~/utils/editorial-visuals";
import { Icon } from "./Icon";
import { Badge, Spine } from "./primitives";

export interface ContentCardItem {
  id: string;
  type: ContentTypeKey;
  tag?: string;
  title: string;
  gist?: string;
  status?: string;
  activityAt?: Date;
  updated?: string;
  meta?: string;
  jurisdictionCode?: string;
  statusTone?: "accent" | "warning";
  thumbnailUrl?: string;
  imageUri?: string;
}

export function ContentCard({
  item,
  onPress,
  onSave,
  saved,
}: {
  item: ContentCardItem;
  onPress?: () => void;
  onSave?: () => void;
  saved?: boolean;
}) {
  const t = contentType[item.type];
  const imageUri = item.imageUri ?? item.thumbnailUrl;
  const imageSource = contentImageSource(imageUri);
  const [imageFailed, setImageFailed] = useState(false);
  const relativeActivity = useRelativeActivity(item.activityAt);
  const status = [item.status, relativeActivity].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.85}
      testID="content-card"
    >
      <Spine type={item.type} />
      <View style={s.top}>
        <View style={s.topLeft}>
          <View testID="content-card-badge">
            <Badge type={item.type} />
          </View>
          {item.tag && <Text style={s.tag}>{item.tag}</Text>}
          {item.jurisdictionCode ? (
            <View style={s.jurisdictionChip}>
              <Text style={s.jurisdictionChipText}>
                {item.jurisdictionCode}
              </Text>
            </View>
          ) : null}
        </View>
        {onSave && (
          <TouchableOpacity
            onPress={(event) => {
              event.stopPropagation();
              onSave();
            }}
            hitSlop={8}
            style={s.bookmark}
            accessibilityRole="button"
            accessibilityLabel={
              saved
                ? `Remove ${item.title} from saved`
                : `Save ${item.title} for later`
            }
            accessibilityState={{ selected: !!saved }}
          >
            <Icon
              name={saved ? "bookmarkFill" : "bookmark"}
              size={19}
              color={saved ? DigestPalette.spark : DigestPalette.quiet}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={s.contentRow}>
        <View style={s.copy}>
          <Text style={s.title} numberOfLines={3} testID="content-card-title">
            {item.title}
          </Text>
          {item.gist ? (
            <Text
              style={s.gist}
              numberOfLines={2}
              testID="content-card-description"
            >
              {item.gist}
            </Text>
          ) : null}
        </View>
        <View style={s.thumbnail} testID="content-card-thumbnail">
          {imageSource && !imageFailed ? (
            <Image
              source={imageSource}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={[s.thumbnailFallback, { backgroundColor: t.color }]}>
              <Text style={s.thumbnailFallbackText}>{t.label}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={s.bottom}>
        {status ? (
          <Text
            style={[
              s.status,
              {
                color:
                  item.statusTone === "warning"
                    ? DigestPalette.spark
                    : DigestPalette.quiet,
              },
            ]}
            numberOfLines={2}
          >
            {status}
          </Text>
        ) : (
          <View />
        )}
        {item.updated ? (
          <Text style={s.updated} numberOfLines={1}>
            {item.updated}
          </Text>
        ) : null}
        {item.meta ? (
          <Text style={s.meta} numberOfLines={2}>
            {item.meta}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    paddingTop: DigestSpace.cardBodyPadTop,
    paddingBottom: DigestSpace.cardBodyPadBottom,
    paddingLeft: 22,
    paddingRight: DigestSpace.cardBodyPadX,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    flexShrink: 1,
    gap: 9,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: DigestSpace.railGap,
  },
  copy: { flex: 1, minWidth: 0 },
  thumbnail: {
    width: 78,
    aspectRatio: 1,
    borderRadius: DigestRadii.coverArt,
    overflow: "hidden",
    backgroundColor: DigestPalette.stone,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  thumbnailFallbackText: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: DigestPalette.inkOnNight,
  },
  tag: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.15,
    textTransform: "uppercase",
    color: DigestPalette.spark,
  },
  jurisdictionChip: {
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menuRow,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: DigestHair.tabActivePill,
  },
  jurisdictionChipText: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: DigestPalette.spark,
  },
  bookmark: { padding: 4 },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 19,
    color: DigestPalette.inkOnNight,
    marginBottom: 4,
    lineHeight: 23,
    letterSpacing: -0.35,
  },
  gist: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: DigestPalette.quiet,
    lineHeight: 19,
    marginBottom: 8,
  },
  bottom: {
    alignItems: "flex-start",
    gap: 4,
    marginTop: 1,
  },
  status: {
    width: "100%",
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  updated: {
    width: "100%",
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: DigestPalette.quiet,
  },
  meta: {
    width: "100%",
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 17,
    color: DigestPalette.quiet,
  },
});
