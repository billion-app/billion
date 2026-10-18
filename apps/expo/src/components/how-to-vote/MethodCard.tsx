/**
 * MethodCard — one way to vote, collapsed to a scannable row and expanded to a
 * numbered checklist plus the locations it applies to.
 *
 * Collapsed is the default because the whole point of the screen is that a
 * voter can see every option at once and pick one. Expanding is what reveals
 * procedure; only one card is open at a time (owned by the parent).
 */
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import type { IconName } from "~/components/ui";
import type { VotingMethod, VotingMethodId } from "~/utils/voting";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import { daysUntil } from "~/utils/dates";
import { LinkRow, LocationList, StatusChip, UnavailableNote } from "./parts";

const METHOD_ICON: Record<VotingMethodId, IconName> = {
  mail: "mail",
  dropBox: "inbox",
  earlyInPerson: "calendar",
  electionDay: "pin",
};

const LOCATION_ACCENT: Record<VotingMethodId, string> = {
  mail: colors.bill,
  dropBox: colors.green[500],
  earlyInPerson: colors.bill,
  electionDay: colors.green[500],
};

export function MethodCard({
  method,
  mailOnly = false,
  expanded,
  onToggle,
  locationFinderUrl,
}: {
  method: VotingMethod;
  mailOnly?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Authority context supplied by callers; instructions open at the source. */
  authorityName?: string;
  /** Official location finder — the fallback when nothing is published. */
  locationFinderUrl?: string;
}) {
  const { t } = useAppTranslation();
  const title = t(
    method.id === "mail" && mailOnly
      ? "howToVoteLookup.method.mailOnly"
      : method.id === "electionDay" && method.status === "limited"
        ? "howToVoteLookup.method.limited"
        : `howToVoteLookup.method.${method.id}`,
  );
  const subtitle =
    method.id === "mail"
      ? t("howToVoteLookup.returnMissing")
      : method.status === "limited"
        ? t("howToVoteLookup.limitedBody")
        : method.locations.length > 0
          ? t(`howToVoteLookup.count.${method.id}`, {
              count: method.locations.length,
            })
          : t("howToVoteLookup.locationsMissing");
  const openingDays = method.startDate
    ? daysUntil(method.startDate)
    : undefined;
  const chip = {
    ...method.chip,
    label:
      method.id === "earlyInPerson" &&
      method.status === "upcoming" &&
      openingDays !== undefined
        ? openingDays === 1
          ? t("howToVoteLookup.opensTomorrow")
          : t("howToVoteLookup.opensDays", { count: openingDays })
        : t(`howToVoteLookup.status.${method.status}`),
  };
  const [showAllLocations, setShowAllLocations] = useState(false);
  const dimmed = method.status === "limited" || method.status === "closed";

  return (
    <View
      style={[
        s.card,
        expanded && s.cardOpen,
        dimmed && !expanded && s.cardDimmed,
      ]}
    >
      <TouchableOpacity
        style={s.head}
        activeOpacity={0.85}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}. ${chip.label}. ${subtitle}`}
        accessibilityHint={
          expanded ? t("howToVoteLookup.collapse") : t("howToVoteLookup.expand")
        }
      >
        <View style={[s.iconTile, expanded && s.iconTileOpen]}>
          <Icon
            name={METHOD_ICON[method.id]}
            size={19}
            color={dimmed ? colors.textSecondary : colors.bill}
          />
        </View>
        <View style={s.body}>
          <Text style={[s.title, dimmed && s.titleDimmed]}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <View style={s.chips}>
            <StatusChip chip={chip} />
          </View>
        </View>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={expanded ? colors.white : "#5B6172"}
          style={s.chevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={s.open}>
          <LinkRow
            label={t("howToVoteLookup.instructions")}
            url={method.instructionsUrl ?? locationFinderUrl}
          />

          {method.locations.length > 0 ? (
            <>
              <View style={s.rule} />
              <Text style={s.kicker}>
                {t(`howToVoteLookup.locationTitle.${method.id}`)}
              </Text>
              <LocationList
                locations={method.locations}
                accent={LOCATION_ACCENT[method.id]}
                expanded={showAllLocations}
                onToggle={() => setShowAllLocations((v) => !v)}
              />
            </>
          ) : method.status === "unknown" ? (
            <>
              <View style={s.rule} />
              <UnavailableNote
                title={t("howToVoteLookup.detailsTitle")}
                body={t("howToVoteLookup.detailsBody")}
              />
              <LinkRow
                label={t("howToVoteLookup.findLocations")}
                url={locationFinderUrl}
              />
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
    overflow: "hidden",
  },
  cardOpen: { borderColor: hair[3] },
  cardDimmed: { opacity: 0.62 },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  iconTileOpen: { backgroundColor: planes.hi },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: colors.white,
  },
  titleDimmed: { color: colors.textSecondary },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  chevron: { marginTop: 11 },
  open: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: hair[1],
  },
  rule: { height: 1, backgroundColor: hair[2], marginVertical: 14 },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 10,
  },
});
