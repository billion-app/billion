/**
 * Profile mark — the account affordance in the top right.
 *
 * Feedback and Settings used to be tab bar destinations. They now live behind
 * this mark, which keeps the bottom bar to the three reading destinations.
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";

import type { Href } from "expo-router";
import { useRouter } from "expo-router";

import { DigestPalette as P, fontBody } from "~/styles";
import { trpc } from "~/utils/api";

const INK = P.inkOnNight;
const MUTED = P.quiet;
const CARD_MENU = P.stone;

/** Settled diameter in the compact top bar. */
export const PROFILE_MARK_SIZE = 30;

function initialsFrom(name: string): string {
  const letters = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return letters || "G";
}

/**
 * GAP: no sign-in exists yet, so `auth.getSession` is null in real builds.
 * `initials` is null in that case and the mark falls back to a person glyph
 * rather than announcing a name nobody set.
 */
export function useProfileIdentity() {
  const sessionQuery = useQuery(trpc.auth.getSession.queryOptions());
  const user = sessionQuery.data?.user;
  return {
    name: user?.name ?? null,
    firstName: user ? (user.name.trim().split(" ")[0] ?? null) : null,
    initials: user?.name ? initialsFrom(user.name) : null,
    signedIn: !!user,
  };
}

function PersonGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={12}
        cy={9}
        r={3.4}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d="M5.6 19.2c0.9-3.3 3.4-5 6.4-5s5.5 1.7 6.4 5"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Visual only — callers own the press target and any animation wrapper. */
export function ProfileFace({
  initials,
  size = PROFILE_MARK_SIZE,
}: {
  /** Null until a session exists; renders the person glyph instead. */
  initials: string | null;
  size?: number;
}) {
  return (
    <View
      style={[
        s.face,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {initials ? (
        <Text style={[s.faceText, { fontSize: size * 0.4 }]}>{initials}</Text>
      ) : (
        <PersonGlyph size={size * 0.62} color={INK} />
      )}
    </View>
  );
}

/** Anchored sheet listing the destinations pulled out of the tab bar. */
export function ProfileMenu({
  visible,
  onClose,
  top,
  name,
}: {
  visible: boolean;
  onClose: () => void;
  top: number;
  name: string | null;
}) {
  const router = useRouter();

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.menuRoot} pointerEvents="box-none">
        <Pressable
          style={s.menuScrim}
          onPress={onClose}
          accessibilityLabel="Close profile menu"
        />
        <View style={[s.menuCard, { top }]} accessibilityRole="menu">
          <Text style={s.menuTitle}>{name ?? "Account"}</Text>
          <Pressable
            style={s.menuRow}
            onPress={() => go("/feedback" as Href)}
            accessibilityRole="menuitem"
            accessibilityLabel="Send feedback"
          >
            <Text style={s.menuRowText}>Feedback</Text>
          </Pressable>
          <Pressable
            style={s.menuRow}
            onPress={() => go("/settings" as Href)}
            accessibilityRole="menuitem"
            accessibilityLabel="Open settings"
          >
            <Text style={s.menuRowText}>Settings</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Ready-made mark for screens that do not run the greeting ceremony. */
export function ProfileMarkButton({
  size = PROFILE_MARK_SIZE,
  menuTop,
}: {
  size?: number;
  menuTop: number;
}) {
  const [open, setOpen] = useState(false);
  const { name, initials } = useProfileIdentity();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          name
            ? `Account: ${name}. Open feedback and settings`
            : "Account. Open feedback and settings"
        }
        accessibilityState={{ expanded: open }}
        testID="profile-mark"
      >
        <ProfileFace initials={initials} size={size} />
      </Pressable>
      <ProfileMenu
        visible={open}
        onClose={() => setOpen(false)}
        top={menuTop}
        name={name}
      />
    </>
  );
}

const s = StyleSheet.create({
  face: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_MENU,
    borderWidth: 1,
    borderColor: "rgba(247,244,238,0.22)",
  },
  faceText: {
    fontFamily: fontBody.bold,
    letterSpacing: 0.3,
    color: INK,
  },
  menuRoot: {
    flex: 1,
  },
  menuScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  menuCard: {
    position: "absolute",
    right: 16,
    minWidth: 190,
    backgroundColor: CARD_MENU,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(247,244,238,0.12)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: P.night,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  menuTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: MUTED,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuRowText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: INK,
  },
});
