/**
 * Saved Articles screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Replace MOCK_SAVED with real data from tRPC (e.g. trpc.content.saved.list)
 * - TODO: Persist unsave action via tRPC mutation (trpc.content.saved.remove) — call in commitRemoval()
 * - TODO: Navigate to article detail on card tap (router.push with content id)
 * - TODO: Implement sort/filter controls (by date, by type)
 * - TODO: Paginate / infinite scroll once real data is wired
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

interface SavedItem {
  id: string;
  type: "bill" | "order" | "case" | "news";
  title: string;
  date: string;
  color: string;
}

// TODO: Replace with real data from tRPC
const MOCK_SAVED: SavedItem[] = [
  {
    id: "1",
    type: "bill",
    title: "Infrastructure Investment and Jobs Act — Title IX Amendments",
    date: "Feb 14, 2026",
    color: colors.civicBlue,
  },
  {
    id: "2",
    type: "order",
    title: "Executive Order on AI Safety and National Security Standards",
    date: "Feb 12, 2026",
    color: colors.deepIndigo,
  },
  {
    id: "3",
    type: "case",
    title: "Gonzalez v. Department of Labor — Circuit Court Ruling",
    date: "Feb 10, 2026",
    color: colors.teal,
  },
  {
    id: "4",
    type: "bill",
    title: "Clean Energy Transition Act of 2026",
    date: "Feb 8, 2026",
    color: colors.civicBlue,
  },
];

const TYPE_LABELS: Record<string, string> = {
  bill: "BILL",
  order: "ORDER",
  case: "CASE",
  news: "NEWS",
};

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  bill: "document-text-outline",
  order: "briefcase-outline",
  case: "scale-outline",
  news: "newspaper-outline",
};

const UNDO_DURATION = 4000;
const TOAST_HEIGHT = 56; // px per toast for stacking offset

// ─── Pending removal entry ────────────────────────────────────────────────────

interface PendingRemoval {
  key: string; // unique per removal (item.id + timestamp)
  item: SavedItem;
  // Original position in MOCK_SAVED order, for re-insertion
  originalIndex: number;
}

// ─── Single Undo Toast ────────────────────────────────────────────────────────

function UndoToast({
  entry,
  stackIndex,   // 0 = bottom (newest), 1 = above that, etc.
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
  // Stable refs so animation callbacks never go stale
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

  // Stack offset: each older toast sits higher up
  const bottomOffset = sp[6] + stackIndex * (TOAST_HEIGHT + sp[2]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: theme.card, borderColor: theme.border, bottom: bottomOffset },
        { transform: [{ translateY: slideY }] },
      ]}
    >
      <Animated.View style={[styles.toastBar, { width: barWidth, backgroundColor: colors.civicBlue }]} />
      <View style={styles.toastContent} lightColor="transparent" darkColor="transparent">
        <Ionicons name="bookmark-outline" size={16} color={theme.textSecondary} />
        <Text style={[styles.toastLabel, { color: theme.foreground }]} numberOfLines={1}>
          Unsaved "{entry.item.title}"
        </Text>
        <TouchableOpacity
          onPress={handleUndo}
          style={[styles.undoBtn, { borderColor: colors.civicBlue }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.undoBtnText, { color: colors.civicBlue }]}>Undo</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Swipeable Card ───────────────────────────────────────────────────────────

function SwipeableCard({
  item,
  onFullSwipe,
}: {
  item: SavedItem;
  onFullSwipe: (id: string) => void;
}) {
  const { theme } = useTheme();

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const bgColor = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [colors.civicBlue + "00", "#C0392B88", "#C0392B"],
      extrapolate: "clamp",
    });
    return (
      <Animated.View style={[styles.deleteAction, { backgroundColor: bgColor }]}>
        <Ionicons name="bookmark-outline" size={22} color={colors.white} />
        <Text style={styles.deleteActionText}>Unsave</Text>
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
      {/* TODO: Tap to navigate to article detail */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop} lightColor="transparent" darkColor="transparent">
          <View style={styles.cardTopLeft} lightColor="transparent" darkColor="transparent">
            <Ionicons name={TYPE_ICONS[item.type] ?? "document-outline"} size={14} color={item.color} />
            <View
              style={[styles.typeBadge, { backgroundColor: item.color + "22" }]}
              lightColor="transparent"
              darkColor="transparent"
            >
              <Text style={[styles.typeBadgeText, { color: item.color }]}>
                {TYPE_LABELS[item.type] ?? item.type.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[styles.date, { color: theme.mutedForeground }]}>{item.date}</Text>
        </View>
        <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={3}>
          {item.title}
        </Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SavedArticlesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  // TODO: Replace with real data from tRPC query
  const [items, setItems] = useState<SavedItem[]>(MOCK_SAVED);
  const [pendingQueue, setPendingQueue] = useState<PendingRemoval[]>([]);

  const handleFullSwipe = useCallback((id: string) => {
    // Find original index in the canonical source list for stable re-insertion
    const originalIndex = MOCK_SAVED.findIndex((i) => i.id === id);
    setItems((prev) => {
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
      // Re-insert at original position relative to current list
      setItems((prev) => {
        const next = [...prev];
        // Find the right insertion point by matching originalIndex order
        const insertAt = next.findIndex(
          (i) => MOCK_SAVED.findIndex((m) => m.id === i.id) > entry.originalIndex,
        );
        if (insertAt === -1) next.push(entry.item);
        else next.splice(insertAt, 0, entry.item);
        return next;
      });
      return q.filter((e) => e.key !== key);
    });
  }, []);

  const commitRemoval = useCallback((key: string) => {
    // TODO: Call tRPC mutation to persist removal for the specific item
    setPendingQueue((q) => q.filter((e) => e.key !== key));
  }, []);

  const isEmpty = items.length === 0 && pendingQueue.length === 0;

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
        <Text style={[styles.title, { color: theme.foreground }]}>Saved Articles</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      {isEmpty ? (
        <View style={styles.empty} lightColor="transparent" darkColor="transparent">
          <Ionicons name="bookmark-outline" size={48} color={theme.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>Nothing saved yet</Text>
          <Text style={[styles.emptyHint, { color: theme.mutedForeground }]}>
            Bookmark articles from the feed to read them later.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {items.length} saved
          </Text>
          {items.map((item) => (
            <SwipeableCard key={item.id} item={item} onFullSwipe={handleFullSwipe} />
          ))}
          {/* Spacer so last card isn't hidden behind toast stack */}
          <View
            style={{ height: sp[6] + pendingQueue.length * (TOAST_HEIGHT + sp[2]) + sp[10] }}
            lightColor="transparent"
            darkColor="transparent"
          />
        </ScrollView>
      )}

      {/* Stacked undo toasts — newest at bottom, older ones shift up */}
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
  scroll: { flex: 1, paddingHorizontal: sp[4] },
  count: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: sp[5],
    marginBottom: sp[3],
    marginHorizontal: sp[1],
  },
  card: {
    borderRadius: rd.lg,
    borderWidth: 1,
    padding: sp[4],
    marginBottom: sp[3],
    gap: sp[2],
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
  },
  typeBadge: {
    paddingHorizontal: sp[2],
    paddingVertical: 2,
    borderRadius: rd.sm,
  },
  typeBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  date: { fontFamily: fonts.body, fontSize: 12 },
  cardTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteAction: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: sp[5],
    gap: sp[2],
    marginBottom: sp[3],
    borderRadius: rd.lg,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    minWidth: 88,
  },
  deleteActionText: {
    color: colors.white,
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sp[3],
    paddingHorizontal: sp[10],
  },
  emptyTitle: { fontFamily: fonts.bodySemibold, fontSize: 16 },
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
