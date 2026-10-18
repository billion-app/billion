/**
 * Location settings — the one place to see and change the saved voter address.
 *
 * The field is `AddressAutocomplete`, so this screen offers the same native
 * "Use my location" shortcut as the rest of the app while keeping typed entry
 * available: a GPS fix finds where the person is, and registration is not
 * always the same place.
 */
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { Text } from "~/components/Themed";
import {
  GhostButton,
  Kicker,
  PrimaryButton,
  ScreenShell,
} from "~/components/ui";
import { useUserAddress } from "~/hooks/useUserAddress";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";

export default function LocationScreen() {
  const { address, setAddress, clearAddress, isLoading } = useUserAddress();
  const [editing, setEditing] = useState(false);

  const save = (next: string) => {
    void setAddress(next);
    setEditing(false);
  };

  const confirmClear = () => {
    Alert.alert(
      "Remove saved location?",
      "Ballot, voting, and representative lookups will ask for your address again until you set a new one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void clearAddress();
            setEditing(false);
          },
        },
      ],
    );
  };

  return (
    <ScreenShell title="Location">
      <Text style={s.body}>
        Billion uses the address where you&rsquo;re registered to vote — not
        necessarily where you are right now. Use the device location shortcut to
        fill it in, or type it yourself.
      </Text>

      {isLoading ? null : editing || !address ? (
        <View style={s.card}>
          <Kicker>YOUR REGISTERED ADDRESS</Kicker>
          <AddressAutocomplete
            initialValue={address ?? ""}
            onSubmit={save}
            hint="Use your current location or type the address where you're registered."
            autoFocus={false}
          />
          {address ? (
            <GhostButton
              label="Cancel"
              onPress={() => setEditing(false)}
              color={P.spark}
              style={s.secondaryAction}
            />
          ) : null}
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.label}>Saved location</Text>
          <Text style={s.address}>{address}</Text>
          <PrimaryButton
            label="Change location"
            onPress={() => setEditing(true)}
            style={s.primaryAction}
          />
          <GhostButton
            label="Remove saved location"
            onPress={confirmClear}
            color={P.spark}
            style={s.secondaryAction}
          />
        </View>
      )}

      <Text style={s.fineprint}>
        Stored on this device and used only for election lookups. You can change
        or remove it at any time.
      </Text>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.quiet,
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    backgroundColor: P.stone,
    padding: 16,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: P.quiet,
  },
  address: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 23,
    color: P.inkOnNight,
    marginTop: 6,
  },
  primaryAction: { marginTop: 18 },
  secondaryAction: { marginTop: 8 },
  fineprint: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: P.quiet,
    marginTop: 16,
  },
});
