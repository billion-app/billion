/**
 * How to Vote — the plain-language starting point for casting a ballot.
 *
 * The detail screens (How to Vote lookup, election access, election process)
 * already hold the sourced facts, but each one assumes the voter knows which
 * method they want. This screen answers the earlier question — "what are my
 * options, and what does each one take?" — in short lines, icons, and bullets,
 * then hands off to those pages. It is static by design: no address, no
 * provider call, no launch gate, so it works even when the live ballot lookup
 * is unavailable.
 */
import type { Href } from "expo-router";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import type { IconName } from "~/components/ui";
import type { VotingMethodId } from "~/utils/voting";
import { LinkRow } from "~/components/how-to-vote/parts";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, NavHeader, PrimaryButton } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  colors,
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  planes,
} from "~/styles";

export const ErrorBoundary = createRouteErrorBoundary("how-to-vote-guide");

interface GuideMethod {
  id: VotingMethodId;
  icon: IconName;
  title: string;
  /** One short line per point — no paragraphs. */
  points: readonly string[];
  /** When this way suits someone. One line. */
  note: string;
}

export default function HowToVoteGuideScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();

  const METHODS: readonly GuideMethod[] = [
    {
      id: "mail",
      icon: "mail",
      title: t("voteGuide.mail.title"),
      points: [
        t("voteGuide.mail.p1"),
        t("voteGuide.mail.p2"),
        t("voteGuide.mail.p3"),
      ],
      note: t("voteGuide.mail.note"),
    },
    {
      id: "dropBox",
      icon: "inbox",
      title: t("voteGuide.dropBox.title"),
      points: [
        t("voteGuide.dropBox.p1"),
        t("voteGuide.dropBox.p2"),
        t("voteGuide.dropBox.p3"),
      ],
      note: t("voteGuide.dropBox.note"),
    },
    {
      id: "earlyInPerson",
      icon: "calendar",
      title: t("voteGuide.early.title"),
      points: [
        t("voteGuide.early.p1"),
        t("voteGuide.early.p2"),
        t("voteGuide.early.p3"),
      ],
      note: t("voteGuide.early.note"),
    },
    {
      id: "electionDay",
      icon: "flag",
      title: t("voteGuide.electionDay.title"),
      points: [
        t("voteGuide.electionDay.p1"),
        t("voteGuide.electionDay.p2"),
        t("voteGuide.electionDay.p3"),
      ],
      note: t("voteGuide.electionDay.note"),
    },
  ];

  const STEPS: readonly {
    icon: IconName;
    title: string;
    detail: string;
  }[] = [
    {
      icon: "help",
      title: t("voteGuide.step1.title"),
      detail: t("voteGuide.step1.detail"),
    },
    {
      icon: "vote",
      title: t("voteGuide.step2.title"),
      detail: t("voteGuide.step2.detail"),
    },
    {
      icon: "clock",
      title: t("voteGuide.step3.title"),
      detail: t("voteGuide.step3.detail"),
    },
  ];

  const WHAT_TO_BRING: readonly { icon: IconName; text: string }[] = [
    { icon: "pin", text: t("voteGuide.bring.address") },
    { icon: "mail", text: t("voteGuide.bring.ballot") },
    {
      icon: "shield",
      text: t("voteGuide.bring.id"),
    },
    { icon: "accessibility", text: t("voteGuide.bring.helper") },
  ];

  const DATES: readonly { icon: IconName; label: string; detail: string }[] = [
    {
      icon: "edit",
      label: t("voteGuide.dates.registration"),
      detail: t("voteGuide.dates.registrationDetail"),
    },
    {
      icon: "mail",
      label: t("voteGuide.dates.missing"),
      detail: t("voteGuide.dates.missingDetail"),
    },
    {
      icon: "inbox",
      label: t("voteGuide.dates.return"),
      detail: t("voteGuide.dates.returnDetail"),
    },
  ];

  const QUESTIONS: readonly {
    icon: IconName;
    question: string;
    answer: string;
  }[] = [
    {
      icon: "mail",
      question: t("voteGuide.faq.mail"),
      answer: t("voteGuide.faq.mailAnswer"),
    },
    {
      icon: "help",
      question: t("voteGuide.faq.registration"),
      answer: t("voteGuide.faq.registrationAnswer"),
    },
    {
      icon: "accessibility",
      question: t("voteGuide.faq.help"),
      answer: t("voteGuide.faq.helpAnswer"),
    },
  ];

  const TIPS: readonly { icon: IconName; text: string }[] = [
    { icon: "clock", text: t("voteGuide.tip.hours") },
    {
      icon: "doc",
      text: t("voteGuide.tip.mistake"),
    },
    { icon: "globe", text: t("voteGuide.tip.language") },
  ];

  const KEEP_READING: readonly {
    icon: IconName;
    label: string;
    detail: string;
    route: Href;
  }[] = [
    {
      icon: "accessibility",
      label: t("voteGuide.reading.access"),
      detail: t("voteGuide.reading.accessDetail"),
      route: "/election-access",
    },
    {
      icon: "users",
      label: t("voteGuide.reading.process"),
      detail: t("voteGuide.reading.processDetail"),
      route: "/election-process",
    },
    {
      icon: "bookmark",
      label: t("voteGuide.reading.notes"),
      detail: t("voteGuide.reading.notesDetail"),
      route: "/ballot-preparation",
    },
  ];

  const openMethod = (method: VotingMethodId) => {
    router.push({ pathname: "/how-to-vote", params: { method } });
  };

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
        <Text style={s.display}>{t("voteGuide.title")}</Text>
        <Text style={s.intro}>{t("voteGuide.intro")}</Text>

        <View style={s.steps}>
          {STEPS.map((step) => (
            <View key={step.title} style={s.step}>
              <View style={s.stepIcon}>
                <Icon name={step.icon} size={18} color={colors.bill} />
              </View>
              <View style={s.stepBody}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <Card style={s.tips}>
          <Kicker>{t("voteGuide.resources")}</Kicker>
          <LinkRow
            label={t("voteGuide.link.registration")}
            url="https://voterstatus.sos.ca.gov/"
          />
          <LinkRow
            label={t("voteGuide.link.locations")}
            url="https://www.sos.ca.gov/elections/polling-place"
          />
          <LinkRow
            label={t("voteGuide.link.rules")}
            url="https://www.sos.ca.gov/elections/where-and-how"
          />
          <LinkRow
            label={t("voteGuide.link.sameDay")}
            url="https://www.sos.ca.gov/elections/voter-registration/same-day-reg"
          />
          <LinkRow
            label={t("voteGuide.link.outside")}
            url="https://vote.gov/"
          />
        </Card>

        <Kicker>{t("voteGuide.pick")}</Kicker>
        <View style={s.methodList}>
          {METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${method.title}. ${method.points.join(" ")}`}
              accessibilityHint={t("voteGuide.methodHint")}
              onPress={() => openMethod(method.id)}
              style={s.methodCard}
            >
              <View style={s.methodHead}>
                <View style={s.methodIcon}>
                  <Icon name={method.icon} size={20} color={colors.bill} />
                </View>
                <Text style={s.methodTitle}>{method.title}</Text>
                <Icon name="chevR" size={16} color={colors.textSecondary} />
              </View>
              <View style={s.points}>
                {method.points.map((point) => (
                  <View key={point} style={s.point}>
                    <Icon name="check" size={13} color={colors.green[500]} />
                    <Text style={s.pointText}>{point}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.methodNote}>{method.note}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Kicker>{t("voteGuide.bring")}</Kicker>
        <Card style={s.tips}>
          {WHAT_TO_BRING.map((item) => (
            <View key={item.text} style={s.tip}>
              <Icon name={item.icon} size={15} color={colors.bill} />
              <Text style={s.tipText}>{item.text}</Text>
            </View>
          ))}
        </Card>

        <Kicker>{t("voteGuide.dates")}</Kicker>
        <Card style={s.dates}>
          {DATES.map((date) => (
            <View key={date.label} style={s.dateRow}>
              <View style={s.dateIcon}>
                <Icon name={date.icon} size={15} color={colors.bill} />
              </View>
              <View style={s.dateBody}>
                <Text style={s.dateLabel}>{date.label}</Text>
                <Text style={s.dateDetail}>{date.detail}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push("/how-to-vote")}
            style={s.dateLink}
          >
            <Text style={s.dateLinkText}>{t("voteGuide.published")}</Text>
            <Icon name="arrowRight" size={14} color={colors.bill} />
          </TouchableOpacity>
        </Card>

        <Kicker>{t("voteGuide.questions")}</Kicker>
        <View style={s.questions}>
          {QUESTIONS.map((item) => (
            <View key={item.question} style={s.question}>
              <Icon name={item.icon} size={15} color={colors.bill} />
              <View style={s.questionBody}>
                <Text style={s.questionTitle}>{item.question}</Text>
                <Text style={s.questionAnswer}>{item.answer}</Text>
              </View>
            </View>
          ))}
        </View>

        <Kicker>{t("voteGuide.tips")}</Kicker>
        <Card style={s.tips}>
          {TIPS.map((tip) => (
            <View key={tip.text} style={s.tip}>
              <Icon name={tip.icon} size={15} color={colors.bill} />
              <Text style={s.tipText}>{tip.text}</Text>
            </View>
          ))}
        </Card>

        <Kicker>{t("voteGuide.reading")}</Kicker>
        <View style={s.links}>
          {KEEP_READING.map((link) => (
            <TouchableOpacity
              key={link.label}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${link.label}. ${link.detail}`}
              onPress={() => router.push(link.route)}
              style={s.linkRow}
            >
              <View style={s.linkIcon}>
                <Icon name={link.icon} size={16} color={colors.bill} />
              </View>
              <View style={s.linkBody}>
                <Text style={s.linkLabel}>{link.label}</Text>
                <Text style={s.linkDetail}>{link.detail}</Text>
              </View>
              <Icon name="chevR" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

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
            <Icon name="pin" size={14} color={colors.textSecondary} />
            <Text style={s.ctaLinkText}>{t("voteGuide.cta.location")}</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    color: colors.white,
  },
  intro: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: "rgba(255,255,255,0.78)",
    marginTop: 8,
    marginBottom: 20,
  },

  steps: { gap: 10, marginBottom: 22 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${colors.bill}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBody: { flex: 1, minWidth: 0, gap: 2 },
  stepTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  stepDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  methodList: { gap: 12, marginTop: 10, marginBottom: 24 },
  methodCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 16,
    padding: 15,
    gap: 11,
  },
  methodHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitle: {
    flex: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 21,
    color: colors.white,
  },
  points: { gap: 7, paddingLeft: 2 },
  point: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pointText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
  },
  methodNote: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  tips: { gap: 12, marginTop: 10, marginBottom: 24 },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: "rgba(255,255,255,0.84)",
  },

  dates: { gap: 14, marginTop: 10, marginBottom: 24 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  dateIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBody: { flex: 1, minWidth: 0, gap: 1 },
  dateLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  dateDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  dateLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  dateLinkText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.bill,
  },

  questions: { gap: 14, marginTop: 10, marginBottom: 24 },
  question: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  questionBody: { flex: 1, minWidth: 0, gap: 2 },
  questionTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  questionAnswer: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
  },

  links: { gap: 10, marginTop: 10, marginBottom: 24 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  linkBody: { flex: 1, minWidth: 0, gap: 2 },
  linkLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  linkDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  cta: { marginTop: 4, borderColor: hair[2] },
  ctaTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.white,
  },
  ctaBody: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
});
