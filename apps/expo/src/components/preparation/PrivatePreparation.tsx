import type { TextProps } from "react-native";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Contest, Election } from "@acme/api";

import type { Preparation, Progress } from "~/utils/preparation";
import { BallotText as BaseText } from "~/components/ballot-evidence/BallotText";
import { Icon } from "~/components/ui/Icon";
import { Card } from "~/components/ui/layout";
import {
  colors,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
  sp,
} from "~/styles";
import {
  contestSnapshot,
  createPreparationStore,
  electionKey,
} from "~/utils/preparation";

function Text({ style, ...props }: TextProps) {
  return (
    <BaseText
      {...props}
      style={[
        s.body,
        { color: P.inkOnNight, fontFamily: fontBody.regular },
        style,
      ]}
    />
  );
}

const store = createPreparationStore(AsyncStorage);
export function PrivatePreparation({
  election,
  provider,
  lookupScope,
  contests = [],
  initiallyOpen = false,
  onOpenBallot,
  showElectionContext = true,
}: {
  election?: Election;
  provider: string;
  /** Exact lookup input stays local; never bind preparation across addresses. */
  lookupScope?: string;
  contests?: Contest[];
  initiallyOpen?: boolean;
  onOpenBallot?: () => void;
  showElectionContext?: boolean;
}) {
  const identity =
    election && lookupScope
      ? electionKey(election, provider, lookupScope)
      : undefined;
  const [items, setItems] = useState<Preparation[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState<{
    action: () => Promise<Preparation[]>;
    closeDraft: boolean;
    kind: "save" | "update";
  }>();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [draft, setDraft] = useState<Preparation>();
  useEffect(() => {
    let active = true;
    let changed = false;
    const unsubscribe = store.subscribe((value, removed, reset) => {
      changed = true;
      setItems(value);
      setReady(true);
      setError(false);
      const deleted = (item: Preparation) =>
        reset ||
        removed.some(
          (old) =>
            old.election === item.election && old.snapshot === item.snapshot,
        );
      setDraft((current) =>
        current && deleted(current) ? undefined : current,
      );
    });
    setReady(false);
    setError(false);
    setRetry(undefined);
    setDraft(undefined);
    void store.read().then(
      (value) => {
        if (active && !changed) {
          setItems(value);
          setReady(true);
          setError(false);
        }
      },
      () => {
        if (active && !changed) setError(true);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [identity]);
  async function commit(
    action: () => Promise<Preparation[]>,
    closeDraft = true,
    kind: "save" | "update" = "update",
  ) {
    setBusy(true);
    try {
      setItems(await action());
      if (closeDraft) {
        setDraft(undefined);
      }
      setError(false);
      setRetry(undefined);
      setReady(true);
    } catch {
      setRetry({ action, closeDraft, kind });
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const button = (
    label: string,
    action: () => void,
    selected = false,
    disabled = false,
    primary = false,
  ) => (
    <Pressable
      {...{ "ph-no-capture": true }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={action}
      style={{
        paddingVertical: 12,
        paddingHorizontal: primary ? 16 : 4,
        minHeight: 44,
        backgroundColor: primary ? planes.surface : undefined,
        borderWidth: primary ? 1 : 0,
        borderColor: hair[2],
        alignSelf: primary ? "flex-start" : undefined,
        borderRadius: 999,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      <Text
        style={[
          s.action,
          {
            color: P.inkOnNight,
            fontFamily: fontBody.semibold,
          },
        ]}
      >
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
  const closeEditor = () => {
    if (busy) return;
    setDraft(undefined);
    setRetry(undefined);
    setError(false);
  };
  const current = items.filter((p) => p.election === identity);
  const stale = current.filter(
    (p) => !contests.some((c) => contestSnapshot(c) === p.snapshot),
  );
  const selectedContest = draft
    ? contests.find((c) => contestSnapshot(c) === draft.snapshot)
    : undefined;
  const status = (progress: Progress) =>
    ({ undecided: "To read", reviewed: "Read", skipped: "Skipped" })[progress];
  const readingBadge = (progress: Progress) => (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 6,
        paddingVertical: 2,
      }}
    >
      <View
        accessible={false}
        aria-hidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon
          name={
            progress === "reviewed"
              ? "book"
              : progress === "skipped"
                ? "minus"
                : "clock"
          }
          size={14}
          color={colors.textSecondary}
        />
      </View>
      <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
        {status(progress)}
      </Text>
    </View>
  );
  const matched = contests.map((contest) => {
    const snapshot = contestSnapshot(contest);
    return contests.filter((other) => contestSnapshot(other) === snapshot)
      .length === 1
      ? current.find((item) => item.snapshot === snapshot)
      : undefined;
  });
  const readCount = matched.filter(
    (item) => item?.progress === "reviewed",
  ).length;
  const skipCount = matched.filter(
    (item) => item?.progress === "skipped",
  ).length;
  const date = (value: string) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });
  };
  const record = (item: Preparation, previous = false) => (
    <View
      key={`${item.election}${item.snapshot}`}
      style={{
        borderWidth: 1,
        borderColor: hair[1],
        borderRadius: 14,
        padding: sp[4],
        gap: sp[2],
      }}
    >
      <Text style={s.heading}>{item.title}</Text>
      {item.choice && <Text>Possible choice: {item.choice}</Text>}
      {!!item.notes && <Text>{item.notes}</Text>}
      <Text style={{ color: P.quiet }}>
        {item.electionName} · {date(item.electionDay)}
      </Text>
      {previous && <Text style={{ color: P.quiet }}>Previous ballot</Text>}
      {readingBadge(item.progress)}
      {button(
        "Delete note",
        () => void commit(() => store.remove(item), false),
      )}
    </View>
  );
  const content = (
    <Card {...{ "ph-no-capture": true }} style={s.card}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: sp[2],
        }}
      >
        <Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>
          {draft
            ? draft.title
            : election
              ? "Your ballot notes"
              : "Your saved notes"}
        </Text>
        {!draft &&
          election &&
          button(open ? "Hide" : "Open", () => setOpen(!open))}
      </View>
      {open && (
        <>
          {election && (draft !== undefined || showElectionContext) && (
            <Text style={{ color: P.inkOnNight }}>
              {election.name} · {date(election.electionDay)}
            </Text>
          )}
          {error && (
            <View style={{ gap: sp[2] }}>
              <Text accessibilityLiveRegion="polite">
                {!ready
                  ? "Your saved notes couldn’t be opened. Try again to load them."
                  : draft
                    ? "We couldn’t save your changes. Your edit is still here."
                    : "We couldn’t update your saved notes. Try again."}
              </Text>
              {button(
                "Retry",
                () =>
                  void commit(
                    retry?.kind === "save" && draft
                      ? () => store.save(draft)
                      : (retry?.action ?? (() => store.read())),
                    retry?.closeDraft ?? false,
                    retry?.kind,
                  ),
                false,
                false,
                true,
              )}
            </View>
          )}
          {!ready && !error && <Text>Loading your notes…</Text>}
          {draft ? (
            <View style={{ gap: sp[4] }}>
              <Text>Reading status</Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Reading status"
                style={s.statusOptions}
              >
                {(["undecided", "reviewed", "skipped"] as const).map(
                  (progress) => (
                    <Pressable
                      key={progress}
                      accessibilityRole="radio"
                      accessibilityLabel={status(progress)}
                      aria-checked={draft.progress === progress}
                      accessibilityState={{
                        checked: draft.progress === progress,
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() => setDraft({ ...draft, progress })}
                      style={[
                        s.statusOption,
                        draft.progress === progress && s.statusSelected,
                      ]}
                    >
                      <Text style={s.action}>
                        {draft.progress === progress ? "✓ " : ""}
                        {status(progress)}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              {!selectedContest?.referendumTitle && (
                <View>
                  {button(
                    `${choiceOpen ? "Possible choice (optional)" : draft.choice ? `Possible choice: ${draft.choice}` : "Add a possible choice (optional)"} ${choiceOpen ? "−" : "+"}`,
                    () => setChoiceOpen(!choiceOpen),
                  )}
                  {choiceOpen && (
                    <View style={{ gap: sp[2] }}>
                      {selectedContest?.referendumTitle ? (
                        <Text>
                          Write your possible measure choice in notes. Marking
                          options haven’t been supplied for this measure.
                        </Text>
                      ) : (
                        [
                          undefined,
                          ...(selectedContest?.candidates ?? []).map(
                            (candidate) => candidate.name,
                          ),
                        ].map((name, index) => {
                          const candidates = selectedContest?.candidates ?? [];
                          const withdrawn =
                            name !== undefined &&
                            candidates[index - 1]?.ballotStatus ===
                              "withdrewStillOnBallot";
                          const disabled =
                            busy ||
                            withdrawn ||
                            (name !== undefined &&
                              candidates.filter(
                                (candidate) => candidate.name === name,
                              ).length > 1);
                          const selected = draft.choice === name;
                          return (
                            <Pressable
                              key={index}
                              accessibilityRole="radio"
                              aria-checked={selected}
                              accessibilityState={{
                                checked: selected,
                                disabled,
                              }}
                              disabled={disabled}
                              onPress={() =>
                                setDraft({ ...draft, choice: name })
                              }
                              style={{
                                minHeight: 48,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: selected ? P.quiet : hair[1],
                                borderRadius: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                opacity: disabled ? 0.5 : 1,
                              }}
                            >
                              <View
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 10,
                                  borderWidth: 2,
                                  borderColor: selected
                                    ? P.quiet
                                    : P.inkOnNight,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {selected && (
                                  <View
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: 5,
                                      backgroundColor: P.quiet,
                                    }}
                                  />
                                )}
                              </View>
                              <Text style={{ flex: 1 }}>
                                {name ?? "No choice yet"}
                                {withdrawn ? " · Withdrawn" : ""}
                              </Text>
                            </Pressable>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              )}
              <Text>Notes</Text>
              {selectedContest?.referendumTitle && (
                <Text>You can write your possible measure choice here.</Text>
              )}
              <TextInput
                {...{ "ph-no-capture": true }}
                accessibilityLabel="Private notes"
                placeholder="What do you want to remember?"
                placeholderTextColor={colors.textSecondary}
                multiline
                editable={!busy}
                maxLength={1000}
                value={draft.notes}
                onChangeText={(notes) => setDraft({ ...draft, notes })}
                style={{
                  color: P.inkOnNight,
                  fontFamily: fontBody.regular,
                  fontSize: 16,
                  padding: 12,
                  minHeight: 120,
                  backgroundColor: planes.surface,
                  borderWidth: 1,
                  borderColor: hair[1],
                  borderRadius: 10,
                }}
              />
              {button(
                busy ? "Saving…" : "Save",
                () => void commit(() => store.save(draft), true, "save"),
                false,
                !selectedContest,
                true,
              )}
              {button("Cancel", closeEditor)}
              {current.some((item) => item.snapshot === draft.snapshot) &&
                button(
                  "Delete this note",
                  () => void commit(() => store.remove(draft)),
                )}
            </View>
          ) : (
            <>
              {ready && election && !lookupScope && (
                <Text>
                  Notes are unavailable for this ballot. We need enough
                  information to match them to the right election and ballot.
                </Text>
              )}
              {ready && election && lookupScope && (
                <>
                  {!matched.some(Boolean) && (
                    <Text>
                      {!contests.length
                        ? "No races or measures are available for this ballot yet. Check the ballot’s source or try the lookup again."
                        : current.length
                          ? "Pick an item to review or update your notes."
                          : "Choose a race or measure to add notes."}
                    </Text>
                  )}
                  {!!contests.length && matched.some(Boolean) && (
                    <View
                      accessibilityLabel={`Reading progress: ${readCount} of ${contests.length} read, ${skipCount} skipped`}
                      accessible
                      style={{ gap: sp[2] }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          aria-hidden={true}
                          accessible={false}
                          importantForAccessibility="no-hide-descendants"
                        >
                          <Icon name="book" size={18} color={P.quiet} />
                        </View>
                        <Text>
                          {readCount} of {contests.length} read
                          {skipCount ? ` · ${skipCount} skipped` : ""}
                        </Text>
                      </View>
                      <View
                        accessible={false}
                        style={{
                          height: 3,
                          backgroundColor: P.canvas,
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: 3,
                            width: `${(100 * readCount) / contests.length}%`,
                            backgroundColor: P.quiet,
                          }}
                        />
                      </View>
                    </View>
                  )}
                  {[...contests]
                    .sort(
                      (a, b) =>
                        Number(
                          current.some(
                            (item) => item.snapshot === contestSnapshot(b),
                          ),
                        ) -
                        Number(
                          current.some(
                            (item) => item.snapshot === contestSnapshot(a),
                          ),
                        ),
                    )
                    .map((contest, index) => {
                      const snapshot = contestSnapshot(contest);
                      const saved = current.find(
                        (entry) => entry.snapshot === snapshot,
                      );
                      const duplicate =
                        contests.filter(
                          (other) => contestSnapshot(other) === snapshot,
                        ).length > 1;
                      const item = duplicate ? undefined : saved;
                      const title =
                        contest.referendumTitle ??
                        contest.office ??
                        "Unnamed contest";
                      return (
                        <Pressable
                          key={index}
                          accessibilityRole="button"
                          accessibilityLabel={`${contest.referendumTitle ? "Measure" : contest.office ? "Race" : "Contest"}, ${title}, ${duplicate ? "Notes unavailable for this item" : item ? status(item.progress) : "Add notes"}${item?.choice ? `, Possible choice: ${item.choice}` : item?.notes ? `, Your note preview: ${item.notes.slice(0, 120)}` : ""}`}
                          accessibilityState={{ disabled: duplicate || busy }}
                          disabled={duplicate || busy}
                          onPress={() => {
                            setChoiceOpen(false);
                            setRetry(undefined);
                            setError(false);
                            setDraft(
                              item ?? {
                                election: electionKey(
                                  election,
                                  provider,
                                  lookupScope,
                                ),
                                snapshot,
                                title,
                                electionName: election.name,
                                electionDay: election.electionDay,
                                notes: "",
                                progress: "undecided",
                              },
                            );
                          }}
                          style={{
                            borderWidth: 1,
                            borderColor: hair[1],
                            borderRadius: 14,
                            padding: sp[3],
                            flexDirection: "row",
                            alignItems: "center",
                            gap: sp[3],
                            opacity: duplicate ? 0.5 : 1,
                          }}
                        >
                          <View
                            accessible={false}
                            aria-hidden={true}
                            importantForAccessibility="no-hide-descendants"
                            style={{
                              alignSelf: "flex-start",
                              padding: 7,
                              borderRadius: 9,
                              backgroundColor: planes.surface,
                            }}
                          >
                            <Icon
                              name={contest.referendumTitle ? "doc" : "users"}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                          <View style={{ flex: 1, gap: sp[2] }}>
                            <Text style={s.rowTitle}>{title}</Text>
                            {item ? (
                              readingBadge(item.progress)
                            ) : (
                              <Text style={{ color: P.inkOnNight }}>
                                {duplicate
                                  ? "Notes unavailable for this item"
                                  : "Add notes"}
                              </Text>
                            )}
                            {item?.choice && (
                              <Text>Possible choice: {item.choice}</Text>
                            )}
                            {!item?.choice && !!item?.notes && (
                              <Text numberOfLines={2}>
                                Your note: {item.notes.slice(0, 120)}
                              </Text>
                            )}
                          </View>
                          <View
                            accessible={false}
                            aria-hidden={true}
                            importantForAccessibility="no-hide-descendants"
                          >
                            <Icon name="chevR" size={18} color={P.quiet} />
                          </View>
                        </Pressable>
                      );
                    })}
                </>
              )}
              {ready && !election && !items.length && (
                <View style={{ gap: sp[2], paddingVertical: sp[4] }}>
                  <Text style={s.heading}>A place to remember</Text>
                  <Text>
                    Open your ballot and choose a race or measure to save your
                    first note.
                  </Text>
                  {onOpenBallot &&
                    button("Open my ballot", onOpenBallot, false, false, true)}
                </View>
              )}
              {!!stale.length && (
                <>
                  <Text>
                    Ballot changed. Previous choices weren’t applied to this
                    ballot.
                  </Text>
                  {stale.map((item) => record(item, true))}
                </>
              )}
              {!election && items.map((item) => record(item))}
            </>
          )}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: hair[1],
              paddingTop: sp[3],
              gap: sp[1],
            }}
          >
            <Text style={s.meta}>
              Private on this device · Does not cast a vote
            </Text>
            {button(`Privacy details ${privacyOpen ? "−" : "+"}`, () =>
              setPrivacyOpen(!privacyOpen),
            )}
            {privacyOpen && (
              <Text>
                Notes and possible choices stay in this app on this device. They
                aren’t sent to Billion, captured in analytics, or included in
                sharing. The app doesn’t encrypt these notes; device backups may
                include them. Saving doesn’t register you or cast a vote.
                Reminders aren’t available until verified deadlines for your
                election and voting method are supplied.
              </Text>
            )}
            {!draft && (items.length > 0 || error) && (
              <>
                {button(`Manage saved notes ${manageOpen ? "−" : "+"}`, () =>
                  setManageOpen(!manageOpen),
                )}
                {manageOpen && (
                  <>
                    <Text>
                      Delete every saved note and possible choice on this
                      device, across all elections. This can also clear
                      unreadable stored data.
                    </Text>
                    {button(
                      confirmDelete
                        ? "Confirm: delete all saved notes"
                        : "Delete all saved notes",
                      () => {
                        if (confirmDelete) {
                          void commit(() => store.clear());
                          setConfirmDelete(false);
                        } else setConfirmDelete(true);
                      },
                    )}
                    {confirmDelete &&
                      button("Keep my notes", () => setConfirmDelete(false))}
                  </>
                )}
              </>
            )}
          </View>
        </>
      )}
    </Card>
  );
  return draft ? (
    <Modal visible animationType="slide" onRequestClose={closeEditor}>
      <SafeAreaView style={{ flex: 1, backgroundColor: P.canvas }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: sp[4], paddingBottom: sp[6] }}
        >
          <Text style={{ marginBottom: sp[3], color: P.quiet }}>
            Your ballot notes
          </Text>
          {content}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  ) : (
    content
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: planes.slate,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hair[1],
    padding: 16,
    gap: 13,
  },
  heading: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.white,
  },
  body: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  rowTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  action: { fontFamily: fontBody.semibold, fontSize: 12, lineHeight: 18 },
  meta: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusOption: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: hair[2],
  },
  statusSelected: { backgroundColor: planes.surface, borderColor: hair[3] },
});
