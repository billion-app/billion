/**
 * ContentCard — Browse / Saved / search-result card.
 * Spine + badge + tag + bookmark + serif title + gist + status + timestamp.
 */
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

import type { ContentTypeKey } from "~/styles";
import { colors, contentType, fontBody, hair, planes } from "~/styles";
import { Icon } from "./Icon";
import { Badge, Spine } from "./primitives";

export interface ContentCardItem {
  id: string;
  type: ContentTypeKey;
  tag?: string;
  title: string;
  gist?: string;
  status?: string;
  updated?: string;
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
  const [imageFailed, setImageFailed] = useState(false);
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
        </View>
        {onSave && (
          <TouchableOpacity onPress={onSave} hitSlop={8} style={s.bookmark}>
            <Icon
              name={saved ? "bookmarkFill" : "bookmark"}
              size={19}
              color={saved ? colors.white : colors.textSecondary}
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
          {imageUri && !imageFailed ? (
            <Image
              source={{ uri: imageUri }}
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
        {item.status ? (
          <Text style={[s.status, { color: t.color }]} numberOfLines={2}>
            {item.status}
          </Text>
        ) : (
          <View />
        )}
        {item.updated ? (
          <Text style={s.updated} numberOfLines={1}>
            {item.updated}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 22,
    paddingRight: 18,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 3,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  copy: { flex: 1, minWidth: 0 },
  thumbnail: {
    width: 78,
    aspectRatio: 1,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
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
    color: colors.white,
  },
  tag: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
  bookmark: { padding: 4 },
  title: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 19,
    color: colors.white,
    marginBottom: 7,
    lineHeight: 23,
  },
  gist: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
    marginBottom: 12,
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
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
});
