import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Avatar, GhostButton, Icon, ScreenShell } from "~/components/ui";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  DigestPalette as P,
} from "~/styles";
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
    { label: "Name", value: name, set: setName },
    { label: "Email", value: email, set: undefined },
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
          <Avatar name={getInitials(name || "?")} size={92} color={P.spark} />
          <View style={s.editBadge}>
            <Icon name="edit" size={14} color={P.ink} />
          </View>
        </View>
        <GhostButton
          label="Change photo"
          color={P.spark}
          style={{ marginTop: 10, height: 32 }}
        />
      </View>

      {fields.map((f) => (
        <View key={f.label} style={{ marginBottom: 22 }}>
          <Text style={s.label}>{f.label}</Text>
          <TextInput
            style={[s.input, !f.set && { opacity: 0.5 }]}
            value={f.value}
            onChangeText={f.set}
            editable={!!f.set}
            placeholderTextColor={P.quiet}
            autoCapitalize="none"
          />
        </View>
      ))}

      <GhostButton
        label="Delete account"
        color={P.quiet}
        style={{ marginTop: 8, alignSelf: "flex-start" }}
      />
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  save: { fontFamily: fontBody.bold, fontSize: 15, color: P.spark },
  avatarWrap: { alignItems: "center", marginBottom: 36, marginTop: 8 },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: P.paper,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: P.canvas,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
    marginBottom: 10,
    paddingLeft: 4,
  },
  input: {
    height: 52,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
    paddingHorizontal: 16,
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 16,
  },
});
