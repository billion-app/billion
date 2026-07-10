import type { Href } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import {
  Avatar,
  Card,
  GhostButton,
  Icon,
  Kicker,
  SettingsRow,
  TabScreen,
} from "~/components/ui";
import { posthog } from "~/config/posthog";
import { colors, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";
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
          sub: topicCount > 0 ? `${topicCount} topics followed` : undefined,
          route: "/settings/content-interests",
        },
      ],
    },
    {
      title: "Your library",
      items: [
        {
          icon: "bookmark",
          label: "Saved Articles",
          sub: "Read later",
          route: "/settings/saved-articles",
        },
        {
          icon: "block",
          label: "Blocked Content",
          sub: "Sources & topics hidden",
          route: "/settings/blocked-content",
        },
      ],
    },
    {
      title: "Privacy & data",
      items: [
        {
          icon: "shield",
          label: "Privacy",
          sub: "Location, analytics, downloads",
          route: "/settings/privacy",
        },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help", label: "Help & FAQ", route: "/settings/help" },
        {
          icon: "message",
          label: "Send Feedback",
          route: "/settings/feedback",
        },
        {
          icon: "info",
          label: "About Billion",
          sub: "Version 2.4.0",
          route: "/settings/about",
        },
      ],
    },
  ];
}

export default function SettingsScreen() {
  const router = useRouter();
  const sessionQuery = useQuery(trpc.auth.getSession.queryOptions());
  const prefsQuery = useQuery(trpc.user.getPreferences.queryOptions());

  const sessionUser = sessionQuery.data?.user;
  const profileName = sessionUser?.name ?? "Guest";
  const profileInitials = getInitials(profileName);
  const profileMeta = sessionUser?.createdAt
    ? formatMemberSince(new Date(sessionUser.createdAt))
    : "";
  const profileEmail = sessionUser?.email ?? "";
  const topicCount = prefsQuery.data?.topics.length ?? 0;

  return (
    <TabScreen title="Settings" contentStyle={{ gap: 22 }}>
      {/* profile card */}
      <View style={s.section}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/settings/edit-profile")}
        >
          <Card style={s.profileCard}>
            <Avatar name={profileInitials} size={54} />
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>{profileName}</Text>
              <Text style={s.profileMeta}>{profileMeta}</Text>
            </View>
            <Icon name="chevR" size={18} color="#5B6172" />
          </Card>
        </TouchableOpacity>
      </View>

      {buildGroups(profileEmail, topicCount).map((g) => (
        <View key={g.title} style={s.section}>
          <Kicker style={{ paddingLeft: 4 }}>{g.title}</Kicker>
          <Card flush>
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
          </Card>
        </View>
      ))}

      <GhostButton
        label="Sign out"
        color={colors.red[500]}
        style={{ alignSelf: "center" }}
        onPress={() => {
          posthog.capture("user_signed_out");
          posthog.reset();
          void authClient.signOut();
        }}
      />
    </TabScreen>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderColor: hair[1],
    backgroundColor: planes.slate,
  },
  profileName: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.white,
  },
  profileMeta: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
