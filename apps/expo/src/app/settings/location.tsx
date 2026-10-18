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
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useUserAddress } from "~/hooks/useUserAddress";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";

export default function LocationScreen() {
  const { t } = useAppTranslation();
  const [saveError, setSaveError] = useState(false);
  const { address, setAddress, clearAddress, isLoading } = useUserAddress();
  const [editing, setEditing] = useState(false);

  const save = (next: string) => {
    setSaveError(false);
    void setAddress(next)
      .then(() => setEditing(false))
      .catch(() => setSaveError(true));
  };

  const confirmClear = () => {
    Alert.alert(t("location.removeTitle"), t("location.removeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("location.removeAction"),
        style: "destructive",
        onPress: () => {
          void clearAddress()
            .then(() => setEditing(false))
            .catch(() => Alert.alert(t("location.removeFailed")));
        },
      },
    ]);
  };

  return (
    <ScreenShell title={t("location.title")}>
      <Text style={s.body}>{t("location.intro")}</Text>

      {isLoading ? null : editing || !address ? (
        <View style={s.card}>
          <Kicker>{t("location.kicker")}</Kicker>
          <AddressAutocomplete
            initialValue={address ?? ""}
            onSubmit={save}
            hint={t("location.hint")}
            autoFocus={false}
          />
          {address ? (
            <GhostButton
              label={t("common.cancel")}
              onPress={() => setEditing(false)}
              color={P.spark}
              style={s.secondaryAction}
            />
          ) : null}
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.label}>{t("location.saved")}</Text>
          <Text style={s.address}>{address}</Text>
          <PrimaryButton
            label={t("location.change")}
            onPress={() => setEditing(true)}
            style={s.primaryAction}
          />
          <GhostButton
            label={t("location.remove")}
            onPress={confirmClear}
            color={P.spark}
            style={s.secondaryAction}
          />
        </View>
      )}

      {saveError && (
        <Text accessibilityRole="alert" style={s.body}>
          {t("location.saveFailed")}
        </Text>
      )}
      <Text style={s.fineprint}>{t("location.stored")}</Text>
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
    color: P.inkOnNight,
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
