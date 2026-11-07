/**
 * How to Vote — the plain-language starting point for casting a ballot.
 *
 * The detail screens (How to Vote lookup, election access, election process)
 * already hold the sourced facts, but each one assumes the voter knows which
 * method they want. This screen answers the earlier question — "what are my
 * options, and what does each one take?" — in short sections of one-line
 * rows, then hands off to those pages. It is static by design: no address, no
 * provider call, no launch gate, so it works even when the live ballot lookup
 * is unavailable.
 */
import type { Href } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import type { AppTranslate } from "~/i18n/app-strings";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { Text } from "~/components/Themed";
import { Card, Icon, NavHeader, PrimaryButton } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestHair,
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
} from "~/styles";

export const ErrorBoundary = createRouteErrorBoundary("how-to-vote-guide");

type GuideRow = { icon: IconName; title: string; note?: string } & (
  | { route: Href; url?: never }
  | { url: string; route?: never }
  | { route?: never; url?: never }
);

interface GuideSection {
  title: string;
  note?: string;
  rows: readonly GuideRow[];
}

function guideSections(t: AppTranslate): readonly GuideSection[] {
  return [
    {
      title: t("voteGuide.ways"),
      rows: [
        {
          icon: "mail",
          title: t("voteGuide.mail.title"),
          note: t("voteGuide.mail.p1"),
          route: { pathname: "/how-to-vote", params: { method: "mail" } },
        },
        {
          icon: "inbox",
          title: t("voteGuide.dropBox.title"),
          note: t("voteGuide.dropBox.p3"),
          route: { pathname: "/how-to-vote", params: { method: "dropBox" } },
        },
        {
          icon: "calendar",
          title: t("voteGuide.early.title"),
          note: t("voteGuide.early.p3"),
          route: {
            pathname: "/how-to-vote",
            params: { method: "earlyInPerson" },
          },
        },
        {
          icon: "flag",
          title: t("voteGuide.electionDay.title"),
          note: t("voteGuide.electionDay.p3"),
          route: {
            pathname: "/how-to-vote",
            params: { method: "electionDay" },
          },
        },
      ],
    },
    {
      // Generic deadline types, not dates. Each one opens the office that
      // publishes the actual date for the current election.
      title: t("voteGuide.dates"),
      note: t("voteGuide.datesNote"),
      rows: [
        {
          icon: "edit",
          title: t("voteGuide.dates.registration"),
          note: t("voteGuide.dates.registrationDetail"),
          url: "https://www.sos.ca.gov/elections/upcoming-elections",
        },
        {
          icon: "mail",
          title: t("voteGuide.dates.missing"),
          note: t("voteGuide.dates.missingDetail"),
          url: "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices",
        },
        {
          icon: "inbox",
          title: t("voteGuide.dates.return"),
          note: t("voteGuide.dates.returnDetail"),
          url: "https://www.sos.ca.gov/elections/upcoming-elections",
        },
        {
          icon: "doc",
          title: t("voteGuide.published"),
          route: "/how-to-vote",
        },
      ],
    },
    {
      title: t("voteGuide.beforeYouGo"),
      rows: [
        { icon: "mail", title: t("voteGuide.bring.ballot") },
        {
          icon: "shield",
          title: t("voteGuide.bring.id"),
          url: "https://www.sos.ca.gov/elections/where-and-how",
        },
        { icon: "accessibility", title: t("voteGuide.bring.helper") },
        { icon: "clock", title: t("voteGuide.tip.hours") },
        { icon: "doc", title: t("voteGuide.tip.mistake") },
      ],
    },
    {
      title: t("voteGuide.help"),
      rows: [
        {
          icon: "users",
          title: t("voteGuide.reading.process"),
          note: t("voteGuide.reading.processDetail"),
          route: "/election-process",
        },
        {
          icon: "accessibility",
          title: t("voteGuide.reading.access"),
          note: t("voteGuide.reading.accessDetail"),
          route: "/election-access",
        },
        {
          icon: "vote",
          title: t("voteGuide.link.registration"),
          url: "https://voterstatus.sos.ca.gov/",
        },
        {
          icon: "book",
          title: t("Official voter guide"),
          url: "https://voterguide.sos.ca.gov/",
        },
        {
          icon: "pin",
          title: t("voteGuide.link.locations"),
          url: "https://www.sos.ca.gov/elections/polling-place",
        },
        {
          icon: "globe",
          title: t("voteGuide.link.outside"),
          url: "https://vote.gov/",
        },
      ],
    },
  ];
}

function GuideRowView({ row, last }: { row: GuideRow; last: boolean }) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const body = (
    <>
      <View style={s.rowIcon}>
        <Icon name={row.icon} size={16} color={P.linkOnNight} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{row.title}</Text>
        {row.note ? <Text style={s.rowNote}>{row.note}</Text> : null}
      </View>
    </>
  );
  const style = [s.row, !last && s.rowRule];
  const label = row.note ? `${row.title}. ${row.note}` : row.title;
  const { route, url } = row;
  if (route)
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => router.push(route)}
        style={style}
      >
        {body}
        <Icon name="chevR" size={16} color={P.quiet} />
      </TouchableOpacity>
    );
  if (url)
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityHint={t("common.opensInBrowser")}
        onPress={() => void Linking.openURL(url).catch(() => undefined)}
        style={style}
      >
        {body}
        <Icon name="external" size={15} color={P.linkOnNight} />
      </TouchableOpacity>
    );
  return (
    <View accessible accessibilityLabel={label} style={style}>
      {body}
    </View>
  );
}

export default function HowToVoteGuideScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();

  return (
    <View style={s.screen}>
      <NavHeader
        title={t("voteGuide.title")}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/elections")
        }
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.intro}>
          <Text accessibilityRole="header" style={s.display}>
            {t("voteGuide.title")}
          </Text>
          <Text style={s.introText}>{t("voteGuide.intro")}</Text>
        </View>

        {guideSections(t).map((section) => (
          <View key={section.title} style={s.section}>
            <Text accessibilityRole="header" style={s.sectionTitle}>
              {section.title}
            </Text>
            {section.note ? (
              <Text style={s.sectionNote}>{section.note}</Text>
            ) : null}
            <Card flush style={s.group}>
              {section.rows.map((row, index) => (
                <GuideRowView
                  key={row.title}
                  row={row}
                  last={index === section.rows.length - 1}
                />
              ))}
            </Card>
          </View>
        ))}

        <Card style={s.cta}>
          <Text style={s.ctaTitle}>{t("voteGuide.cta.title")}</Text>
          <Text style={s.ctaBody}>{t("voteGuide.cta.body")}</Text>
          <PrimaryButton
            label={t("voteGuide.cta.button")}
            onPress={() => router.push("/how-to-vote")}
            style={s.ctaButton}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push("/settings/location")}
            style={s.ctaLink}
          >
            <Icon name="pin" size={14} color={P.quiet} />
            <Text style={s.ctaLinkText}>{t("voteGuide.cta.location")}</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 28 },
  intro: { gap: 8 },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    color: P.inkOnNight,
  },
  introText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: P.quiet,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 20,
    lineHeight: 26,
    color: P.inkOnNight,
  },
  sectionNote: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.quiet,
  },
  group: { borderRadius: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: `${P.primary}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  rowNote: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: P.quiet,
  },
  cta: { borderColor: DigestHair.cardBorder },
  ctaTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: P.inkOnNight,
  },
  ctaBody: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.quiet,
    marginTop: 4,
  },
  ctaButton: { marginTop: 14 },
  ctaLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    marginTop: 6,
  },
  ctaLinkText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: P.quiet,
  },
});
