import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { IconName } from "~/components/ui/Icon";
import type { VotingLogisticsData } from "~/utils/voting-logistics";
import type { PlanMethod } from "~/utils/voting-plan";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card, Icon, Segmented } from "~/components/ui";
import { colors, fontBody, fontEditorial, hair, planes, sp } from "~/styles";
import { votingInformationLinks } from "~/utils/voting-logistics";
import {
  hasVotingPlanLogistics,
  planStorageKey,
  readPlanMethod,
  registrationCheck,
  votingPlanAction,
} from "~/utils/voting-plan";

const ca = "https://www.sos.ca.gov/elections";

function Cue({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Icon name={name} size={size} color={colors.bill} />
    </View>
  );
}

/** Compact evidence actions, scoped to the plan rather than changing shared UI. */
function SourceLink({ label, url }: { label: string; url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={s.serviceLink}
        onPress={() => {
          void Linking.openURL(url).then(
            () => setFailed(false),
            () => setFailed(true),
          );
        }}
      >
        <Text style={[s.action, s.flex, { color: colors.white }]}>{label}</Text>
        <Cue name="external" size={14} />
      </Pressable>
      {failed && (
        <Text
          accessibilityRole="alert"
          style={[s.caption, { color: colors.white }]}
        >
          Could not open the link. Tap to retry.
        </Text>
      )}
    </View>
  );
}

function StepHeading({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={s.stepIcon}>
        <Cue name={icon} />
      </View>
      <Text
        accessibilityRole="header"
        style={[s.heading, s.flex, { color: colors.white }]}
      >
        {children}
      </Text>
    </View>
  );
}

function Deadline({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={s.deadline}>
      <View style={s.deadlineIcon}>
        <Cue name={icon} />
      </View>
      <View style={s.flex}>
        <Text style={[s.action, { color: colors.white }]}>{label}</Text>
        <Text style={[s.body, { color: colors.white }]}>{children}</Text>
      </View>
    </View>
  );
}

function Detail({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={s.disclosure}
      >
        {icon && <Cue name={icon} />}
        <Text style={[s.action, s.flex, { color: colors.white }]}>{label}</Text>
        <Icon name={open ? "chevD" : "chevR"} size={16} color={colors.white} />
      </Pressable>
      {open && <View style={s.details}>{children}</View>}
    </View>
  );
}

/** The provider has no election-type metadata: primary help is optional, never inferred from a name/date. */
export function VotingPlanSection({
  election,
  data,
  california = false,
  returnLabel = "Hide voting steps",
  onReturn,
  onViewLogistics,
  initiallyOpen = false,
}: {
  election?: {
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  };
  data?: VotingLogisticsData;
  california?: boolean;
  returnLabel?: string;
  onReturn?: () => void;
  onViewLogistics?: () => void;
  initiallyOpen?: boolean;
}) {
  const key = election ? planStorageKey(election) : undefined;
  return (
    <Plan
      key={key ?? "unknown"}
      storageKey={key}
      data={data}
      california={california}
      returnLabel={returnLabel}
      onReturn={onReturn}
      onViewLogistics={onViewLogistics}
      initiallyOpen={initiallyOpen}
    />
  );
}

