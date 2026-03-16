/**
 * Edit Profile screen — settings sub-page
 *
 * MOCK DATA / TODO:
 * - TODO: Initial values are hardcoded — load from tRPC (trpc.user.profile.get)
 * - TODO: "Save Changes" is a no-op — wire to tRPC mutation (trpc.user.profile.update)
 * - TODO: "Change photo" is a no-op — integrate expo-image-picker and upload to storage (e.g. S3/Cloudflare R2)
 * - TODO: Validate username format (alphanumeric + dots/underscores, no spaces)
 * - TODO: Validate email format and check uniqueness via tRPC before saving
 * - TODO: Avatar initial "AR" is hardcoded — derive from user's actual name
 */

import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fonts, sp, rd, useTheme } from "~/styles";

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [name, setName] = useState("Alex Rivera");
  const [username, setUsername] = useState("alex.rivera");
  const [email, setEmail] = useState("alex@example.com");
  const [bio, setBio] = useState("Civic-minded. Always reading.");

  const Field = ({
    label,
    value,
    onChangeText,
    multiline = false,
    placeholder,
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
  }) => (
    <View style={styles.field} lightColor="transparent" darkColor="transparent">
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedForeground}
        style={[
          styles.fieldInput,
          {
            color: theme.foreground,
            backgroundColor: theme.card,
            borderColor: theme.border,
            height: multiline ? 80 : undefined,
            textAlignVertical: multiline ? "top" : undefined,
          },
        ]}
      />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Edit Profile</Text>
        <View style={{ width: 44 }} lightColor="transparent" darkColor="transparent" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection} lightColor="transparent" darkColor="transparent">
          <View style={[styles.avatar, { backgroundColor: colors.civicBlue }]}>
            <Text style={styles.avatarInitial}>AR</Text>
          </View>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.changePhotoText, { color: colors.civicBlue }]}>Change photo</Text>
          </TouchableOpacity>
        </View>

        <Field label="FULL NAME" value={name} onChangeText={setName} placeholder="Your name" />
        <Field label="USERNAME" value={username} onChangeText={setUsername} placeholder="username" />
        <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <Field label="BIO" value={bio} onChangeText={setBio} multiline placeholder="Tell us about yourself" />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.white }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={[styles.saveBtnText, { color: colors.black }]}>Save Changes</Text>
        </TouchableOpacity>
      </View>
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
  scroll: { flex: 1, paddingHorizontal: sp[5] },
  avatarSection: {
    alignItems: "center",
    paddingTop: sp[8],
    paddingBottom: sp[6],
    gap: sp[3],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: rd.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.bodySemibold,
    fontSize: 28,
    color: colors.white,
  },
  changePhotoText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  field: {
    marginBottom: sp[5],
  },
  fieldLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: sp[2],
  },
  fieldInput: {
    fontFamily: fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: rd.md,
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    minHeight: 48,
  },
  footer: {
    padding: sp[5],
    borderTopWidth: 1,
  },
  saveBtn: {
    borderRadius: rd.full,
    paddingVertical: sp[4],
    alignItems: "center",
  },
  saveBtnText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 15,
  },
});
