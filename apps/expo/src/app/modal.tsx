import { Platform, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";

import EditScreenInfo from "~/components/EditScreenInfo";
import { LanguageCorner } from "~/components/LanguageButton";
import { Text, View } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { layout, sp, typography } from "~/styles";

export default function ModalScreen() {
  const { t } = useAppTranslation();
  return (
    <View style={[layout.fullCenter]}>
      <LanguageCorner />
      <Text style={[typography.h3]}>{t("dev.modalTitle")}</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <EditScreenInfo path="app/modal.tsx" />

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}

const styles = StyleSheet.create({
  separator: {
    marginVertical: sp[8],
    height: 1,
    width: "80%",
  },
});
