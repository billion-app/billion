import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";

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
import type { IconName } from "~/components/ui";
import { colors, hair, planes } from "~/styles";

// TODO(backend): real profile from the better-auth session.
const PROFILE = {
  name: "Jordan Avery",
  initials: "JA",
  meta: "Member since 2024 · Sacramento, CA",
};

interface Item {
  icon: IconName;
  label: string;
  sub?: string;
  route: Href;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Account",
    items: [
      {
        icon: "user",
        label: "Edit Profile",
        sub: "jordan@email.com",
        route: "/settings/edit-profile",
      },
      {
        icon: "sliders",
        label: "Content Interests",
        sub: "6 topics followed",
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
      { icon: "message", label: "Send Feedback", route: "/settings/feedback" },
      {
        icon: "info",
        label: "About Billion",
        sub: "Version 2.4.0",
        route: "/settings/about",
      },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <TabScreen title="Settings" contentStyle={{ gap: 22 }}>
      {/* profile card */}
      <View style={s.section}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/settings/edit-profile")}
        >
          <Card style={s.profileCard}>
            <Avatar name={PROFILE.initials} size={54} />
            <View style={{ flex: 1 }}>
              <Text style={s.profileName}>{PROFILE.name}</Text>
              <Text style={s.profileMeta}>{PROFILE.meta}</Text>
            </View>
            <Icon name="chevR" size={18} color="#5B6172" />
          </Card>
        </TouchableOpacity>
      </View>

      {GROUPS.map((g) => (
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
