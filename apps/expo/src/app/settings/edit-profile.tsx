import { useState } from "react";
import {
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Avatar, GhostButton, Icon, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function EditProfileScreen() {
  const sessionQuery = useQuery(trpc.auth.getSession.queryOptions());
  const sessionUser = sessionQuery.data?.user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  if (sessionUser && !synced) {
    setName(sessionUser.name);
    setEmail(sessionUser.email);
    setSynced(true);
  }

  const updateProfile = useMutation({
    ...trpc.user.updateProfile.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.auth.getSession.queryKey(),
      });
    },
  });

  const deleteAccount = useMutation(trpc.user.deleteAccount.mutationOptions());

  const handleChangePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to change your profile photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      updateProfile.mutate({ image: dataUri });
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => void authClient.signOut(),
            }),
        },
      ],
    );
  };

  const fields = [
    { label: "DISPLAY NAME", value: name, set: setName },
    { label: "EMAIL", value: email, set: undefined },
  ];

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setNameError("Name can't be empty.");
      return;
    }
    setNameError(null);
    if (trimmed && trimmed !== sessionUser?.name) {
      updateProfile.mutate({ name: trimmed });
    }
  };

  return (
    <ScreenShell
      title="Edit Profile"
      action={
        <TouchableOpacity hitSlop={8} onPress={handleSave}>
          <Text style={s.save}>
            {updateProfile.isPending ? "Saving…" : "Save"}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={s.avatarWrap}>
        <View>
          <Avatar name={getInitials(name || "?")} size={92} />
          <View style={s.editBadge}>
            <Icon name="edit" size={15} color={planes.ink} />
          </View>
        </View>
        <GhostButton
          label="Change photo"
          color={colors.bill}
          style={{ marginTop: 10, height: 32 }}
          onPress={handleChangePhoto}
        />
      </View>

      {fields.map((f) => {
        const set = f.set;
        return (
          <View key={f.label} style={{ marginBottom: 18 }}>
            <Text style={s.label}>{f.label}</Text>
            <TextInput
              style={[s.input, !set && { opacity: 0.5 }]}
              value={f.value}
              onChangeText={
                set
                  ? (v) => {
                      set(v);
                      setNameError(null);
                    }
                  : undefined
              }
              editable={!!set}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            {f.label === "DISPLAY NAME" && nameError && (
              <Text style={s.error}>{nameError}</Text>
            )}
          </View>
        );
      })}

      <GhostButton
        label={deleteAccount.isPending ? "Deleting…" : "Delete account"}
        color={colors.red[500]}
        style={{ marginTop: 8, alignSelf: "flex-start" }}
        onPress={handleDeleteAccount}
      />
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  save: { fontFamily: fontBody.bold, fontSize: 15, color: colors.bill },
  avatarWrap: { alignItems: "center", marginBottom: 28 },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: planes.navy,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    marginBottom: 9,
    paddingLeft: 4,
  },
  input: {
    height: 50,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: "AlbertSans-Regular",
    fontSize: 16,
  },
  error: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    color: colors.red[500],
    marginTop: 6,
    paddingLeft: 4,
  },
});
