import type { TextProps } from "react-native";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Contest, Election } from "@acme/api";

import type { Preparation, Progress } from "~/utils/preparation";
import { BallotText as BaseText } from "~/components/ballot-evidence/BallotText";
import { Card } from "~/components/ui/layout";
import { fontBody, DigestPalette as P, sp, typography } from "~/styles";
import {
  contestSnapshot,
  createPreparationStore,
  electionKey,
} from "~/utils/preparation";

function Text({ style, ...props }: TextProps) {
  return (
    <BaseText
      {...props}
      style={[typography.body, { color: P.inkOnNight }, style]}
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
}: {
  election?: Election;
  provider: string;
  /** Exact lookup input stays local; never bind preparation across addresses. */
  lookupScope?: string;
  contests?: Contest[];
  initiallyOpen?: boolean;
}) {
  const identity =
    election && lookupScope
      ? electionKey(election, provider, lookupScope)
      : undefined;
  const [items, setItems] = useState<Preparation[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [open, setOpen] = useState(initiallyOpen);
  const [pendingDraft, setPendingDraft] = useState<Preparation>();
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
      setPendingDraft((current) =>
        current && deleted(current) ? undefined : current,
      );
    });
    setReady(false);
    setDraft(undefined);
    setPendingDraft(undefined);
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
  ) {
    setBusy(true);
    try {
      setItems(await action());
      if (closeDraft) {
        setDraft(undefined);
        setPendingDraft(undefined);
      }
      setError(false);
      setReady(true);
    } catch {
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
        backgroundColor: primary ? P.primary : undefined,
        borderRadius: 10,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      <Text style={[typography.body, { color: P.inkOnNight }]}>
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
  const current = items.filter((p) => p.election === identity);
  const stale = current.filter(
    (p) => !contests.some((c) => contestSnapshot(c) === p.snapshot),
  );
  const selectedContest = draft
    ? contests.find((c) => contestSnapshot(c) === draft.snapshot)
    : undefined;
  return (
    <Card {...{ "ph-no-capture": true }} style={{ padding: sp[4], gap: sp[3] }}>
      {button(
        open ? "Close private preparation" : "Private ballot preparation",
        () => setOpen(!open),
      )}
      {open && (
        <>
          <Text style={typography.h3}>
            {election
              ? `${election.name} · ${election.electionDay}`
              : "Saved private preparation"}
          </Text>
          <Text style={typography.body}>
            Saved only in this app on this device. Notes and tentative choices
            are not sent to Billion or included in sharing. Device backups may
            include this data. Saving does not register you or cast a vote.
          </Text>
          <Text style={typography.bodySmall}>
            Reminders are unavailable until verified deadlines for your election
            and voting method are supplied.
          </Text>
          {ready && election && !lookupScope && (
            <Text>
              Saving is unavailable until this lookup is explicitly identified.
            </Text>
          )}
          {ready && !election && !items.length && (
            <Text>
              No preparation saved on this device. When a supplied ballot
              identifies your election, you can save races and measures there.
            </Text>
          )}
          {error && (
            <Text accessibilityLiveRegion="polite" style={typography.body}>
              Could not read or save preparation. Retry, or delete all
              preparation if stored data is unreadable. Unsaved edits remain
              here.
            </Text>
          )}
          {error &&
            !ready &&
            button(
              "Retry loading preparation",
              () => void commit(() => store.read()),
            )}
          {!ready && !error && <Text>Loading private preparation…</Text>}
          {ready && !!election && !current.length && (
            <Text style={typography.body}>
              Nothing saved for this election. Save a race or measure to return
              to it later.
            </Text>
          )}
          {ready &&
            election &&
            lookupScope &&
            contests.map((c, index) => {
              const snapshot = contestSnapshot(c);
              const item = current.find((p) => p.snapshot === snapshot);
              const title = c.referendumTitle ?? c.office ?? "Unnamed contest";
              const duplicate =
                contests.filter((other) => contestSnapshot(other) === snapshot)
                  .length > 1;
              return (
                <View key={index}>
                  {button(
                    `${title} · ${item ? (item.progress === "undecided" ? "Not reviewed" : item.progress) : "Not saved"}`,
                    () => {
                      if (draft?.snapshot === snapshot) return;
                      (draft && draft.snapshot !== snapshot
                        ? setPendingDraft
                        : setDraft)(
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
                    },
                    false,
                    duplicate,
                  )}
                  {duplicate && (
                    <Text>
                      Preparation unavailable: this contest has no unique
                      identity.
                    </Text>
                  )}
                </View>
              );
            })}
          {pendingDraft && (
            <View>
              <Text>
                Save your current edit before switching, or discard it.
              </Text>
              {button("Keep editing", () => setPendingDraft(undefined))}
              {button("Discard edit and switch", () => {
                setDraft(pendingDraft);
                setPendingDraft(undefined);
              })}
            </View>
          )}
          {draft && (
            <View style={{ gap: sp[3] }}>
              <Text accessibilityRole="header" style={typography.h3}>
                {draft.title}
              </Text>
              <Text>
                {election
                  ? `${election.name} · ${election.electionDay}`
                  : "Saved private preparation"}
              </Text>
              <Text style={typography.bodySmall}>
                Private on this device. Saving does not register you or cast a
                vote.
              </Text>
              <Text style={typography.bodySmall}>
                Save edits before leaving or changing elections.
              </Text>
              <Text>Review progress</Text>
              <Text style={typography.bodySmall}>
                Reviewed means you have read about this item. It does not mean
                you have decided how to vote.
              </Text>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: sp[3] }}
              >
                {(["undecided", "reviewed", "skipped"] as Progress[]).map(
                  (progress) => (
                    <View key={progress}>
                      {button(
                        progress === "undecided" ? "Not reviewed" : progress,
                        () => setDraft({ ...draft, progress }),
                        draft.progress === progress,
                      )}
                    </View>
                  ),
                )}
              </View>
              <Text>Tentative choice (optional)</Text>
              {button(
                "No tentative choice",
                () => setDraft({ ...draft, choice: undefined }),
                !draft.choice,
              )}
              {(selectedContest?.referendumTitle
                ? []
                : (selectedContest?.candidates ?? []).map((c) => c.name)
              ).map((name, index) => {
                const candidates = selectedContest?.candidates ?? [];
                const withdrawn =
                  candidates[index]?.ballotStatus === "withdrewStillOnBallot";
                const ambiguous =
                  !selectedContest?.referendumTitle &&
                  candidates.filter((c) => c.name === name).length > 1;
                return (
                  <View key={index}>
                    {button(
                      `${name}${withdrawn ? " · Withdrawn, still listed" : ""}`,
                      () => setDraft({ ...draft, choice: name }),
                      draft.choice === name,
                      withdrawn || ambiguous,
                    )}
                  </View>
                );
              })}
              {selectedContest?.referendumTitle && (
                <Text>
                  Use private notes for your tentative measure choice. Verified
                  marking options are not supplied.
                </Text>
              )}
              <Text>Private notes</Text>
              <TextInput
                {...{ "ph-no-capture": true }}
                accessibilityLabel="Private notes"
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
                  minHeight: 100,
                  borderWidth: 1,
                  borderColor: P.spark,
                }}
              />
              {button(
                busy ? "Saving…" : "Save preparation on this device",
                () => void commit(() => store.save(draft)),
                false,
                !selectedContest,
                true,
              )}
              {button("Cancel edit", () => setDraft(undefined))}
              {button(
                "Delete this item",
                () => void commit(() => store.remove(draft)),
              )}
            </View>
          )}
          {!!stale.length && (
            <Text style={typography.body}>
              The roster or contest changed. {stale.length} saved item(s) need
              fresh review; old choices have not been applied.
            </Text>
          )}
          {stale.map((item, index) => (
            <View key={index}>
              <Text>{item.title} · Previous snapshot</Text>
              <Text>{item.notes}</Text>
              <Text>Previous tentative choice: {item.choice ?? "None"}</Text>
              {button(
                "Delete previous preparation",
                () => void commit(() => store.remove(item), false),
              )}
            </View>
          ))}
          {items
            .filter((item) => item.election !== identity)
            .map((item, index) => (
              <View key={index}>
                <Text accessibilityRole="header">
                  {item.electionName} · {item.electionDay}
                </Text>
                <Text>
                  {item.title} ·{" "}
                  {item.progress === "undecided"
                    ? "Not reviewed"
                    : item.progress}{" "}
                  · Saved election
                </Text>
                <Text>{item.notes}</Text>
                <Text>Saved tentative choice: {item.choice ?? "None"}</Text>
                {button(
                  "Delete saved item",
                  () => void commit(() => store.remove(item), false),
                )}
              </View>
            ))}
          {(items.length > 0 || error) &&
            button(
              confirmDelete
                ? "Confirm: delete notes and choices for every election"
                : "Delete all preparation on this device",
              () => {
                if (confirmDelete) {
                  void commit(() => store.clear());
                  setConfirmDelete(false);
                } else setConfirmDelete(true);
              },
            )}
          {confirmDelete &&
            button("Keep preparation", () => setConfirmDelete(false))}
        </>
      )}
    </Card>
  );
}
