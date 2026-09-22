/**
 * How to Vote — the voting-logistics screen.
 *
 * Answers one question: what do I need to do to successfully cast my ballot?
 * Deliberately NOT a second ballot screen — candidates and measures stay on the
 * Elections tab. This screen only covers methods, locations, and hand-offs to
 * the responsible election authority.
 *
 * Trust posture: everything rendered here is either data an official source
 * returned or generic ballot-handling instruction. Billion has no sourced
 * deadline feed yet, so deadline slots render their "not available" variant
 * rather than a date computed from the election day. See `~/utils/voting`.
 */
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
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
import { posthog } from "~/config/posthog";
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
import { daysUntil, formatDate } from "~/utils/dates";
import {
  buildVotingPlan,
  electionPhase,
  registrationCheckUrl,
  shortAddress,
} from "~/utils/voting";

export const ErrorBoundary = createRouteErrorBoundary("how-to-vote");

export default function HowToVoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string }>();
  const { address, setAddress, isLoading: addressLoading } = useUserAddress();
  const [editing, setEditing] = useState(false);
  const [openMethod, setOpenMethod] = useState<VotingMethodId | null>(
    (params.method as VotingMethodId | undefined) ?? null,
  );

  const hasAddress = !!address;

  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: hasAddress,
    retry: 1,
  });

  const data = voterInfoQuery.data;
  const unsupportedState = !!data && data.normalizedInput.state !== "CA";
  const election = unsupportedState ? undefined : data?.election;
  const plan = buildVotingPlan(unsupportedState ? undefined : data);
  const phase = electionPhase(election?.electionDay);

  const toggleMethod = useCallback(
    (id: VotingMethodId) => {
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
    },
    [plan.methods],
  );

  // ---- No address -------------------------------------------------------
  if (!addressLoading && !hasAddress) {
    return (
      <Screen>
        {editing ? (
          <Card style={s.gapCard}>
            <Kicker>YOUR REGISTERED ADDRESS</Kicker>
            <AddressAutocomplete
              initialValue=""
              onSubmit={(addr) => {
                void setAddress(addr);
                setEditing(false);
                posthog.capture("voter_address_set", { is_update: false });
              }}
            />
          </Card>
        ) : (
          <Card style={s.gapCard}>
            <View style={s.emptyIcon}>
              <Icon name="pin" size={20} color={colors.bill} />
            </View>
            <Text style={s.cardTitle}>Add your registered address</Text>
            <Text style={s.cardBody}>
              Voting rules, deadlines, and locations are set county by county.
              Billion needs the address you&apos;re registered at to show the
              right ones.
            </Text>
            <PrimaryButton
              label="Add address"
              onPress={() => setEditing(true)}
              style={s.primaryAction}
            />
            <Text style={s.fineprint}>
              Stored on your device and used only for election lookups.
            </Text>
          </Card>
        )}
        <Card>
          <Kicker>IN THE MEANTIME</Kicker>
          <Text style={s.cardBody}>
            These sources work for any address in the United States.
          </Text>
          <LinkRow
            label="Find my state election office"
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
            <Text style={s.loadingTitle}>Checking how you can vote</Text>
            <Text style={s.loadingSub}>Looking up this address&hellip;</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  // ---- Lookup error -----------------------------------------------------
  if (voterInfoQuery.isError) {
    return (
      <Screen>
        <Card style={s.gapCard}>
          <View style={s.emptyIcon}>
            <Icon name="alert" size={20} color={colors.red[500]} />
          </View>
          <Text style={s.cardTitle}>
            We couldn&apos;t load your voting options
          </Text>
          <Text style={s.cardBody}>
            The election lookup didn&apos;t respond. Your address is saved —
            this is on our side.
          </Text>
          <PrimaryButton
            label="Try again"
            onPress={() => void voterInfoQuery.refetch()}
            style={s.primaryAction}
          />
        </Card>
        <Card>
          <Kicker>DON&apos;T WAIT ON US</Kicker>
          <Text style={s.cardBody}>
            Your county election office has the same information and is always
            authoritative.
          </Text>
          <LinkRow
            label="Find my county election office"
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
            Billion doesn&apos;t cover this state yet
          </Text>
          <Text style={s.cardBody}>
            We only have California voting information right now. Your state
            election office has everything you need for this election.
          </Text>
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
              {formatDate(election.electionDay)}
            </Text>
            <Text style={s.dayCountdown}>
              {phase === "electionDay"
                ? "· Today"
                : phase === "ended"
                  ? "· Voting has closed"
                  : `· ${days} day${days === 1 ? "" : "s"} away`}
            </Text>
          </View>
          <Text style={s.electionName}>{election.name}</Text>

          <View style={s.rule} />

          <View style={s.addrRow}>
            <Icon name="pin" size={17} color={colors.bill} />
            <View style={s.addrBody}>
              <Text style={s.addrKicker}>REGISTERED ADDRESS</Text>
              <Text style={s.addrText} numberOfLines={1}>
                {shortAddress(address ?? "")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setEditing((v) => !v)}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text style={s.addrEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fineprintLeft}>
            Used only to look up your ballot and voting locations.
          </Text>

          {editing && (
            <View style={s.editWrap}>
              <AddressAutocomplete
                initialValue={address ?? ""}
                onSubmit={(addr) => {
                  void setAddress(addr);
                  setEditing(false);
                  posthog.capture("voter_address_set", { is_update: true });
                }}
              />
            </View>
          )}

          <View style={s.rule} />

          {/* Context for the address, not a step of its own. Billion holds no
              registration data, so this asks the question the voter has rather
              than announcing what we can't do — and the action always resolves,
              because a prompt with no exit is worse than no prompt. */}
          <FactRow
            icon="help"
            iconColor={colors.bill}
            label="Not sure if you're registered?"
            value="Billion can't check for you — your state can, in about a minute."
          />
          <LinkRow
            label="Check my registration status"
            url={registrationCheckUrl(source)}
          />
        </Card>
      )}

      {/* Election Day gets a pinned, unmissable banner. */}
      {phase === "electionDay" && (
        <View style={[s.banner, s.bannerToday]}>
          <Icon name="flag" size={17} color={colors.green[500]} />
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>Today is Election Day</Text>
            <Text style={s.bannerDetail}>
              If you&apos;re in line when polls close, stay in line — you may
              still vote.
            </Text>
          </View>
        </View>
      )}

      {phase === "ended" && (
        <View style={[s.banner, s.bannerEnded]}>
          <Icon name="info" size={17} color={colors.bill} />
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>This election has ended</Text>
            <Text style={s.bannerDetail}>
              Counting continues for several weeks after Election Day.
            </Text>
          </View>
        </View>
      )}

      {plan.mailOnly && phase !== "ended" && (
        <View style={[s.banner, s.bannerInfo]}>
          <Icon name="mail" size={17} color={colors.bill} />
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>This is an all-mail election</Text>
            <Text style={s.bannerDetail}>
              Every registered voter is mailed a ballot and returns it by mail
              or drop box.
            </Text>
          </View>
        </View>
      )}

      {/* Ways to vote — the list is the summary; no card restates it. */}
      {phase !== "ended" && (
        <View style={s.methodSection}>
          <Kicker>WAYS TO VOTE</Kicker>
          <View style={s.methodList}>
            {plan.methods.map((method) => (
              <MethodCard
                key={method.id}
                method={method}
                expanded={openMethod === method.id}
                onToggle={() => toggleMethod(method.id)}
                authorityName={source?.name}
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
          <Kicker>VOTING LOCATIONS</Kicker>
          <UnavailableNote
            title="Locations aren't published yet"
            body="Counties usually post vote centers and drop boxes closer to Election Day. Billion refreshes this daily."
          />
        </Card>
      )}

      {/* Post-election: close the loop the voter was in, don't reset to zero. */}
      {phase === "ended" && (
        <Card>
          <Kicker>WHAT HAPPENS NOW</Kicker>
          <Text style={s.cardBody}>
            Ballots that met your county&apos;s return deadline are still being
            counted. Your county election office can confirm whether yours was
            accepted.
          </Text>
          <LinkRow
            label="Check my ballot status"
            url={source?.electionInfoUrl}
          />
          <LinkRow
            label="See what was on my ballot"
            onPress={() => router.push("/(tabs)/elections")}
          />
        </Card>
      )}

      {/* What to bring — one fact plus the authoritative link. */}
      {phase !== "ended" && (
        <Card>
          <Kicker>WHAT TO BRING</Kicker>
          <FactRow
            icon="info"
            label="ID rules depend on where you're registered"
            value="Billion doesn't publish ID requirements — read them from your election office so you get the current rule."
          />
          <LinkRow
            label="Read the ID rules"
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
  if (!address) return null;
  return (
    <View style={s.addrCard}>
      <Icon name="pin" size={17} color={colors.bill} />
      <View style={s.addrBody}>
        <Text style={s.addrKicker}>REGISTERED ADDRESS</Text>
        <Text style={s.addrText} numberOfLines={1}>
          {shortAddress(address)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onEdit}
        hitSlop={12}
        accessibilityRole="button"
      >
        <Text style={s.addrEdit}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Shared chrome: nav header, large display title, padded scroll. */
function Screen({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <View style={s.screen}>
      <NavHeader title="How to Vote" onBack={() => router.back()} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.display}>How to Vote</Text>
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
