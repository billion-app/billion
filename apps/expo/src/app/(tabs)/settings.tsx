import type { Href } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "~/components/ui";
import { SettingsCrest } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { Avatar, Icon, Kicker, SettingsRow, TabScreen } from "~/components/ui";
import { posthog } from "~/config/posthog";
import {
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { getAppVersion } from "~/utils/app-version";
import { authClient } from "~/utils/auth";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMemberSince(date: Date): string {
  return `Member since ${date.getFullYear()}`;
}

interface Item {
  icon: IconName;
  label: string;
  sub?: string;
  route: Href;
}

function buildGroups(
  email: string,
  topicCount: number,
): { title: string; items: Item[] }[] {
  return [
    {
      title: "Account",
      items: [
        {
          icon: "user",
          label: "Edit Profile",
          sub: email || undefined,
          route: "/settings/edit-profile",
        },
        {
          icon: "sliders",
          label: "Content Interests",
          sub: topicCount > 0 ? `${topicCount} topics` : undefined,
          route: "/settings/content-interests",
        },
      ],
    },
    {
      title: "Library",
      items: [
        {
          icon: "bookmark",
          label: "Following",
          route: "/settings/saved-articles",
        },
        {
          icon: "block",
          label: "Blocked",
          route: "/settings/blocked-content",
        },
      ],
    },
    {
      title: "Privacy",
      items: [
        {
          icon: "shield",
          label: "Privacy",
          route: "/settings/privacy",
        },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help", label: "Help", route: "/settings/help" },
        {
          icon: "message",
          label: "Feedback",
          route: "/settings/feedback",
        },
        {
          icon: "info",
          label: "About",
          sub: getAppVersion(),
          route: "/settings/about",
        },
      ],
    },
  ];
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessionQuery = useQuery(trpc.auth.getSession.queryOptions());
  const prefsQuery = useQuery({
    ...trpc.user.getPreferences.queryOptions(),
    enabled: !!sessionQuery.data?.user,
  });

  const sessionUser = sessionQuery.data?.user;
  const profileName = sessionUser?.name ?? "Guest";
  const profileInitials = getInitials(profileName);
  const profileMeta = sessionUser?.createdAt
    ? formatMemberSince(new Date(sessionUser.createdAt))
    : "";
  const profileEmail = sessionUser?.email ?? "";
  const topicCount = prefsQuery.data?.topics.length ?? 0;

  return (
    <TabScreen title="Settings" contentStyle={{ gap: 8 }}>
      <View style={s.section}>
        <TouchableOpacity
          style={s.identity}
          activeOpacity={0.85}
          onPress={() => router.push("/settings/edit-profile")}
          accessibilityRole="button"
          accessibilityLabel={`${profileName}. Edit profile`}
        >
          {sessionUser ? (
            <Avatar name={profileInitials} size={56} color={P.spark} />
          ) : (
            <SettingsCrest size={56} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{profileName}</Text>
            {profileMeta ? (
              <Text style={s.profileMeta}>{profileMeta}</Text>
            ) : null}
          </View>
          <Icon name="chevR" size={16} color={P.quiet} />
        </TouchableOpacity>
      </View>

      {buildGroups(profileEmail, topicCount).map((g) => (
        <View key={g.title} style={s.section}>
          <Kicker style={s.sectionKicker}>{g.title}</Kicker>
          {g.items.map((it, i) => (
            <SettingsRow
              key={it.label}
              icon={it.icon}
              label={it.label}
              sub={it.sub}
              last={i === g.items.length - 1}
              onPress={() => router.push(it.route)}
            />
          ))}
        </View>
      ))}

      <TouchableOpacity
        style={s.signOut}
        onPress={() => {
          posthog.capture("user_signed_out");
          posthog.reset();
          void authClient.signOut();
        }}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <View style={{ height: 48 + insets.bottom }} />
    </TabScreen>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: DigestSpace.screenPadX },
  sectionKicker: {
    color: P.spark,
    paddingLeft: 4,
    marginTop: 18,
    marginBottom: 4,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  profileName: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: P.inkOnNight,
  },
  profileMeta: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: P.quiet,
    marginTop: 4,
  },
  signOut: {
    alignSelf: "center",
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontFamily: fontBody.medium,
    fontSize: 15,
    color: P.quiet,
  },
});