function Plan({
  storageKey,
  data,
  california,
  returnLabel,
  onReturn,
  onViewLogistics,
  initiallyOpen,
}: {
  storageKey?: string;
  data?: VotingLogisticsData;
  california: boolean;
  returnLabel: string;
  onReturn?: () => void;
  onViewLogistics?: () => void;
  initiallyOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  const [method, setMethod] = useState<PlanMethod>("undecided");
  const [loaded, setLoaded] = useState(!storageKey);
  const [storageFailed, setStorageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastWrite = useRef(0);
  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    void AsyncStorage.getItem(storageKey).then(
      (raw) => {
        if (active) {
          setMethod(readPlanMethod(raw));
          setLoaded(true);
        }
      },
      () => {
        if (active) {
          setLoaded(true);
          setStorageFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [storageKey]);
  const writeQueue = useRef(Promise.resolve());
  function choose(value: PlanMethod) {
    setMethod(value);
    if (!storageKey) return;
    setSaving(true);
    const version = ++lastWrite.current;
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(storageKey, value))
      .then(
        () => {
          if (version === lastWrite.current) {
            setStorageFailed(false);
            setSaving(false);
          }
        },
        () => {
          if (version === lastWrite.current) {
            setStorageFailed(true);
            setSaving(false);
          }
        },
      );
  }
  const body = [s.body, { color: colors.white }];
  const heading = [s.heading, { color: colors.white }];
  const caption = [s.caption, { color: colors.textSecondary }];
  const check =
    registrationCheck(data) ??
    (california
      ? {
          name: "California Secretary of State",
          url: "https://voterstatus.sos.ca.gov/EN/Authenticate",
        }
      : undefined);
  const fallback = votingPlanAction(data, "electionInfoUrl") ?? {
    name: california
      ? "California county elections offices"
      : "USA.gov · State election offices",
    url: california
      ? `${ca}/voting-resources/county-elections-offices`
      : "https://www.usa.gov/state-election-office",
  };
  const suppliedMethod =
    method === "mail"
      ? votingPlanAction(data, "absenteeVotingInfoUrl")
      : method === "in-person"
        ? votingPlanAction(data, "votingLocationFinderUrl")
        : undefined;
  const methodAction =
    suppliedMethod ??
    (california && method !== "in-person"
      ? {
          name: "California Secretary of State",
          url: `${ca}/voting-resources/voting-california`,
        }
      : fallback);
  const officeAction = methodAction.url === fallback.url && !suppliedMethod;
  const actionLabel = officeAction
    ? california
      ? "Find my county election office"
      : "Visit your election office"
    : method === "mail"
      ? "See mail voting instructions"
      : method === "in-person"
        ? "Find voting locations"
        : "Compare ways to vote";
  const actionContext =
    method === "mail"
      ? "Confirm mail voting and return instructions"
      : method === "in-person"
        ? "Ask about voting locations and hours"
        : "Confirm available methods for your election";
  const resources = votingInformationLinks(data ?? {});
  return (
    <Card
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: hair[1],
        padding: 16,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Make your voting plan"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.open}
      >
        <Text style={heading}>Make your voting plan</Text>
        <View style={s.row}>
          <Text style={[...caption, s.flex]}>
            {expanded ? "Hide plan" : "Check registration. Choose how to vote."}
          </Text>
          <Icon
            name={expanded ? "chevD" : "chevR"}
            size={16}
            color={colors.white}
          />
        </View>
      </Pressable>
      {expanded && (
        <View style={s.steps}>
          {!storageKey && (
            <Text style={body}>
              Election details aren’t available. You can still use these voting
              services.
            </Text>
          )}
          <View style={s.step}>
            <StepHeading icon="user">1. Check registration</StepHeading>
            {check ? (
              <>
                <SourceLink label="Check registration" url={check.url} />
                <Text style={caption}>
                  {check.name} · Opens registration service
                </Text>
              </>
            ) : (
              <>
                <SourceLink
                  label="Find your election office"
                  url={fallback.url}
                />
                <Text style={caption}>{fallback.name}</Text>
                <Text style={caption}>
                  For registration and available voting methods
                </Text>
              </>
            )}
            {california && (
              <Detail label="Need to register or update details?">
                <SourceLink
                  label="Registration application & requirements"
                  url={`${ca}/voter-registration`}
                />
                <Text style={caption}>California Secretary of State</Text>
              </Detail>
            )}
          </View>
          <View style={s.step}>
            <StepHeading icon="vote">
              2. How would you like to vote?
            </StepHeading>
            {loaded ? (
              <Segmented<PlanMethod>
                iconPosition="above"
                value={method}
                onChange={choose}
                options={[
                  { id: "undecided", label: "Unsure", icon: "help" },
                  { id: "mail", label: "By mail", icon: "mail" },
                  { id: "in-person", label: "In person", icon: "pin" },
                ]}
              />
            ) : (
              <Text style={body}>Loading your choice…</Text>
            )}
            {(storageFailed ||
              !storageKey ||
              saving ||
              method !== "undecided") && (
              <View style={s.row}>
                <Cue name={storageFailed ? "info" : "lock"} size={14} />
                <Text
                  accessibilityLiveRegion="polite"
                  style={[...caption, s.flex]}
                >
                  {storageFailed
                    ? "Couldn’t save. Your choice may be lost when you leave."
                    : !storageKey
                      ? "This choice is temporary while election details are unavailable."
                      : saving
                        ? "Saving…"
                        : "Saved on this device"}
                </Text>
              </View>
            )}
            {!check && officeAction ? (
              <Text style={caption}>
                {method === "mail"
                  ? "Ask the office above about ballot requests and returns."
                  : method === "in-person"
                    ? "Ask the office above about locations and hours."
                    : "The office above can explain your voting options."}
              </Text>
            ) : (
              <>
                <SourceLink label={actionLabel} url={methodAction.url} />
                <Text style={caption}>{methodAction.name}</Text>
                <Text style={caption}>{actionContext}</Text>
              </>
            )}
            {data && hasVotingPlanLogistics(data) && onViewLogistics && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View voting dates and locations"
                onPress={onViewLogistics}
                style={s.disclosure}
              >
                <Text style={[s.action, s.flex, { color: colors.white }]}>
                  View dates & locations
                </Text>
                <Icon name="chevR" size={16} color={colors.white} />
              </Pressable>
            )}
            {method === "mail" && (
              <Detail label="Mail deadlines & tracking" icon="clock">
                <Text style={body}>
                  Check these separately with your election office:
                </Text>
                <Deadline icon="doc" label="Request">
                  Check if you need to request a ballot, and by when.
                </Deadline>
                <Deadline icon="clock" label="Postmark">
                  When the postal service must mark your return envelope.
                </Deadline>
                <Deadline icon="home" label="Receipt">
                  When the election office must receive your ballot.
                </Deadline>
                {california && (
                  <SourceLink
                    label="Track my ballot"
                    url={`${ca}/ballot-status/wheres-my-ballot`}
                  />
                )}
                {california && (
                  <Text style={caption}>
                    California Secretary of State · Opens its tracking service
                  </Text>
                )}
              </Detail>
            )}
            {method === "in-person" && (
              <Detail label="Before you go" icon="pin">
                <Text style={body}>
                  Confirm the location, early-voting dates or Election Day
                  hours, and what to bring. Missing location details here don’t
                  mean in-person voting is unavailable.
                </Text>
                {california && (
                  <SourceLink
                    label="Voting requirements"
                    url={`${ca}/voting-resources/voting-california`}
                  />
                )}
              </Detail>
            )}
          </View>
          <Detail label="More voting help & privacy" icon="help">
            <Detail label="Voting in a primary?">
              <Text style={body}>
                Check which contests you can vote in, whether party enrollment
                matters, and whether to request a different ballot. Confirm
                party enrollment and ballot request deadlines separately.
              </Text>
              <SourceLink
                label="Check primary voting rules"
                url={
                  california
                    ? `${ca}/primary-elections-california`
                    : fallback.url
                }
              />
              <Text style={caption}>
                {california ? "California Secretary of State" : fallback.name}
              </Text>
            </Detail>
            <Text style={heading}>Official confirmation</Text>
            <Text style={body}>
              Billion doesn’t verify registration, eligibility or ballot status.
              Links open the authority’s service; return here to continue your
              ballot.
            </Text>
            <Text style={heading}>On this device</Text>
            <Text style={body}>
              {storageKey
                ? "Only your method preference is saved, for this election."
                : "Your temporary choice isn’t saved while election details are unavailable."}{" "}
              No address, party or registration status is stored in this plan.
            </Text>
            <Text style={heading}>Dates and locations</Text>
            <Text style={body}>
              Ask your election office about details missing here. A missing
              location listing doesn’t mean voting is unavailable.
            </Text>
            {resources.map((link) => (
              <View key={link.url}>
                <SourceLink label={link.label} url={link.url} />
                <Text style={caption}>{link.office}</Text>
              </View>
            ))}
          </Detail>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={returnLabel}
            onPress={() => {
              setExpanded(false);
              onReturn?.();
            }}
            style={s.return}
          >
            <Text style={[s.caption, s.flex, { color: colors.white }]}>
              {returnLabel}
            </Text>
            <Icon name="chevL" size={14} color={colors.white} />
          </Pressable>
        </View>
      )}
    </Card>
  );
}
const s = StyleSheet.create({
  serviceLink: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hair[2],
    backgroundColor: planes.surface,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${colors.bill}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  deadlineIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deadline: {
    flexDirection: "row",
    gap: sp[2],
    paddingVertical: sp[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[2],
  },
  open: { minHeight: 48, gap: sp[2], paddingVertical: sp[2] },
  steps: { gap: sp[3], paddingTop: sp[3] },
  step: { gap: sp[2] },
  row: { flexDirection: "row", alignItems: "center", gap: sp[2] },
  disclosure: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
    paddingVertical: sp[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hair[2],
  },
  return: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
  },
  details: { gap: sp[2], paddingBottom: sp[3] },
  flex: { flex: 1 },
  action: { fontFamily: fontBody.semibold, fontSize: 15, lineHeight: 22 },
  heading: { fontFamily: fontEditorial.bold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fontBody.regular, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: fontBody.regular, fontSize: 12.5, lineHeight: 18 },
});
