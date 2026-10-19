/**
 * How to Vote — the voting-logistics screen.
 *
 * Answers one question: what do I need to do to successfully cast my ballot?
 * Deliberately NOT a second ballot screen — candidates and measures stay on the
 * Elections tab. This screen only covers methods, locations, and hand-offs to
 * the responsible election authority.
 *
 * Published guidance and location citations retain their source links. Missing
 * dates stay unknown; no deadline is computed from Election Day. The shared
 * guidance component checks that its source belongs to this election.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { VotingMethodId } from "~/utils/voting";
import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { BallotLookupGate } from "~/components/ballot/BallotLookupGate";
import { MethodCard } from "~/components/how-to-vote/MethodCard";
import {
  FactRow,
  LinkRow,
  SourceFooter,
  UnavailableNote,
} from "~/components/how-to-vote/parts";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, NavHeader, PrimaryButton } from "~/components/ui";
import { OfficialVotingGuidance } from "~/components/voting-logistics/VotingLogisticsSection";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useUserAddress } from "~/hooks/useUserAddress";
import {
  colors,
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  planes,
} from "~/styles";
import { trpc } from "~/utils/api";
import { currentBallot } from "~/utils/ballot-lookup";
import { daysUntil } from "~/utils/dates";
import { isCaliforniaState } from "~/utils/elections";
import { electionsAreLive } from "~/utils/elections-live";
import {
  buildVotingPlan,
  electionPhase,
  registrationCheckUrl,
  shortAddress,
} from "~/utils/voting";

export const ErrorBoundary = createRouteErrorBoundary("how-to-vote");

export default function HowToVoteRoute() {
  const router = useRouter();
  const availability = useQuery({
    ...trpc.civic.getBallotAvailability.queryOptions(),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  if (!electionsAreLive(availability.isError ? undefined : availability.data)) {
    return (
      <BallotLookupGate
        checking={availability.isFetching}
        failed={availability.isError}
        onRetry={() => void availability.refetch()}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/elections")
        }
        onHome={() => router.replace("/elections")}
      />
    );
  }
  return <HowToVoteScreen />;
}

function HowToVoteScreen() {
  const { t, formatDate } = useAppTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    method?: string;
    address?: string;
    electionId?: string;
  }>();
  const { address: storedAddress, isLoading: addressLoading } =
    useUserAddress();
  const [lookupAddress, setAddress] = useState<string | undefined>(
    params.address,
  );
  const address = lookupAddress ?? storedAddress;
  const [requestedElectionId, setRequestedElectionId] = useState(
    params.electionId,
  );
  const [editing, setEditing] = useState(false);
  const [openMethod, setOpenMethod] = useState<VotingMethodId | null>(
    (params.method as VotingMethodId | undefined) ?? null,
  );

  const hasAddress = !!address;

  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({
      address: address ?? "",
      electionId: requestedElectionId,
      includeEnrichment: false,
    }),
    enabled: hasAddress,
    retry: 1,
  });

  const { data, mismatch } = currentBallot({
    data: voterInfoQuery.data,
    requestedElectionId,
    editing,
    fetching: voterInfoQuery.isFetching,
    failed: voterInfoQuery.isError,
  });
  const unsupportedState =
    !!data &&
    !isCaliforniaState(data.normalizedInput.state) &&
    data.provider?.name !== "democracy_works";
  const election = unsupportedState ? undefined : data?.election;
  const plan = buildVotingPlan(unsupportedState ? undefined : data);
  const phase = electionPhase(election?.electionDay);

  const toggleMethod = (id: VotingMethodId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenMethod((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        const method = plan.methods.find((m) => m.id === id);
        posthog.capture("voting_method_expanded", {
          method: id,
          status: method?.status ?? null,
          location_count: method?.locations.length ?? 0,
        });
      }
      return next;
    });
  };

  if (editing) {
    return (
      <Screen>
        <Card style={s.gapCard}>
          <Kicker>{t("howToVoteLookup.yourAddress")}</Kicker>
          <AddressAutocomplete
            initialValue={address ?? ""}
            onSubmit={(addr) => {
              setAddress(addr);
              setRequestedElectionId(undefined);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
          <Text style={s.fineprint}>{t("howToVoteLookup.lookupOnly")}</Text>
        </Card>
      </Screen>
    );
  }

  if (mismatch) {
    return (
      <Screen>
        <AddressRow address={address} onEdit={() => setEditing(true)} />
        <Card>
          <Text style={s.cardTitle}>{t("howToVoteLookup.mismatchTitle")}</Text>
          <Text style={s.cardBody}>{t("howToVoteLookup.mismatchBody")}</Text>
          <PrimaryButton
            label={t("howToVoteLookup.lookupAgain")}
            onPress={() => setRequestedElectionId(undefined)}
          />
        </Card>
      </Screen>
    );
  }

  // ---- No address -------------------------------------------------------
  if (!addressLoading && !hasAddress) {
    return (
      <Screen>
        <Card style={s.gapCard}>
          <View style={s.emptyIcon}>
            <Icon name="pin" size={20} color={colors.bill} />
          </View>
          <Text style={s.cardTitle}>{t("howToVoteLookup.addTitle")}</Text>
          <Text style={s.cardBody}>{t("howToVoteLookup.addBody")}</Text>
          <PrimaryButton
            label={t("howToVoteLookup.addAddress")}
            onPress={() => setEditing(true)}
            style={s.primaryAction}
          />
          <Text style={s.fineprint}>
            {t("howToVoteLookup.registrationNote")}
          </Text>
        </Card>

        <Card>
          <Kicker>{t("howToVoteLookup.meantime")}</Kicker>
          <Text style={s.cardBody}>{t("howToVoteLookup.nationalSources")}</Text>
          <LinkRow
            label={t("howToVoteLookup.findState")}
            url="https://vote.gov"
          />
        </Card>
      </Screen>
    );
  }

  // ---- Loading ----------------------------------------------------------
  if (addressLoading || voterInfoQuery.isLoading) {
    return (
      <Screen>
        <Card style={s.loadingCard}>
          <ActivityIndicator color={colors.bill} />
          <View style={s.loadingCopy}>
            <Text style={s.loadingTitle}>
              {t("howToVoteLookup.loadingTitle")}
            </Text>
            <Text style={s.loadingSub}>{t("howToVoteLookup.loadingBody")}</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  // ---- Lookup error -----------------------------------------------------
  if (voterInfoQuery.isError) {
    return (
      <Screen>
        <AddressRow address={address} onEdit={() => setEditing(true)} />
        <Card style={s.gapCard}>
          <View style={s.emptyIcon}>
            <Icon name="alert" size={20} color={colors.red[500]} />
          </View>
          <Text style={s.cardTitle}>{t("howToVoteLookup.errorTitle")}</Text>
          <Text style={s.cardBody}>{t("howToVoteLookup.errorBody")}</Text>
          <PrimaryButton
            label={t("common.tryAgain")}
            onPress={() => void voterInfoQuery.refetch()}
            style={s.primaryAction}
          />
        </Card>
        <Card>
          <Kicker>{t("howToVoteLookup.dontWait")}</Kicker>
          <Text style={s.cardBody}>{t("howToVoteLookup.officeAuthority")}</Text>
          <LinkRow
            label={t("howToVoteLookup.findCounty")}
            url="https://vote.gov"
          />
        </Card>
      </Screen>
    );
  }

  // ---- Out of coverage --------------------------------------------------
  if (unsupportedState) {
    return (
      <Screen>
        <AddressRow address={address} onEdit={() => setEditing(true)} />
        <Card style={s.gapCard}>
          <Text style={s.cardTitle}>
            {t("howToVoteLookup.unsupportedTitle")}
          </Text>
          <Text style={s.cardBody}>{t("howToVoteLookup.unsupportedBody")}</Text>
        </Card>
        <SourceFooter />
      </Screen>
    );
  }

  const days = election ? daysUntil(election.electionDay) : 0;
  const source = plan.source;

  return (
    <Screen>
      {/* Which election, and where we're computing it from */}
      {election && (
        <Card style={s.electionCard}>
          <View style={s.dayRow}>
            <Icon
              name="flag"
              size={14}
              color={
                phase === "ended" ? colors.textSecondary : colors.green[500]
              }
            />
            <Text
              style={[
                s.dayText,
                phase === "ended" && { color: colors.textSecondary },
              ]}
            >
              {formatDate(
                election.electionDay,
                { weekday: "short", month: "short", day: "numeric" },
                { calendar: true },
              )}
            </Text>
            <Text style={s.dayCountdown}>
              {phase === "electionDay"
                ? `· ${t("common.today")}`
                : phase === "ended"
                  ? t("howToVoteLookup.datePassed")
                  : t("howToVoteLookup.days", { count: days })}
            </Text>
          </View>
          <Text style={s.electionName}>{election.name}</Text>

          <View style={s.rule} />

          <View style={s.addrRow}>
            <Icon name="pin" size={17} color={colors.bill} />
            <View style={s.addrBody}>
              <Text style={s.addrKicker}>
                {t("howToVoteLookup.registeredAddress")}
              </Text>
              <Text style={s.addrText}>{shortAddress(address ?? "")}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setEditing(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("howToVoteLookup.editAddress")}
            >
              <Text style={s.addrEdit}>{t("common.edit")}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fineprintLeft}>
            {t("howToVoteLookup.addressNote")}
          </Text>

          <View style={s.rule} />

          {/* Context for the address, not a step of its own. Billion holds no
              registration data, so this asks the question the voter has rather
              than announcing what we can't do — and the action always resolves,
              because a prompt with no exit is worse than no prompt. */}
          <FactRow
            icon="help"
            iconColor={colors.bill}
            label={t("howToVoteLookup.registrationQuestion")}
            value={t("howToVoteLookup.registrationBody")}
          />
          <LinkRow
            label={t("howToVoteLookup.checkRegistration")}
            url={registrationCheckUrl(source)}
          />
        </Card>
      )}

      {/* Election Day gets a pinned, unmissable banner. */}
      {phase === "electionDay" && (
        <View style={[s.banner, s.bannerToday]}>
          <Icon name="flag" size={17} color={colors.green[500]} />
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>{t("howToVoteLookup.todayTitle")}</Text>
            <Text style={s.bannerDetail}>{t("howToVoteLookup.todayBody")}</Text>
          </View>
        </View>
      )}

      {phase === "ended" && (
        <View style={[s.banner, s.bannerEnded]}>
          <Icon name="info" size={17} color={colors.bill} />
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>{t("howToVoteLookup.endedTitle")}</Text>
            <Text style={s.bannerDetail}>{t("howToVoteLookup.endedBody")}</Text>
          </View>
        </View>
      )}

      {plan.mailOnly && phase !== "ended" && (
        <View style={[s.banner, s.bannerInfo]}>
          <Icon name="mail" size={17} color={colors.bill} />
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>
              {t("howToVoteLookup.mailOnlyTitle")}
            </Text>
            <Text style={s.bannerDetail}>
              {t("howToVoteLookup.mailOnlyBody")}
            </Text>
          </View>
        </View>
      )}

      {data && <OfficialVotingGuidance data={data} />}

      {/* Ways to vote — the list is the summary; no card restates it. */}
      {phase !== "ended" && (
        <View style={s.methodSection}>
          <Kicker>{t("howToVoteLookup.ways")}</Kicker>
          <View style={s.methodList}>
            {plan.methods.map((method) => (
              <MethodCard
                key={method.id}
                method={method}
                mailOnly={plan.mailOnly}
                expanded={openMethod === method.id}
                onToggle={() => toggleMethod(method.id)}
                locationFinderUrl={
                  source?.votingLocationFinderUrl ?? source?.electionInfoUrl
                }
              />
            ))}
          </View>
        </View>
      )}

      {phase !== "ended" && plan.noLocationsPublished && (
        <Card>
          <Kicker>{t("howToVoteLookup.locations")}</Kicker>
          <UnavailableNote
            title={t("howToVoteLookup.locationsMissing")}
            body={t("howToVoteLookup.locationsMissingBody")}
          />
          <LinkRow
            label={t("howToVoteLookup.findLocations")}
            url={
              source?.votingLocationFinderUrl ??
              source?.electionInfoUrl ??
              "https://vote.gov"
            }
          />
        </Card>
      )}

      {/* Post-election: close the loop the voter was in, don't reset to zero. */}
      {phase === "ended" && (
        <Card>
          <Kicker>{t("howToVoteLookup.next")}</Kicker>
          <Text style={s.cardBody}>{t("howToVoteLookup.nextBody")}</Text>
          <LinkRow
            label={t("howToVoteLookup.ballotStatus")}
            url={source?.electionInfoUrl}
          />
          <LinkRow
            label={t("howToVoteLookup.myBallot")}
            onPress={() => router.push("/(tabs)/elections")}
          />
        </Card>
      )}

      {/* What to bring — one fact plus the authoritative link. */}
      {phase !== "ended" && (
        <Card>
          <Kicker>{t("howToVoteLookup.bring")}</Kicker>
          <FactRow
            icon="info"
            label={t("howToVoteLookup.idTitle")}
            value={t("howToVoteLookup.idBody")}
          />
          <LinkRow
            label={t("howToVoteLookup.idRules")}
            url={source?.electionRulesUrl ?? source?.electionInfoUrl}
          />
        </Card>
      )}

      <SourceFooter source={source} />
    </Screen>
  );
}

