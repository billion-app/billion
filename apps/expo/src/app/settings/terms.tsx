import { StyleSheet, View } from "react-native";

import type { AppStringKey } from "~/i18n/app-strings";
import { Text } from "~/components/Themed";
import { ScreenShell } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestHair,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";

const LAST_UPDATED = "2026-10-18";
const CONTACT_EMAIL = "thatxliner@gmail.com";

type Section = readonly [title: AppStringKey, body: AppStringKey];

const TERMS_SECTIONS: Section[] = [
  ["terms.t1Title", "terms.t1Body"],
  ["terms.t2Title", "terms.t2Body"],
  ["terms.t3Title", "terms.t3Body"],
  ["terms.t4Title", "terms.t4Body"],
  ["terms.t5Title", "terms.t5Body"],
  ["terms.t6Title", "terms.t6Body"],
  ["terms.t7Title", "terms.t7Body"],
  ["terms.t8Title", "terms.t8Body"],
  ["terms.t9Title", "terms.t9Body"],
  ["terms.t10Title", "terms.t10Body"],
  ["terms.t11Title", "terms.t11Body"],
];

const PRIVACY_SECTIONS: Section[] = [
  ["terms.p1Title", "terms.p1Body"],
  ["terms.p2Title", "terms.p2Body"],
  ["terms.p3Title", "terms.p3Body"],
  ["terms.p4Title", "terms.p4Body"],
  ["terms.p5Title", "terms.p5Body"],
  ["terms.p6Title", "terms.p6Body"],
  ["terms.p7Title", "terms.p7Body"],
  ["terms.p8Title", "terms.p8Body"],
  ["terms.p9Title", "terms.p9Body"],
  ["terms.p10Title", "terms.p10Body"],
  ["terms.p11Title", "terms.p11Body"],
  ["terms.p12Title", "terms.p12Body"],
];

function DocSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

export default function TermsScreen() {
  const { language, t, formatDate } = useAppTranslation();
  const vars = { email: CONTACT_EMAIL };

  return (
    <ScreenShell title={t("terms.title")}>
      <Text style={styles.lastUpdated}>
        {t("terms.lastUpdated", {
          date: formatDate(LAST_UPDATED, {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        })}
      </Text>
      {/* Readers can compare this translation with the original wording. */}
      {language !== "en" ? (
        <Text style={styles.translationNote}>{t("terms.translationNote")}</Text>
      ) : null}

      <Text style={styles.docTitle}>{t("terms.tosTitle")}</Text>
      {TERMS_SECTIONS.map(([title, body]) => (
        <DocSection key={title} title={t(title)} body={t(body, vars)} />
      ))}

      <View style={styles.divider} />

      <Text style={styles.docTitle}>{t("terms.privacyTitle")}</Text>
      {PRIVACY_SECTIONS.map(([title, body]) => (
        <DocSection key={title} title={t(title)} body={t(body, vars)} />
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  lastUpdated: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: P.quiet,
    marginBottom: 24,
  },
  translationNote: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
    marginTop: -12,
    marginBottom: 24,
  },
  docTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: P.inkOnNight,
    marginBottom: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DigestHair.sectionRule,
    marginVertical: 32,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
    marginBottom: 6,
  },
  sectionBody: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.quiet,
  },
});
