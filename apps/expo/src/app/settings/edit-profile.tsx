import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Avatar, GhostButton, Icon, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { queryClient, trpc } from "~/utils/api";

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

  const fields = [
    { label: "DISPLAY NAME", value: name, set: setName },
    { label: "EMAIL", value: email, set: undefined },
  ];

  const handleSave = () => {
    if (name && name !== sessionUser?.name) {
      updateProfile.mutate({ name });
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
        />
      </View>

      {fields.map((f) => (
        <View key={f.label} style={{ marginBottom: 18 }}>
          <Text style={s.label}>{f.label}</Text>
          <TextInput
            style={[s.input, !f.set && { opacity: 0.5 }]}
            value={f.value}
            onChangeText={f.set}
            editable={!!f.set}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
        </View>
      ))}

      <GhostButton
        label="Delete account"
        color={colors.red[500]}
        style={{ marginTop: 8, alignSelf: "flex-start" }}
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
});
