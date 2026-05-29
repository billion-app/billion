import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, LensStrip, TabScreen } from "~/components/ui";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { daysUntil, monthDay, shiftDays } from "~/utils/dates";

function partyColor(party?: string): string {
  const p = (party ?? "").toLowerCase();
  if (p.startsWith("d")) return "#7BA0FF";
  if (p.startsWith("r")) return "#C9CDDA";
  return colors.textSecondary;
}

function partyInitial(party?: string): string {
  const p = (party ?? "").toLowerCase();
  if (p.startsWith("d")) return "D";
  if (p.startsWith("r")) return "R";
  return "NP";
}

// TODO(backend): default to the signed-in user's registered address. We mock
// one (matching the mocked profile in Sacramento) so the ballot populates by
// default; the user can still edit it.
const MOCK_ADDRESS = "1414 K Street, Sacramento, CA 95814";

export default function ElectionsScreen() {
  const router = useRouter();
  const { address: storedAddress, setAddress } = useUserAddress();
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  // Fall back to the mock address until the user sets their own.
  const address = storedAddress ?? MOCK_ADDRESS;

  const electionsQuery = useQuery(trpc.civic.getElections.queryOptions());
  const upcoming = electionsQuery.data
    ?.filter((e) => daysUntil(e.electionDay) >= 0)
    .sort((a, b) => a.electionDay.localeCompare(b.electionDay))[0];

  const voterInfoQuery = useQuery(
    trpc.civic.getVoterInfo.queryOptions({ address }),
  );

  const contests = voterInfoQuery.data?.contests ?? [];
  const measures = contests.filter((c: Contest) => c.referendumTitle);
  const candidateContests = contests.filter(
    (c: Contest) => c.candidates && c.candidates.length > 0,
  );

  // Key dates derived from the election day.
  // TODO(backend): exact registration / vote-by-mail dates per jurisdiction;
  // these offsets approximate a typical CA timeline.
  const dates = upcoming
    ? [
        {
          d: monthDay(shiftDays(upcoming.electionDay, -15)),
          label: "Voter registration deadline",
          accent: colors.yellow[500],
        },
        {
          d: monthDay(shiftDays(upcoming.electionDay, -8)),
          label: "Vote-by-mail ballots sent",
          accent: colors.textSecondary,
        },
        {
          d: monthDay(upcoming.electionDay),
          label: "Election Day",
          accent: colors.green[500],
          big: true,
        },
      ]
    : [];

  return (
    <TabScreen
      title="Your Ballot"
      contentStyle={{ gap: 24 }}
      headerExtra={
        editing ? (
          <View style={s.lookupCard}>
            <Text style={s.lookupHint}>
              Enter your address to see what&apos;s on your ballot.
            </Text>
            <View style={s.lookupRow}>
              <TextInput
                style={s.lookupInput}
                placeholder="Your registered address"
                placeholderTextColor={colors.textSecondary}
                value={input}
                onChangeText={setInput}
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                autoFocus
              />
              <TouchableOpacity
                style={[s.lookupBtn, !input && s.lookupBtnOff]}
                disabled={!input}
                onPress={() => {
                  if (!input) return;
                  void setAddress(input);
                  setEditing(false);
                }}
              >
                <Text style={s.lookupBtnText}>Look Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.addrCard}>
            <Icon name="pin" size={19} color={colors.bill} />
            <View style={s.addrBody}>
              <Text style={s.addrKicker}>REGISTERED ADDRESS</Text>
              <Text style={s.addrText} numberOfLines={1}>
                {address}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setInput(storedAddress ?? "");
                setEditing(true);
              }}
            >
              <Text style={s.addrEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
        )
      }
    >
      {/* key dates */}
      {dates.length > 0 && (
        <View style={s.section}>
          <Kicker>Key dates</Kicker>
          <View style={s.datesRow}>
            {dates.map((d) => (
              <View
                key={d.label}
                style={[s.dateCard, { borderColor: d.big ? hair[3] : hair[1] }]}
              >
                <Text style={[s.dateBig, { color: d.accent }]}>{d.d}</Text>
                <Text style={s.dateLabel} numberOfLines={2}>
                  {d.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {voterInfoQuery.isLoading && (
        <ActivityIndicator color={colors.bill} style={{ marginVertical: 12 }} />
      )}

      {/* contests */}
      {candidateContests.length > 0 && (
        <View style={s.section}>
          <Kicker>Contests on your ballot</Kicker>
          <View style={{ gap: 14 }}>
            {candidateContests.map((c: Contest, i: number) => (
              <Card key={i}>
                <Text style={s.contestOffice}>{c.office}</Text>
                <View style={{ gap: 10 }}>
                  {c.candidates?.map((cand, j) => (
                    <View key={j} style={s.candRow}>
                      <View style={s.partyTile}>
                        <Text
                          style={[s.partyText, { color: partyColor(cand.party) }]}
                        >
                          {partyInitial(cand.party)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.candName}>{cand.name}</Text>
                        {cand.party ? (
                          <Text style={s.candNote}>{cand.party}</Text>
                        ) : null}
                      </View>
                      <Icon name="chevR" size={16} color="#5B6172" />
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* ballot measures */}
      {measures.length > 0 && (
        <View style={s.section}>
          <Kicker>Ballot measures</Kicker>
          <View style={{ gap: 14 }}>
            {measures.map((m: Contest, i: number) => (
              <Card key={i} style={{ padding: 18 }}>
                <Text style={s.measureTitle}>{m.referendumTitle}</Text>
                {/* TODO(backend): real per-side framing for the measure. */}
                <LensStrip label="A YES vote vs. a NO vote" />
              </Card>
            ))}
          </View>
        </View>
      )}

      {contests.length === 0 && !voterInfoQuery.isLoading && (
        <View style={s.section}>
          <Card>
            <Text style={s.empty}>
              No ballot information for this address yet. Tap Edit above to try a
              different registered address.
            </Text>
          </Card>
        </View>
      )}

      {/* polling place exit */}
      <View style={s.section}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/local-elections")}
        >
          <Card style={s.pollRow}>
            <View style={s.pollIcon}>
              <Icon name="pin" size={22} color={colors.green[500]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pollTitle}>Find your polling place</Text>
              <Text style={s.pollSub}>Verified on vote.gov</Text>
            </View>
            <Icon name="external" size={18} color={colors.textSecondary} />
          </Card>
        </TouchableOpacity>
      </View>
    </TabScreen>
  );
}

const s = StyleSheet.create({
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
    marginTop: 12,
  },
  addrBody: { flex: 1, minWidth: 0 },
  addrKicker: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  addrText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
    marginTop: 1,
  },
  addrEdit: { fontFamily: fontBody.semibold, fontSize: 13, color: colors.bill },
  lookupCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  lookupHint: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  lookupRow: { flexDirection: "row", gap: 10 },
  lookupInput: {
    flex: 1,
    height: 48,
    backgroundColor: planes.navy,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.white,
    fontFamily: "AlbertSans-Regular",
    fontSize: 15,
  },
  lookupBtn: {
    backgroundColor: colors.white,
    borderRadius: 9999,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  lookupBtnOff: { opacity: 0.5 },
  lookupBtnText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: planes.ink,
  },
  section: { paddingHorizontal: 20 },
  datesRow: { flexDirection: "row", gap: 10 },
  dateCard: {
    flex: 1,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  dateBig: { fontFamily: "InriaSerif-Bold", fontSize: 17 },
  dateLabel: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 5,
    textAlign: "center",
    lineHeight: 14,
  },
  contestOffice: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 16,
    color: colors.white,
    marginBottom: 12,
  },
  candRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  partyTile: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  partyText: { fontFamily: fontBody.bold, fontSize: 12 },
  candName: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  candNote: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  measureTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 17,
    color: colors.white,
    marginBottom: 12,
  },
  empty: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  pollRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  pollIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pollTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  pollSub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
