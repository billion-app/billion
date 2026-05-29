import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/Themed";
import { Card, Icon, ScreenShell, SearchInput } from "~/components/ui";
import { colors, fontBody } from "~/styles";

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
  const [open, setOpen] = useState<number>(0);

  return (
    <ScreenShell title="Help & FAQ">
      <SearchInput
        placeholder="Search help articles…"
        style={{ marginBottom: 22 }}
      />

      <View style={{ gap: 10 }}>
        {FAQS.map((f, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.8}
            onPress={() => setOpen(open === i ? -1 : i)}
          >
            <Card style={s.faqCard}>
              <View style={s.cardHead}>
                <Text style={s.q}>{f.q}</Text>
                <Icon
                  name="chevD"
                  size={18}
                  color={colors.textSecondary}
                  style={open === i ? s.chevOpen : undefined}
                />
              </View>
              {open === i && <Text style={s.a}>{f.a}</Text>}
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={s.contactRow}>
        <Icon name="message" size={22} color={colors.bill} />
        <View style={{ flex: 1 }}>
          <Text style={s.contactTitle}>Still stuck?</Text>
          <Text style={s.contactSub}>Reach our team directly</Text>
        </View>
        <Icon name="chevR" size={18} color="#5B6172" />
      </Card>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  faqCard: { paddingVertical: 16, paddingHorizontal: 18 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  q: { flex: 1, fontFamily: "InriaSerif-Bold", fontSize: 15.5, color: colors.white },
  chevOpen: { transform: [{ rotate: "180deg" }] },
  a: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    marginTop: 12,
    lineHeight: 22,
  },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 18 },
  contactTitle: { fontFamily: fontBody.semibold, fontSize: 14.5, color: colors.white },
  contactSub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
