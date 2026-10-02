import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { SourceLink } from "~/components/ballot-evidence/BallotEvidence";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { NavHeader } from "~/components/ui";
import { fontBody, fontEditorial, DigestPalette as P, sp } from "~/styles";

const office =
  "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices";
const hotlines =
  "https://www.sos.ca.gov/elections/voting-resources/voting-california/voter-hotlines";

/** Statewide official resource discovery; never a claim about a particular location. */
export default function ElectionAccessScreen() {
  const router = useRouter();
  return (
    <View style={s.screen}>
      <NavHeader
        title="Voting support"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>
          California voting support
        </Text>
        <Text style={s.body}>
          Official language and accessibility resources. Links open California’s
          websites; they do not translate Billion.
        </Text>
        <SourceLink
          label="Español · Derechos del votante / Voter rights"
          url="https://www.sos.ca.gov/es/elections/voter-bill-rights"
          prominence="primary"
        />
        <SourceLink
          label="Accessible formats and voting help"
          url="https://www.sos.ca.gov/elections/voting-resources/voters-disabilities"
          prominence="primary"
        />
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.heading}>
            Confirm local support
          </Text>
          <Text style={s.body}>
            Billion has not verified your local ballot’s languages or access at
            your voting location. Ask your county office about translated
            materials, entrances, parking, equipment, curbside voting and how to
            request assistance before travelling.
          </Text>
          <SourceLink
            label="Find your California county elections office"
            url={office}
          />
        </View>
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.heading}>
            Help in your language
          </Text>
          <Text style={s.body}>
            California lists phone help in English, Español, 中文, हिन्दी,
            日本語, ខ្មែរ, 한국어, Tagalog, ภาษาไทย and Việt ngữ. Choose your
            language on the official page for voting questions or mailed
            materials.
          </Text>
          <SourceLink
            label="Find your language’s voter hotline"
            url={hotlines}
          />
          <Text style={s.body}>
            California also lists 711 for TTY/TDD (text telephone) help. Hotline
            languages do not establish local ballot language coverage.
          </Text>
        </View>
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.heading}>
            Translated statewide guide
          </Text>
          <Text style={s.body}>
            At our October 2 check, the November 2026 guide’s translated PDFs
            were announced for October but had no download links. Check the
            official page for newly published editions.
          </Text>
          <SourceLink
            label="Check official guide language editions"
            url="https://voterguide.sos.ca.gov/"
          />
          <Text style={s.body}>
            This statewide guide does not cover every local race or measure.
          </Text>
        </View>
        <Text style={s.caption}>
          Official sources checked October 2, 2026. Coverage beyond these linked
          resources remains unverified.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: { padding: sp[5], paddingBottom: sp[8], gap: sp[4] },
  title: { fontFamily: fontEditorial.bold, fontSize: 30, color: P.inkOnNight },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 22,
    color: P.inkOnNight,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  caption: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  card: {
    backgroundColor: P.card,
    borderRadius: 14,
    padding: sp[4],
    gap: sp[3],
  },
});
