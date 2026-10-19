import {
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
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
  /** Spoken hint for rows that act; rows without `onPress` are static. */
  hint?: AppStringKey;
  onPress?: () => void;
}

function RowList({ rows }: { rows: Row[] }) {
  const { t } = useAppTranslation();
  return (
    <View>
      {rows.map((r, i) => {
        const content = (
          <>
            <View style={s.tile}>
              <Icon name={r.icon} size={18} color={P.spark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t(r.label)}</Text>
              <Text style={s.sub}>{t(r.sub, { email: CONTACT_EMAIL })}</Text>
            </View>
            {r.onPress ? (
              <Icon name="chevR" size={16} color={P.quiet} style={s.chev} />
            ) : null}
          </>
        );
        const style = [s.row, i < rows.length - 1 && s.divider];
        return r.onPress ? (
          <TouchableOpacity
            key={r.label}
            style={style}
            onPress={r.onPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${t(r.label)}. ${t(r.sub)}`}
            accessibilityHint={r.hint ? t(r.hint) : undefined}
          >
            {content}
          </TouchableOpacity>
        ) : (
          <View key={r.label} style={style}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  // Browsers expose no settings deep link; the web row explains where to go.
  const native = Platform.OS !== "web";

  const collect: Row[] = [
    { icon: "layers", label: "privacy.usage", sub: "privacy.usageSub" },
    { icon: "pin", label: "privacy.address", sub: "privacy.addressSub" },
    { icon: "globe", label: "privacy.location", sub: "privacy.locationSub" },
    { icon: "shield", label: "privacy.noAds", sub: "privacy.noAdsSub" },
  ];

  const controls: Row[] = [
    {
      icon: "pin",
      label: "privacy.editAddress",
      sub: "privacy.editAddressSub",
      hint: "privacy.editAddressHint",
      onPress: () => router.push("/settings/location"),
    },
    native
      ? {
          icon: "settings",
          label: "privacy.permission",
          sub: "privacy.permissionSub",
          hint: "privacy.permissionHint",
          onPress: () => void Linking.openSettings(),
        }
      : {
          icon: "settings",
          label: "privacy.permission",
          sub: "privacy.permissionSubWeb",
        },
    {
      icon: "download",
      label: "privacy.stopAnalytics",
      sub: "privacy.stopAnalyticsSub",
    },
    { icon: "message", label: "privacy.access", sub: "privacy.accessSub" },
  ];

  return (
    <ScreenShell title={t("privacy.title")}>
      <View style={s.notice}>
        <Icon name="lock" size={18} color={P.spark} />
        <Text style={s.noticeText}>{t("privacy.notice")}</Text>
      </View>

      <View accessibilityRole="header">
        <Kicker>{t("privacy.collect")}</Kicker>
      </View>
      <View style={{ marginTop: 4, marginBottom: 24 }}>
        <RowList rows={collect} />
      </View>

      <View accessibilityRole="header">
        <Kicker>{t("privacy.controls")}</Kicker>
      </View>
      <View style={{ marginTop: 4 }}>
        <RowList rows={controls} />
      </View>

      <GhostButton
        label={t("privacy.readPolicy")}
        onPress={() =>
          router.push({
            pathname: "/settings/terms",
            params: { section: "privacy" },
          })
        }
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
  chev: { alignSelf: "center" },
});
