import { StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";

import { LanguageCorner } from "~/components/LanguageButton";
import { Text, View } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";

export default function NotFoundScreen() {
  const { t } = useAppTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <View style={styles.container}>
        <LanguageCorner />
        <Text style={styles.title} accessibilityRole="header">
          {t("notFound.body")}
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t("notFound.home")}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
