/**
 * Blocked Content screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Replace MOCK_BLOCKED with real data from tRPC (trpc.user.blocked.list)
 * - TODO: Persist unblock via tRPC mutation (trpc.user.blocked.remove) — call in commitRemoval()
 * - TODO: Sources should be blockable from article cards in the feed (not implemented)
 * - TODO: Topics should be blockable from the content-interests screen
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

interface BlockedItem {
  id: string;
  name: string;
  type: "source" | "topic";
}

// TODO: Replace with tRPC data
const MOCK_BLOCKED: BlockedItem[] = [
  { id: "1", name: "partisan-pundit", type: "source" },
  { id: "2", name: "clickbait-news", type: "source" },
  { id: "3", name: "Cryptocurrency", type: "topic" },
];

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  source: "globe-outline",
  topic: "pricetag-outline",
};

const UNDO_DURATION = 4000;
const TOAST_HEIGHT = 56;

// ─── Pending removal entry ────────────────────────────────────────────────────

interface PendingRemoval {
  key: string;
  item: BlockedItem;
  originalIndex: number;
}

// ─── Single Undo Toast ────────────────────────────────────────────────────────

function UndoToast({
  entry,
  stackIndex,
  onUndo,
  onCommit,
}: {
  entry: PendingRemoval;
  stackIndex: number;
  onUndo: (key: string) => void;
  onCommit: (key: string) => void;
}) {
  const { theme } = useTheme();
  const slideY = useRef(new Animated.Value(80)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUndoRef = useRef(onUndo);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { onUndoRef.current = onUndo; }, [onUndo]);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  useEffect(() => {
    slideY.setValue(80);
    progress.setValue(1);

    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    Animated.timing(progress, { toValue: 0, duration: UNDO_DURATION, easing: Easing.linear, useNativeDriver: false }).start();

    timerRef.current = setTimeout(() => {
      onCommitRef.current(entry.key);
    }, UNDO_DURATION);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [entry.key]);

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.spring(slideY, { toValue: 80, useNativeDriver: true, tension: 80, friction: 12 })
      .start(() => onUndoRef.current(entry.key));
  };

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const bottomOffset = sp[6] + stackIndex * (TOAST_HEIGHT + sp[2]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: theme.card, borderColor: theme.border, bottom: bottomOffset },
        { transform: [{ translateY: slideY }] },
      ]}
    >
      <Animated.View style={[styles.toastBar, { width: barWidth, backgroundColor: colors.teal }]} />
      <View style={styles.toastContent} lightColor="transparent" darkColor="transparent">
        <Ionicons name="shield-checkmark-outline" size={16} color={theme.textSecondary} />
        <Text style={[styles.toastLabel, { color: theme.foreground }]} numberOfLines={1}>
          Unblocked "{entry.item.name}"
        </Text>
        <TouchableOpacity
          onPress={handleUndo}
          style={[styles.undoBtn, { borderColor: colors.teal }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.undoBtnText, { color: colors.teal }]}>Undo</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Swipeable Row ────────────────────────────────────────────────────────────

function SwipeableBlockedRow({
  item,
  onFullSwipe,
}: {
  item: BlockedItem;
  onFullSwipe: (id: string) => void;
}) {
  const { theme } = useTheme();

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const bgColor = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [colors.teal + "00", colors.teal + "88", colors.teal],
      extrapolate: "clamp",
    });
    return (
      <Animated.View style={[styles.unblockAction, { backgroundColor: bgColor }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.white} />
        <Text style={styles.unblockActionText}>Unblock</Text>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
      onSwipeableOpen={() => onFullSwipe(item.id)}
    >
      <View
        style={[styles.row, { borderBottomColor: theme.border, backgroundColor: theme.card }]}
        lightColor={theme.card}
        darkColor={theme.card}
      >
        <View style={styles.rowLeft} lightColor="transparent" darkColor="transparent">
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor:
                  item.type === "source" ? colors.civicBlue + "22" : colors.deepIndigo + "22",
              },
            ]}
            lightColor="transparent"
            darkColor="transparent"
          >
            <Ionicons
              name={TYPE_ICONS[item.type] ?? "ban-outline"}
              size={16}
              color={item.type === "source" ? colors.civicBlue : colors.deepIndigo}
            />
          </View>
          <View style={styles.rowText} lightColor="transparent" darkColor="transparent">
            <Text style={[styles.rowName, { color: theme.foreground }]}>{item.name}</Text>
            <Text style={[styles.rowType, { color: theme.mutedForeground }]}>
              {item.type === "source" ? "Source" : "Topic"}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-back" size={14} color={theme.mutedForeground} />
      </View>
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BlockedContentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  // TODO: Replace with tRPC query data
  const [blocked, setBlocked] = useState<BlockedItem[]>(MOCK_BLOCKED);
  const [pendingQueue, setPendingQueue] = useState<PendingRemoval[]>([]);

  const handleFullSwipe = useCallback((id: string) => {
    const originalIndex = MOCK_BLOCKED.findIndex((i) => i.id === id);
    setBlocked((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const entry: PendingRemoval = { key: `${id}-${Date.now()}`, item, originalIndex };
      setPendingQueue((q) => [...q, entry]);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleUndo = useCallback((key: string) => {
    setPendingQueue((q) => {
      const entry = q.find((e) => e.key === key);
      if (!entry) return q;
      setBlocked((prev) => {
        const next = [...prev];
        const insertAt = next.findIndex(
          (i) => MOCK_BLOCKED.findIndex((m) => m.id === i.id) > entry.originalIndex,
        );
        if (insertAt === -1) next.push(entry.item);
        else next.splice(insertAt, 0, entry.item);
        return next;
      });
      return q.filter((e) => e.key !== key);
    });
  }, []);

  const commitRemoval = useCallback((key: string) => {
    // TODO: Call tRPC mutation to persist unblock for specific item
    setPendingQueue((q) => q.filter((e) => e.key !== key));
  }, []);

  const isEmpty = blocked.length === 0 && pendingQueue.length === 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <View
        style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Blocked Content</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {isEmpty ? (
          <View style={styles.empty} lightColor="transparent" darkColor="transparent">
            <Ionicons name="shield-checkmark-outline" size={48} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nothing blocked</Text>
            <Text style={[styles.emptyHint, { color: theme.mutedForeground }]}>
              Sources and topics you block will appear here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              BLOCKED SOURCES & TOPICS
            </Text>
            <Text style={[styles.swipeHint, { color: theme.mutedForeground }]}>
              Swipe left to unblock
            </Text>
            {blocked.map((item) => (
              <SwipeableBlockedRow key={item.id} item={item} onFullSwipe={handleFullSwipe} />
            ))}
            <View
              style={{ height: sp[6] + pendingQueue.length * (TOAST_HEIGHT + sp[2]) + sp[10] }}
              lightColor="transparent"
              darkColor="transparent"
            />
          </>
        )}
      </ScrollView>

      {pendingQueue.map((entry, i) => (
        <UndoToast
          key={entry.key}
          entry={entry}
          stackIndex={pendingQueue.length - 1 - i}
          onUndo={handleUndo}
          onCommit={commitRemoval}
        />
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp[4],
    paddingVertical: sp[4],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
  },
  scroll: { flex: 1 },
  sectionLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: sp[6],
    marginBottom: sp[1],
    marginHorizontal: sp[5],
  },
  swipeHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginBottom: sp[3],
    marginHorizontal: sp[5],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp[5],
    paddingVertical: sp[4],
    borderBottomWidth: 1,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: rd.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginBottom: 2,
  },
  rowType: { fontFamily: fonts.body, fontSize: 12 },
  unblockAction: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: sp[5],
    gap: sp[2],
    minWidth: 88,
  },
  unblockActionText: {
    color: colors.white,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: sp[10],
    gap: sp[3],
  },
  emptyText: { fontFamily: fonts.bodySemibold, fontSize: 16 },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  toast: {
    position: "absolute",
    left: sp[4],
    right: sp[4],
    borderRadius: rd.lg,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastBar: { height: 3 },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    gap: sp[3],
    height: TOAST_HEIGHT,
  },
  toastLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  undoBtn: {
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    borderRadius: rd.full,
    borderWidth: 1,
  },
  undoBtnText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
});
