import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { OfficialResourceLink as SourceLink } from "~/components/ballot/OfficialResourceLink";
import { Icon, NavHeader } from "~/components/ui";
import {
  colors,
  digest,
  fontBody,
  fontEditorial,
  hair,
  planes,
  sp,
} from "~/styles";

const office =
  "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices";
const hotlines =
  "https://www.sos.ca.gov/elections/voting-resources/voting-california/voter-hotlines";

/** Category symbols repeat the visible label; they never certify services. */
function TopicHeading({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <View style={s.topicHeading}>
      <View
        style={s.topicIcon}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name={icon} size={16} color={digest.primary} />
      </View>
      <Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>
        {children}
      </Text>
    </View>
  );
}

function Details({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={s.disclosure}
      >
        <Text style={s.detailLabel}>{title}</Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon
            name={expanded ? "chevD" : "chevR"}
            size={16}
            color={colors.white}
          />
        </View>
      </Pressable>
      {expanded && <View style={s.details}>{children}</View>}
    </View>
  );
}

/** Statewide official resource discovery; never a claim about a particular location. */
export default function ElectionAccessScreen() {
  const router = useRouter();
  return (
    <View style={s.screen}>
      <NavHeader title="California" tone="dark" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>
          Voting help
        </Text>
        <Text style={s.caption}>Official resources · Opens state websites</Text>
        <View style={s.card}>
          <TopicHeading icon="globe">Help in your language</TopicHeading>
          <SourceLink
            label="Voter hotlines"
            url={hotlines}
            prominence="primary"
          />
          <SourceLink
            label="Español · Derechos del votante / Voter rights"
            url="https://www.sos.ca.gov/es/elections/voter-bill-rights"
          />
          <Text style={s.caption}>Español · 中文 · हिन्दी · +7 languages</Text>
          <Details title="All 10 hotline languages">
            <Text style={s.body}>
              English, Español, 中文, हिन्दी, 日本語, ខ្មែរ, 한국어, Tagalog,
              ภาษาไทย and Việt ngữ.
            </Text>
            <Text style={s.body}>
              Ask voting questions or request mailed materials. California also
              lists 711 for TTY/TDD (text telephone) help.
            </Text>
            <Text style={s.body}>
              Hotline languages may differ from your local ballot. These
              resources do not change the app language.
            </Text>
          </Details>
        </View>
        <View style={s.card}>
          <TopicHeading icon="accessibility">Accessible voting</TopicHeading>
          <SourceLink
            label="Accessible voting resources"
            url="https://www.sos.ca.gov/elections/voting-resources/voters-disabilities"
            prominence="primary"
          />
          <Text style={s.caption}>
            Audio, large print, voting equipment and voting at home.
          </Text>
        </View>
        <View style={s.card}>
          <TopicHeading icon="pin">Help at your voting place</TopicHeading>
          <Text style={s.body}>
            Ask your county about ballot languages and access before travelling.
          </Text>
          <Text style={s.caption}>
            Local availability is unverified in Billion.
          </Text>
          <SourceLink label="Find my county elections office" url={office} />
          <Details title="What to ask about">
            <Text style={s.body}>
              Ask about translated materials, entrances, parking, accessible
              equipment, curbside voting and how to request assistance.
            </Text>
            <Text style={s.body}>
              Availability varies by location. A statewide resource does not
              confirm services at your voting place.
            </Text>
          </Details>
        </View>
        <View style={s.card}>
          <TopicHeading icon="book">Translated voter guide</TopicHeading>
          <Text style={s.body}>
            Translated guide downloads were not linked at our last check.
          </Text>
          <Text style={s.caption}>
            Checked October 2, 2026 · November election
          </Text>
          <SourceLink
            label="Check official guide"
            url="https://voterguide.sos.ca.gov/"
          />
          <Text style={s.caption}>
            Statewide guide only; local ballot materials may differ.
          </Text>
        </View>
        <Details title="About these resources">
          <Text style={s.body}>
            Official sources checked October 2, 2026. The November 2026 guide
            announced translated PDFs for October but had no download links at
            that check. Check the official page for newly published editions.
          </Text>
          <Text style={s.body}>
            Billion has not verified coverage beyond these linked resources.
            Opening a translated page does not translate Billion.
          </Text>
        </Details>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  content: { padding: sp[5], paddingBottom: sp[8], gap: 18 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 26,
    lineHeight: 31,
    color: colors.white,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.white,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.white,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.white,
    opacity: 0.72,
  },
  card: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: sp[4],
    gap: sp[2],
  },
  topicHeading: { flexDirection: "row", alignItems: "center", gap: sp[2] },
  topicIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: `${digest.primary}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  disclosure: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[1],
  },
  detailLabel: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.white,
  },
  details: { gap: sp[3], paddingBottom: sp[2] },
});
