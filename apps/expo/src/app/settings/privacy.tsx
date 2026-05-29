import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "~/components/Themed";
import { Card, GhostButton, Icon, ScreenShell, Toggle } from "~/components/ui";
import type { IconName } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";

type Key = "location" | "personalize" | "analytics" | "crash" | "offline";

const ROWS: { k: Key; icon: IconName; label: string; sub: string }[] = [
  {
    k: "location",
    icon: "pin",
    label: "Location access",
    sub: "Used only to load your local ballot",
  },
  {
    k: "personalize",
    icon: "sliders",
    label: "Personalized feed",
    sub: "Tailor content to your interests",
  },
  {
    k: "analytics",
    icon: "layers",
    label: "Usage analytics",
    sub: "Share anonymous app usage",
  },
  {
    k: "crash",
    icon: "shield",
    label: "Crash reports",
    sub: "Send diagnostics automatically",
  },
  {
    k: "offline",
    icon: "download",
    label: "Offline downloads",
    sub: "Save articles for offline reading",
  },
];

// TODO(backend): persist privacy preferences.
export default function PrivacyScreen() {
  const [state, setState] = useState<Record<Key, boolean>>({
    location: true,
    personalize: true,
    analytics: false,
    crash: true,
    offline: true,
  });
  const toggle = (k: Key) => setState((p) => ({ ...p, [k]: !p[k] }));

  return (
    <ScreenShell title="Privacy">
      <View style={s.notice}>
        <Icon name="lock" size={20} color={colors.green[500]} />
        <Text style={s.noticeText}>
          Your reading history never leaves your device. You control everything
          below.
        </Text>
      </View>

      <Card flush>
        {ROWS.map((r, i) => (
          <View key={r.k} style={[s.row, i < ROWS.length - 1 && s.divider]}>
            <View style={s.tile}>
              <Icon name={r.icon} size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{r.label}</Text>
              <Text style={s.sub}>{r.sub}</Text>
            </View>
            <Toggle on={state[r.k]} onChange={() => toggle(r.k)} />
          </View>
        ))}
      </Card>

      <GhostButton
        label="Download my data"
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
  },
});