/** Address row used by states that render before the election card exists. */
function AddressRow({
  address,
  onEdit,
}: {
  address: string | null;
  onEdit: () => void;
}) {
  const { t } = useAppTranslation();
  if (!address) return null;
  return (
    <View style={s.addrCard}>
      <Icon name="pin" size={17} color={colors.bill} />
      <View style={s.addrBody}>
        <Text style={s.addrKicker}>
          {t("howToVoteLookup.registeredAddress")}
        </Text>
        <Text style={s.addrText}>{shortAddress(address)}</Text>
      </View>
      <TouchableOpacity
        onPress={onEdit}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("howToVoteLookup.editAddress")}
      >
        <Text style={s.addrEdit}>{t("common.edit")}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Shared chrome: nav header, large display title, padded scroll. */
function Screen({ children }: { children: ReactNode }) {
  const { t } = useAppTranslation();
  const router = useRouter();
  return (
    <View style={s.screen}>
      <NavHeader
        title={t("howToVoteLookup.title")}
        onBack={() => router.back()}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.display}>{t("howToVoteLookup.title")}</Text>
        <View style={s.stack}>{children}</View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    color: colors.white,
    marginBottom: 18,
  },
  stack: { gap: 14 },

  electionCard: { borderColor: hair[2] },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  dayText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.green[500],
  },
  dayCountdown: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  electionName: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.white,
    marginTop: 6,
  },
  rule: { height: 1, backgroundColor: hair[2], marginVertical: 14 },

  addrCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  addrBody: { flex: 1, minWidth: 0 },
  addrKicker: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  addrText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.white,
    marginTop: 1,
  },
  addrEdit: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.bill,
  },
  editWrap: { marginTop: 12 },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerToday: {
    backgroundColor: "rgba(16,185,129,0.09)",
    borderColor: "rgba(16,185,129,0.34)",
  },
  bannerInfo: {
    backgroundColor: "rgba(74,124,255,0.08)",
    borderColor: "rgba(74,124,255,0.30)",
  },
  bannerEnded: {
    backgroundColor: planes.slate,
    borderColor: hair[2],
  },
  bannerBody: { flex: 1, minWidth: 0 },
  bannerTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.white,
  },
  bannerDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
    marginTop: 3,
  },

  methodSection: { gap: 0 },
  methodList: { gap: 12 },

  gapCard: { borderColor: hair[2] },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  cardTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
  },
  cardBody: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.82)",
    marginTop: 8,
  },
  primaryAction: { marginTop: 15 },
  fineprint: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 11,
    textAlign: "center",
  },
  fineprintLeft: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 9,
  },

  loadingCard: { flexDirection: "row", alignItems: "center", gap: 13 },
  loadingCopy: { flex: 1, gap: 2 },
  loadingTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.white,
  },
  loadingSub: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
