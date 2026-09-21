import type { Href } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { NotificationPrefs } from "~/utils/notification-prefs";
import { Icon, Kicker, NavHeader, Toggle } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useNotificationPrefs } from "~/hooks/useNotificationPrefs";
import { useOnboarding } from "~/hooks/useOnboarding";
import { useSavedContent } from "~/hooks/useSavedContent";
import {
  DigestHair,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { prependAlert, TEST_ALERT } from "~/utils/alert-history";
import { trpc, trpcClient } from "~/utils/api";
import { deliveryNote, scheduleLocalAlert } from "~/utils/local-notification";
import {
  formatClock,
  quietHoursLabel,
  stepHour,
} from "~/utils/notification-prefs";
import { getPushToken, syncPushRegistration } from "~/utils/push-sync";

export default function NotificationsScreen() {
  const router = useRouter();
  const prefs = useNotificationPrefs();
  const onboarding = useOnboarding();
  const { savedIds } = useSavedContent();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const featured = useQuery(
    trpc.content.getFeaturedBills.queryOptions({ jurisdiction: "federal" }),
  );

  const setPref = (patch: Partial<NotificationPrefs>) => {
    prefs.update(patch);
    const following = patch.following ?? prefs.following;
    const recap = patch.recap ?? prefs.recap;
    if (patch.following !== undefined || patch.recap !== undefined) {
      onboarding.update({
        alerts: { instant: following, digest: recap },
      });
    }
    posthog.capture("notification_pref_updated", {
      ...patch,
    });
  };

  const onTest = () => {
    if (sending) return;
    setSending(true);
    const bill = featured.data?.[0];
    const href = bill?.id
      ? `/article-detail?id=${bill.id}`
      : "/settings/notifications";
    const trimmedTitle = bill?.title.trim() ?? "";
    const title = trimmedTitle.length > 0 ? trimmedTitle : TEST_ALERT.title;
    const body = bill?.billNumber
      ? `${bill.billNumber} advanced.`
      : TEST_ALERT.body;
    void (async () => {
      try {
        if (Device.isDevice) {
          await syncPushRegistration(prefs, savedIds);
          const token = getPushToken();
          if (!token)
            throw new Error(
              "Push registration unavailable. Check this phone's notification permissions and try again.",
            );
          await trpcClient.notifications.test.mutate({
            token,
            billId: bill?.id,
          });
          setStatus(
            "Expo accepted the test. Check this phone's notifications for delivery.",
          );
        } else {
          const result = await scheduleLocalAlert(
            { title, body, href, test: true },
            prefs,
          );
          setStatus(deliveryNote(result, prefs));
          if (!result.ok) return;
          await prependAlert({
            id: `test-${Date.now()}`,
            at: result.when.toISOString(),
            kind: "test",
            title,
            body,
            href,
          });
        }
        posthog.capture("notification_test_sent", {
          href,
          billId: bill?.id ?? null,
        });
      } catch (error: unknown) {
        setStatus(
          error instanceof Error ? error.message : "Could not send the alert.",
        );
      } finally {
        setSending(false);
      }
    })();
  };

  return (
    <View style={s.screen}>
      <NavHeader title="Notifications" onBack={() => router.back()} large />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.dek}>Stay informed without being overwhelmed.</Text>

        <Kicker style={s.kicker}>Important updates</Kicker>
        <PrefRow
          label="BREAKING"
          sub="Rare, human-reviewed developments"
          on={prefs.breaking}
          onChange={(next) => setPref({ breaking: next })}
        />
        <PrefRow
          label="Things you follow"
          sub="Bills, elections, courts & topics"
          on={prefs.following}
          onChange={(next) => setPref({ following: next })}
        />
        <PrefRow
          label="Daily Brief"
          sub="A concise summary each morning"
          on={prefs.brief}
          onChange={(next) => setPref({ brief: next })}
        />
        <PrefRow
          label="Evening Recap"
          sub="What changed today"
          on={prefs.recap}
          onChange={(next) => setPref({ recap: next })}
          last
        />

        <Kicker style={s.kicker}>Delivery</Kicker>
        <PrefRow
          label="Quiet hours"
          sub={prefs.quietHours ? quietHoursLabel(prefs) : "Off"}
          on={prefs.quietHours}
          onChange={(next) => setPref({ quietHours: next })}
          last={!prefs.quietHours}
        />
        {prefs.quietHours ? (
          <View style={s.hours}>
            <HourChip
              label="From"
              value={prefs.quietStartMin}
              onStep={() =>
                setPref({ quietStartMin: stepHour(prefs.quietStartMin, 1) })
              }
            />
            <Text style={s.hoursDash}>{"\u2013"}</Text>
            <HourChip
              label="Until"
              value={prefs.quietEndMin}
              onStep={() =>
                setPref({ quietEndMin: stepHour(prefs.quietEndMin, 1) })
              }
            />
          </View>
        ) : null}

        <Pressable
          onPress={onTest}
          disabled={sending}
          style={s.test}
          accessibilityRole="button"
          accessibilityLabel="Send a test notification"
        >
          <View style={s.mark}>
            <Icon name="bell" size={18} color={P.inkOnNight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.testLabel}>Test notification</Text>
            <Text style={s.testSub}>
              {sending
                ? "Sending…"
                : (status ?? "Lock-screen only. Tap it to open that bill.")}
            </Text>
          </View>
          <Icon name="chevR" size={15} color={P.quiet} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/settings/alerts" as Href)}
          style={s.history}
          accessibilityRole="button"
          accessibilityLabel="Your alerts"
        >
          <View style={s.mark}>
            <Icon name="clock" size={18} color={P.inkOnNight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.testLabel}>Your alerts</Text>
            <Text style={s.testSub}>A record of what we sent.</Text>
          </View>
          <Icon name="chevR" size={15} color={P.quiet} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PrefRow({
  label,
  sub,
  on,
  onChange,
  last,
}: {
  label: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={[s.row, !last && s.divider]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}. ${sub}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      <View pointerEvents="none">
        <Toggle on={on} onChange={() => undefined} />
      </View>
    </Pressable>
  );
}

function HourChip({
  label,
  value,
  onStep,
}: {
  label: string;
  value: number;
  onStep: () => void;
}) {
  return (
    <Pressable
      onPress={onStep}
      style={s.chip}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${formatClock(value)}. Tap to move one hour later.`}
    >
      <Text style={s.chipLabel}>{label}</Text>
      <Text style={s.chipTime}>{formatClock(value)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  dek: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 22,
    color: P.quiet,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  kicker: {
    color: P.quiet,
    paddingLeft: 4,
    marginTop: 28,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  label: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: P.inkOnNight,
  },
  sub: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 16,
    color: P.quiet,
    marginTop: 3,
  },
  hours: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  hoursDash: {
    fontFamily: fontBody.regular,
    fontSize: 16,
    color: P.quiet,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  chipLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: P.quiet,
  },
  chipTime: {
    marginTop: 4,
    fontFamily: fontDisplay.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: P.inkOnNight,
  },
  test: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 16,
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
  },
  history: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: P.stone,
    alignItems: "center",
    justifyContent: "center",
  },
  testLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: P.inkOnNight,
  },
  testSub: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 16,
    color: P.quiet,
    marginTop: 3,
  },
});
