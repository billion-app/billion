/**
 * ContentCard — Browse / Saved / search-result card.
 * Spine + badge + tag + bookmark + serif title + gist + status + timestamp.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
          <Badge type={item.type} />
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
      <Text style={s.title} testID="content-card-title">
        {item.title}
      </Text>
      {item.gist ? (
        <Text
          style={s.gist}
          numberOfLines={3}
          testID="content-card-description"
        >
          {item.gist}
        </Text>
      ) : null}
      <View style={s.bottom}>
        {item.status ? (
          <Text style={[s.status, { color: t.color }]}>{item.status}</Text>
        ) : (
          <View />
        )}
        {item.updated ? <Text style={s.updated}>{item.updated}</Text> : null}
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
    marginBottom: 8,
    lineHeight: 23,
  },
  gist: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 21,
    marginBottom: 14,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  status: { fontFamily: fontBody.semibold, fontSize: 12.5 },
  updated: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
});
