import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import type { AppStringKey } from "~/i18n/app-strings";
import { Text } from "~/components/Themed";
import { Icon, ScreenShell, SearchInput } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestHair,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";

const FAQS: { q: AppStringKey; a: AppStringKey }[] = [
  { q: "help.q1", a: "help.a1" },
  { q: "help.q2", a: "help.a2" },
  { q: "help.q3", a: "help.a3" },
  { q: "help.q4", a: "help.a4" },
  { q: "help.q5", a: "help.a5" },
];

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const [open, setOpen] = useState<number>(0);

  return (
    <ScreenShell title={t("help.title")}>
      <SearchInput
        placeholder={t("help.search")}
        accessibilityLabel={t("help.search")}
        style={{ marginBottom: 20 }}
      />

      {FAQS.map((f, i) => {
        const expanded = open === i;
        return (
          <TouchableOpacity
            key={f.q}
            activeOpacity={0.8}
            onPress={() => setOpen(expanded ? -1 : i)}
            style={[s.faq, i < FAQS.length - 1 && s.faqDivider]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <View style={s.cardHead}>
              <Text style={s.q}>{t(f.q)}</Text>
              <Icon
                name="chevD"
                size={16}
                color={P.quiet}
                style={expanded ? s.chevOpen : undefined}
              />
            </View>
            {expanded ? <Text style={s.a}>{t(f.a)}</Text> : null}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={s.contactRow}
        activeOpacity={0.8}
        onPress={() => router.push("/settings/feedback")}
        accessibilityRole="button"
        accessibilityLabel={t("help.sendFeedback")}
      >
        <Icon name="message" size={18} color={P.spark} />
        <Text style={s.contactTitle}>{t("help.stillStuck")}</Text>
        <Icon name="chevR" size={15} color={P.quiet} />
      </TouchableOpacity>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  faq: { paddingVertical: 18 },
  faqDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  q: {
    flex: 1,
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: P.inkOnNight,
  },
  chevOpen: { transform: [{ rotate: "180deg" }] },
  a: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: P.quiet,
    marginTop: 10,
    lineHeight: 22,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    paddingVertical: 8,
  },
  contactTitle: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.inkOnNight,
  },
});
