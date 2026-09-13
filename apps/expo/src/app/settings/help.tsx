import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "~/components/Themed";
import { Icon, ScreenShell, SearchInput } from "~/components/ui";
import {
  DigestHair,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";

const FAQS = [
  {
    q: "Where does Billion get its information?",
    a: "Directly from public sources — Congress.gov, the Federal Register, court dockets, and your local government's records. We link the original every time.",
  },
  {
    q: "Is the AI explainer reliable?",
    a: "It summarizes the official text to make it readable, but it can simplify nuance. Every article links the verbatim source so you can verify.",
  },
  {
    q: "How does Dual-Lens stay neutral?",
    a: "We surface arguments from across the spectrum side by side rather than blending them into a single 'neutral' voice.",
  },
  {
    q: "How do I change my district?",
    a: "Update your address under Elections, or in Edit Profile. We re-pull your ballot automatically.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<number>(0);

  return (
    <ScreenShell title="Help">
      <SearchInput placeholder="Search help…" style={{ marginBottom: 20 }} />

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
              <Text style={s.q}>{f.q}</Text>
              <Icon
                name="chevD"
                size={16}
                color={P.quiet}
                style={expanded ? s.chevOpen : undefined}
              />
            </View>
            {expanded ? <Text style={s.a}>{f.a}</Text> : null}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={s.contactRow}
        activeOpacity={0.8}
        onPress={() => router.push("/settings/feedback")}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <Icon name="message" size={18} color={P.spark} />
        <Text style={s.contactTitle}>Still stuck?</Text>
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
