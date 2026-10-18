import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "~/components/ui/Icon";
import { useLanguage } from "~/hooks/useLanguage";
import { LANGUAGE_OPTIONS } from "~/i18n/language";
import { fontBody, fontDisplay, hair, DigestPalette as P } from "~/styles";

/** For standalone recovery screens without a navigation header. */
export function LanguageCorner() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: "absolute", top: insets.top + 8, right: 16 }}>
      <LanguageButton compact />
    </View>
  );
}

/** Shared by headers and readers; choosing a language never navigates away. */
export function LanguageButton({
  compact = false,
  tone = "dark",
}: {
  compact?: boolean;
  tone?: "dark" | "paper";
}) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = LANGUAGE_OPTIONS.find((option) => option.id === language);
  const label =
    language === "zh"
      ? "中文"
      : language === "es"
        ? "Español"
        : "中文 · Español";
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          s.button,
          tone === "paper" && s.paper,
          pressed && s.pressed,
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("language.change", {
          language: current?.nativeName ?? "English",
        })}
        accessibilityState={{ expanded: open }}
        accessibilityHint="English · 中文 · Español"
        testID="reader-language"
      >
        <Icon
          name="globe"
          size={17}
          color={tone === "paper" ? P.ink : P.spark}
        />
        <Text
          style={[s.label, tone === "paper" && s.paperLabel]}
          numberOfLines={1}
        >
          {compact
            ? language === "en"
              ? "EN"
              : language === "es"
                ? "ES"
                : "中文"
            : label}
        </Text>
        {!compact && (
          <Icon
            name="chevD"
            size={14}
            color={tone === "paper" ? P.ink : P.quiet}
          />
        )}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            s.overlay,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          />
          <View style={s.menu} accessibilityViewIsModal>
            <ScrollView
              contentContainerStyle={s.menuContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.heading} accessibilityRole="header">
                {t("language.choose")}
              </Text>
              <Text style={s.note}>{t("language.appNote")}</Text>
              <View accessibilityRole="radiogroup" style={s.options}>
                {LANGUAGE_OPTIONS.map((option) => {
                  const selected = language === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      style={({ pressed }) => [
                        s.option,
                        selected && s.selected,
                        pressed && s.pressed,
                      ]}
                      onPress={() => {
                        setLanguage(option.id);
                        setOpen(false);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      accessibilityLabel={option.nativeName}
                      testID={`reader-language-${option.id}`}
                    >
                      <Text style={s.optionName}>{option.nativeName}</Text>
                      {selected && (
                        <Icon name="check" size={18} color={P.spark} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={s.cancel}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
              >
                <Text style={s.cancelLabel}>{t("common.cancel")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    borderRadius: 22,
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  paper: {
    backgroundColor: "rgba(134,105,24,0.08)",
    borderColor: "rgba(134,105,24,0.45)",
  },
  label: { color: P.inkOnNight, fontFamily: fontBody.medium, fontSize: 14 },
  paperLabel: { color: P.ink },
  pressed: { opacity: 0.7 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  menu: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: P.night,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hair[2],
    overflow: "hidden",
  },
  menuContent: { padding: 20, gap: 12 },
  heading: { color: P.inkOnNight, fontFamily: fontDisplay.bold, fontSize: 20 },
  note: {
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  options: { gap: 8 },
  option: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[2],
  },
  selected: {
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  optionName: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 16,
  },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelLabel: { color: P.quiet, fontFamily: fontBody.medium, fontSize: 14 },
});
