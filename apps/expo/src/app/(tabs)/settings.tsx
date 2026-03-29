import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { layout, settings, sp, typography, useTheme } from "~/styles";

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();

  const settingsSections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        {
          id: "about",
          title: "About",
          subtitle: "App version and information",
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
          icon: "help-circle-outline",
          onPress: () => router.push("/settings/help"),
        },
        {
          id: "feedback",
          title: "Send Feedback",
          subtitle: "Report issues or suggest improvements",
          icon: "chatbubble-outline",
          onPress: () => router.push("/settings/feedback"),
        },
        {
          id: "terms",
          title: "Terms & Privacy",
          subtitle: "Read our terms of service and privacy policy",
          icon: "document-text-outline",
          onPress: () => router.push("/settings/terms"),
        },
      ],
    },
  ];

  const renderSettingsItem = (item: SettingsItem) => (
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
          <Text style={[settings.itemSubtitle, { color: theme.textSecondary }]}>
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
  versionContainer: {
    alignItems: "center",
    paddingVertical: sp[10],
  },
});
