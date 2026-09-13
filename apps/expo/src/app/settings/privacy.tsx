import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { GhostButton, Icon, Kicker, ScreenShell } from "~/components/ui";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";

interface Row {
  icon: IconName;
  label: string;
  sub: string;
}

const NOTICE =
  "Billion works without an account. We never ask for your name or email to use the app.";

const COLLECT: Row[] = [
  {
    icon: "layers",
    label: "Usage & error diagnostics",
    sub: "App activity and handled errors are linked to a random installation ID, not your name, email, or an advertising ID.",
  },
  {
    icon: "pin",
    label: "Address-based ballot lookup",
    sub: "Address text is sent through our servers for autocomplete and civic lookups; the selected address is also stored on this device.",
  },
  {
    icon: "shield",
    label: "No ads or cross-app tracking",
    sub: "No advertising identifiers, and we never track you across other companies' apps or sites.",
  },
];

const CONTROLS: Row[] = [
  {
    icon: "pin",
    label: "Edit or clear your address",
    sub: "Open the Ballot tab to change or remove your saved address anytime.",
  },
  {
    icon: "download",
    label: "Stop analytics",
    sub: "Uninstalling Billion stops all analytics collection from this device.",
  },
  {
    icon: "message",
    label: "Access or delete your data",
    sub: "Email thatxliner@gmail.com and we'll help with any request.",
  },
];

function RowList({ rows }: { rows: Row[] }) {
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.row, i < rows.length - 1 && s.divider]}>
          <View style={s.tile}>
            <Icon name={r.icon} size={18} color={P.spark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.sub}>{r.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScreenShell title="Privacy">
      <View style={s.notice}>
        <Icon name="lock" size={18} color={P.spark} />
        <Text style={s.noticeText}>{NOTICE}</Text>
      </View>

      <Kicker>What we collect</Kicker>
      <View style={{ marginTop: 4, marginBottom: 24 }}>
        <RowList rows={COLLECT} />
      </View>

      <Kicker>Your controls</Kicker>
      <View style={{ marginTop: 4 }}>
        <RowList rows={CONTROLS} />
      </View>

      <GhostButton
        label="Read full Privacy Policy"
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
