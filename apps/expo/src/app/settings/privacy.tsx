import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import type { AppStringKey } from "~/i18n/app-strings";
import { Text } from "~/components/Themed";
import { GhostButton, Icon, Kicker, ScreenShell } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";

const CONTACT_EMAIL = "thatxliner@gmail.com";

interface Row {
  icon: IconName;
  label: AppStringKey;
  sub: AppStringKey;
}

const COLLECT: Row[] = [
  { icon: "layers", label: "privacy.usage", sub: "privacy.usageSub" },
  { icon: "pin", label: "privacy.address", sub: "privacy.addressSub" },
  { icon: "shield", label: "privacy.noAds", sub: "privacy.noAdsSub" },
];

const CONTROLS: Row[] = [
  { icon: "pin", label: "privacy.editAddress", sub: "privacy.editAddressSub" },
  {
    icon: "download",
    label: "privacy.stopAnalytics",
    sub: "privacy.stopAnalyticsSub",
  },
  { icon: "message", label: "privacy.access", sub: "privacy.accessSub" },
];

function RowList({ rows }: { rows: Row[] }) {
  const { t } = useAppTranslation();
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.row, i < rows.length - 1 && s.divider]}>
          <View style={s.tile}>
            <Icon name={r.icon} size={18} color={P.spark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{t(r.label)}</Text>
            <Text style={s.sub}>{t(r.sub, { email: CONTACT_EMAIL })}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();

  return (
    <ScreenShell title={t("privacy.title")}>
      <View style={s.notice}>
        <Icon name="lock" size={18} color={P.spark} />
        <Text style={s.noticeText}>{t("privacy.notice")}</Text>
      </View>

      <Kicker>{t("privacy.collect")}</Kicker>
      <View style={{ marginTop: 4, marginBottom: 24 }}>
        <RowList rows={COLLECT} />
      </View>

      <Kicker>{t("privacy.controls")}</Kicker>
      <View style={{ marginTop: 4 }}>
        <RowList rows={CONTROLS} />
      </View>

      <GhostButton
        label={t("privacy.readPolicy")}
        onPress={() => router.push("/settings/terms")}
        color={P.spark}
        style={{ marginTop: 20, alignSelf: "flex-start" }}
      />
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
    marginBottom: 28,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: P.quiet,
    lineHeight: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DigestHair.tabActivePill,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: P.inkOnNight,
  },
  sub: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
    marginTop: 3,
    lineHeight: 18,
  },
});
