import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { Text } from "~/components/Themed";
import { Card, GhostButton, Icon, Kicker, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";

interface Row {
  icon: IconName;
  label: string;
  sub: string;
}

const NOTICE =
  "Billion works without an account. You can read summaries and check your ballot without signing in — we never ask for your name or email to use the app.";

// What the installed build actually collects. Kept in sync with the Privacy
// Policy (settings/terms) and the App Store privacy answers; see
// docs/legal/data-inventory.md.
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
    <Card flush>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.row, i < rows.length - 1 && s.divider]}>
          <View style={s.tile}>
            <Icon name={r.icon} size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.sub}>{r.sub}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScreenShell title="Privacy">
      <View style={s.notice}>
        <Icon name="lock" size={20} color={colors.green[500]} />
        <Text style={s.noticeText}>{NOTICE}</Text>
      </View>

      <Kicker style={{ paddingLeft: 4 }}>What we collect</Kicker>
      <View style={{ marginTop: 8, marginBottom: 22 }}>
        <RowList rows={COLLECT} />
      </View>

      <Kicker style={{ paddingLeft: 4 }}>Your controls</Kicker>
      <View style={{ marginTop: 8 }}>
        <RowList rows={CONTROLS} />
      </View>

      <GhostButton
        label="Read full Privacy Policy"
        onPress={() => router.push("/settings/terms")}
        style={{ marginTop: 20, alignSelf: "flex-start" }}
      />
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  notice: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    padding: 15,
    marginBottom: 22,
  },
  noticeText: {
    flex: 1,
    fontFamily: "AlbertSans-Regular",
    fontSize: 13.5,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: hair[1] },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fontBody.semibold, fontSize: 14.5, color: colors.white },
  sub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 17,
  },
});
