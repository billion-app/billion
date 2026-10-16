import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/Themed";
import { Icon, ScreenShell } from "~/components/ui";
import { useLanguage } from "~/hooks/useLanguage";
import { LANGUAGE_OPTIONS } from "~/i18n/language";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";

export default function LanguageScreen() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <ScreenShell title={t("language.title")}>
      <Text style={s.intro}>{t("language.intro")}</Text>

      <View accessibilityRole="radiogroup">
        {LANGUAGE_OPTIONS.map((option, i) => {
          const selected = option.id === language;
          return (
            <TouchableOpacity
              key={option.id}
              style={[s.row, i < LANGUAGE_OPTIONS.length - 1 && s.divider]}
              onPress={() => setLanguage(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={option.nativeName}
              testID={`language-${option.id}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{option.nativeName}</Text>
                {option.nativeName !== option.englishName ? (
                  <Text style={s.sub}>{option.englishName}</Text>
                ) : null}
              </View>
              {selected ? (
                <Icon name="check" size={20} color={P.spark} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {language !== "en" ? (
        <Text style={s.note}>{t("language.machineNote")}</Text>
      ) : null}
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.quiet,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.inkOnNight,
  },
  sub: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
    marginTop: 3,
  },
  note: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: P.quiet,
    marginTop: 20,
  },
});
