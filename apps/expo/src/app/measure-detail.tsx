import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "~/components/Themed";
import { Card, Kicker, NavHeader, PrimaryButton } from "~/components/ui";
import { colors, fontBody, fontDisplay, planes } from "~/styles";

export default function MeasureDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    referendumTitle: string;
    referendumSubtitle: string;
    referendumProStatement: string;
    referendumConStatement: string;
    referendumText: string;
    referendumUrl: string;
    summary: string;
  }>();

  return (
    <View style={s.screen}>
      <NavHeader title="Ballot Measure" onBack={() => router.back()} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.badge}>
          <Text style={s.badgeText}>MEASURE</Text>
        </View>

        <Text style={s.title}>{params.referendumTitle}</Text>

        {params.summary ? (
          <Text style={s.subtitle}>{params.summary}</Text>
        ) : params.referendumSubtitle ? (
          <Text style={s.subtitle}>{params.referendumSubtitle}</Text>
        ) : null}

        {/* Yes / No arguments */}
        {(params.referendumProStatement || params.referendumConStatement) && (
          <View style={s.section}>
            <Kicker>A YES vote vs. a NO vote</Kicker>
            <View style={{ gap: 12 }}>
              {params.referendumProStatement ? (
                <Card>
                  <View style={s.stanceHeader}>
                    <View
                      style={[
                        s.stanceDot,
                        { backgroundColor: colors.green[500] },
                      ]}
                    />
                    <Text style={s.stanceLabel}>A YES vote means</Text>
                  </View>
                  <Text style={s.stanceText}>
                    {params.referendumProStatement}
                  </Text>
                </Card>
              ) : null}
              {params.referendumConStatement ? (
                <Card>
                  <View style={s.stanceHeader}>
                    <View
                      style={[
                        s.stanceDot,
                        { backgroundColor: colors.red[500] },
                      ]}
                    />
                    <Text style={s.stanceLabel}>A NO vote means</Text>
                  </View>
                  <Text style={s.stanceText}>
                    {params.referendumConStatement}
                  </Text>
                </Card>
              ) : null}
            </View>
          </View>
        )}

        {/* Full referendum text */}
        {params.referendumText ? (
          <View style={s.section}>
            <Kicker>Full text</Kicker>
            <Card>
              <Text style={s.fullText}>{params.referendumText}</Text>
            </Card>
          </View>
        ) : null}

        {/* Source link */}
        {params.referendumUrl ? (
          <View style={s.section}>
            <PrimaryButton
              label="View official source"
              icon="external"
              onPress={() => void Linking.openURL(params.referendumUrl)}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  badge: {
    backgroundColor: "#4A7CFF",
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 14,
  },
  badgeText: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 26,
    color: colors.white,
    marginBottom: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
  stanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  stanceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stanceLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.white,
  },
  stanceText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
  },
  fullText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 22,
  },
});
