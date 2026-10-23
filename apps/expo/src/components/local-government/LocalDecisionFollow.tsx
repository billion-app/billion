import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useSavedContent } from "~/hooks/useSavedContent";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  DigestPalette as P,
} from "~/styles";

export function LocalDecisionFollow({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const { t } = useAppTranslation();
  const router = useRouter();
  const { isSaved, toggleSave } = useSavedContent();
  const saved = isSaved(id);
  return (
    <View style={s.card}>
      <Text style={s.title}>
        {t(saved ? "localDetail.following" : "localDetail.follow")}
      </Text>
      <Text style={s.note}>
        {t(saved ? "localDetail.savedNote" : "localDetail.followNote")}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        onPress={() => toggleSave({ id, title, type: "local_decision" })}
        style={s.button}
      >
        <Text style={s.buttonText}>
          {t(saved ? "localDetail.unfollow" : "localDetail.follow")}
        </Text>
      </TouchableOpacity>
      {saved && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push("/settings/notifications")}
          style={s.button}
        >
          <Text style={s.buttonText}>{t("localDetail.alertSettings")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: P.card,
    borderColor: DigestHair.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DigestRadii.card,
    padding: 16,
    gap: 8,
    marginBottom: 20,
  },
  title: { fontFamily: fontBody.semibold, fontSize: 15, color: P.inkOnNight },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.quiet,
  },
  button: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
  },
  buttonText: { fontFamily: fontBody.semibold, fontSize: 13, color: P.spark },
});
