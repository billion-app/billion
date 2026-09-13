/**
 * ContentCard — Browse / Saved result row.
 * Cash App activity rhythm: air, serif title, hairline — no boxed tile.
 */
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

import type { ContentTypeKey } from "~/styles";
import { useRelativeActivity } from "~/hooks/useRelativeActivity";
import {
  contentType,
  DigestPalette,
  DigestRadii,
  fontBody,
  fontDisplay,
} from "~/styles";
import { contentImageSource } from "~/utils/editorial-visuals";
import { followAccessibilityLabel } from "~/utils/follow-copy";
import { Icon } from "./Icon";

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
      <View style={s.top}>
        <Text style={s.kicker} testID="content-card-badge">
          {t.label}
          {item.tag ? ` · ${item.tag}` : ""}
        </Text>
        {item.jurisdictionCode ? (
          <Text style={s.jurisdictionChipText}>{item.jurisdictionCode}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {onSave ? (
          <TouchableOpacity
            onPress={(event) => {
              event.stopPropagation();
              onSave();
            }}
            hitSlop={8}
            style={s.bookmark}
            accessibilityRole="button"
            accessibilityLabel={followAccessibilityLabel(
              item.type,
              !!saved,
              item.title,
            )}
            accessibilityState={{ selected: !!saved }}
          >
            <Icon
              name={saved ? "bookmarkFill" : "bookmark"}
              size={18}
              color={saved ? DigestPalette.spark : DigestPalette.quiet}
            />
          </TouchableOpacity>
        ) : null}
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
              numberOfLines={1}
            >
              {status}
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
            <View style={s.thumbnailFallback}>
              <Text style={s.thumbnailFallbackText}>{t.label}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
    paddingVertical: 18,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  copy: { flex: 1, minWidth: 0 },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: DigestRadii.coverArt,
    overflow: "hidden",
    backgroundColor: DigestPalette.stone,
  },
  thumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DigestPalette.canvas,
  },
  thumbnailFallbackText: {
    fontFamily: fontBody.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: DigestPalette.spark,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: DigestPalette.spark,
  },
  jurisdictionChipText: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: DigestPalette.quiet,
  },
  bookmark: { padding: 2 },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    color: DigestPalette.inkOnNight,
    lineHeight: 26,
    letterSpacing: -0.45,
  },
  gist: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    lineHeight: 20,
    marginTop: 4,
  },
  status: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
});
