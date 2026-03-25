/**
 * Settings screen
 *
 * MOCK DATA / TODO:
 * - TODO: Push Notifications toggle should integrate with expo-notifications permission flow
 * - TODO: Autoplay Videos toggle should be wired to a video player config context
 * - TODO: Dark Mode toggle is non-functional — app always uses dark theme (dark is primary)
 * - TODO: Reduce Data Usage toggle should gate video quality in the feed player
 * - TODO: Logout should call the auth session invalidation API (trpc.auth.logout)
 * - TODO: Delete Account should call a backend deletion endpoint with a confirmation code flow
 */

import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, layout, settings, sp, typography, useTheme } from "~/styles";

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  title: string;
  subtitle?: string;
  type: "toggle" | "navigation" | "action";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  value?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [dataUsage, setDataUsage] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          // Handle logout logic here
          console.log("User logged out");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. Are you sure you want to delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Handle account deletion logic here
            console.log("Account deletion requested");
          },
        },
      ],
    );
  };

  const settingsSections: SettingsSection[] = [
    {
      title: "Preferences",
      items: [
        {
          id: "notifications",
          title: "Push Notifications",
          subtitle: "Receive updates about new content and bills",
          type: "toggle",
          icon: "notifications-outline",
          value: notifications,
          onToggle: setNotifications,
        },
        {
          id: "autoplay",
          title: "Autoplay Videos",
          subtitle: "Automatically play next video in feed",
          type: "toggle",
          icon: "play-circle-outline",
          value: autoplay,
          onToggle: setAutoplay,
        },
        {
          id: "darkMode",
          title: "Dark Mode",
          subtitle: "Use dark theme throughout the app",
          type: "toggle",
          icon: "moon-outline",
          value: darkMode,
          onToggle: setDarkMode,
        },
        {
          id: "dataUsage",
          title: "Reduce Data Usage",
          subtitle: "Lower video quality on cellular data",
          type: "toggle",
          icon: "cellular-outline",
          value: dataUsage,
          onToggle: setDataUsage,
        },
      ],
    },
    {
      title: "Content",
      items: [
        {
          id: "interests",
          title: "Content Interests",
          subtitle: "Customize what types of content you see",
          type: "navigation",
          icon: "sparkles-outline",
          onPress: () => router.push("/settings/content-interests"),
        },
        {
          id: "blocked",
          title: "Blocked Content",
          subtitle: "Manage blocked users and topics",
          type: "navigation",
          icon: "ban-outline",
          disabled: true,
          onPress: () => router.push("/settings/blocked-content"),
        },
        {
          id: "saved",
          title: "Saved Articles",
          subtitle: "View your saved articles and videos",
          type: "navigation",
          icon: "bookmark-outline",
          disabled: true,
          onPress: () => router.push("/settings/saved-articles"),
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          id: "profile",
          title: "Edit Profile",
          subtitle: "Update your profile information",
          type: "navigation",
          icon: "person-outline",
          disabled: true,
          onPress: () => router.push("/settings/edit-profile"),
        },
        {
          id: "privacy",
          title: "Privacy Settings",
          subtitle: "Manage your privacy preferences",
          type: "navigation",
          icon: "shield-outline",
          onPress: () => router.push("/settings/privacy"),
        },
        {
          id: "about",
          title: "About",
          subtitle: "App version and information",
          type: "navigation",
          icon: "information-circle-outline",
          onPress: () => router.push("/settings/about"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          title: "Help & Support",
          subtitle: "Get help with the app",
          type: "navigation",
          icon: "help-circle-outline",
          onPress: () => router.push("/settings/help"),
        },
        {
          id: "feedback",
          title: "Send Feedback",
          subtitle: "Report issues or suggest improvements",
          type: "navigation",
          icon: "chatbubble-outline",
          onPress: () => router.push("/settings/feedback"),
        },
        {
          id: "terms",
          title: "Terms & Privacy",
          subtitle: "Read our terms of service and privacy policy",
          type: "navigation",
          icon: "document-text-outline",
          onPress: () => router.push("/settings/terms"),
        },
      ],
    },
    {
      title: "Actions",
      items: [
        {
          id: "logout",
          title: "Logout",
          type: "action",
          onPress: handleLogout,
        },
        {
          id: "delete",
          title: "Delete Account",
          type: "action",
          onPress: handleDeleteAccount,
        },
      ],
    },
  ];

  const renderSettingsItem = (item: SettingsItem) => {
    switch (item.type) {
      case "toggle":
        return (
          <View
            key={item.id}
            style={[settings.item, { borderBottomColor: theme.border }]}
            lightColor="transparent"
            darkColor="transparent"
          >
            {item.icon && (
              <Ionicons
                name={item.icon}
                size={18}
                color={theme.mutedForeground}
                style={localStyles.itemIcon}
              />
            )}
            <View
              style={settings.itemTextContainer}
              lightColor="transparent"
              darkColor="transparent"
            >
              <Text style={[settings.itemTitle, { color: theme.foreground }]}>
                {item.title}
              </Text>
              {item.subtitle && (
                <Text
                  style={[
                    settings.itemSubtitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  {item.subtitle}
                </Text>
              )}
            </View>
            <Switch
              value={item.value}
              onValueChange={item.onToggle}
              trackColor={{ false: theme.muted, true: colors.civicBlue }}
              thumbColor={colors.white}
            />
          </View>
        );

      case "navigation":
        if (item.disabled) return null;
        return (
          <TouchableOpacity
            key={item.id}
            style={[settings.item, { borderBottomColor: theme.border }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            {item.icon && (
              <Ionicons
                name={item.icon}
                size={18}
                color={theme.mutedForeground}
                style={localStyles.itemIcon}
              />
            )}
            <View
              style={settings.itemTextContainer}
              lightColor="transparent"
              darkColor="transparent"
            >
              <Text style={[settings.itemTitle, { color: theme.foreground }]}>
                {item.title}
              </Text>
              {item.subtitle && (
                <Text
                  style={[
                    settings.itemSubtitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  {item.subtitle}
                </Text>
              )}
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.mutedForeground}
            />
          </TouchableOpacity>
        );

      case "action":
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              settings.item,
              { borderBottomColor: theme.border },
              item.id === "delete" && localStyles.deleteAction,
            ]}
            onPress={item.onPress}
          >
            {item.id === "logout" && (
              <Ionicons
                name="log-out-outline"
                size={18}
                color={theme.foreground}
                style={localStyles.itemIcon}
              />
            )}
            {item.id === "delete" && (
              <Ionicons
                name="trash-outline"
                size={18}
                color={theme.danger}
                style={localStyles.itemIcon}
              />
            )}
            <Text
              style={[
                settings.itemTitle,
                { color: theme.foreground },
                item.id === "delete" && { color: theme.danger },
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[layout.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          localStyles.header,
          {
            paddingTop: insets.top + 20,
            borderBottomColor: theme.border,
            backgroundColor: theme.card,
          },
        ]}
      >
        <Text
          style={[
            typography.h2,
            { color: theme.foreground, fontFamily: "IBMPlexSerif-Bold" },
          ]}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        style={layout.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {settingsSections.map((section) => (
          <View
            key={section.title}
            style={settings.section}
            lightColor="transparent"
            darkColor="transparent"
          >
            <Text
              style={[settings.sectionTitle, { color: theme.textSecondary }]}
            >
              {section.title}
            </Text>
            <View
              style={[
                settings.sectionContent,
                { borderColor: theme.border, backgroundColor: theme.card },
              ]}
              lightColor={theme.card}
              darkColor={theme.card}
            >
              {section.items.map(renderSettingsItem)}
            </View>
          </View>
        ))}

        <View
          style={localStyles.versionContainer}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Text style={[typography.caption, { color: theme.mutedForeground }]}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: sp[5],
    paddingBottom: sp[5],
  },
  itemIcon: {
    marginRight: sp[3],
  },
  deleteAction: {
    justifyContent: "flex-start",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: sp[10],
  },
});
