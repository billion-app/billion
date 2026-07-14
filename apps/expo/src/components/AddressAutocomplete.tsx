/**
 * AddressAutocomplete — address input with a live suggestion dropdown.
 *
 * Debounces the typed query, fetches US-address predictions from
 * places.autocomplete, and lets the user tap a suggestion to commit it. Picking
 * a suggestion resolves its full formatted address via places.details (which
 * also closes the Places billing session — see the session-token note below),
 * then calls onSubmit with that address to feed Civic's getVoterInfo. Replaces
 * the bare text field so users can't submit malformed addresses.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { useDebounced } from "~/hooks/useDebounce";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";

interface AddressAutocompleteProps {
  /** Initial text to seed the field (e.g. the currently stored address). */
  initialValue?: string;
  /** Commit a final address (suggestion tap or Look Up press). */
  onSubmit: (address: string) => void;
}

/**
 * RFC-4122 v4 UUID, used as a Places session token to bundle one address
 * entry's autocomplete calls (+ the closing details call) into a single
 * billed session. Inline to avoid a uuid/crypto dependency.
 */
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function AddressAutocomplete({
  initialValue = "",
  onSubmit,
}: AddressAutocompleteProps) {
  const [input, setInput] = useState(initialValue);
  // Closed right after a pick so the dropdown doesn't reopen on the
  // programmatic setInput; reopened as soon as the user types again.
  const [open, setOpen] = useState(false);
  // One token per address-entry; regenerated after each committed pick.
  const [sessionToken, setSessionToken] = useState(uuidv4);
  const debouncedQuery = useDebounced(input, 250);

  const suggestionsQuery = useQuery({
    ...trpc.places.autocomplete.queryOptions({
      query: debouncedQuery,
      sessionToken,
    }),
    enabled: open && debouncedQuery.trim().length >= 3,
  });

  // Closes the billing session and returns the full formatted address (with
  // ZIP, which the prediction omits). Null on the mock path → use the raw text.
  const detailsMutation = useMutation(trpc.places.details.mutationOptions());

  const suggestions = suggestionsQuery.data ?? [];
  const showDropdown =
    open &&
    !detailsMutation.isPending &&
    input.trim().length >= 3 &&
    (suggestions.length > 0 || suggestionsQuery.isFetching);

  const commit = (address: string) => {
    setOpen(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInput(address);
    setSessionToken(uuidv4()); // fresh token for the next entry
    onSubmit(address);
  };

  const pick = async (sug: { description: string; placeId: string }) => {
    setOpen(false);
    try {
      const full = await detailsMutation.mutateAsync({
        placeId: sug.placeId,
        sessionToken,
      });
      commit(full ?? sug.description);
    } catch {
      // Details failed (e.g. network) — fall back to the prediction text.
      commit(sug.description);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.hint}>
        Enter your address to see what&apos;s on your ballot.
      </Text>
      <View style={s.row}>
        <TextInput
          style={s.input}
          placeholder="Your registered address"
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={(t) => {
            setOpen(true);
            setInput(t);
          }}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          autoFocus
        />
        <TouchableOpacity
          style={[s.btn, !input.trim() && s.btnOff]}
          disabled={!input.trim() || detailsMutation.isPending}
          onPress={() => input.trim() && commit(input.trim())}
        >
          <Text style={s.btnText}>Look Up</Text>
        </TouchableOpacity>
      </View>

      {detailsMutation.isPending && (
        <View style={s.dropdown}>
          <View style={s.suggestion}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={s.suggestionText}>Confirming address…</Text>
          </View>
        </View>
      )}

      {showDropdown && (
        <View style={s.dropdown}>
          {suggestions.map((sug, i) => (
            <TouchableOpacity
              key={sug.placeId}
              style={[s.suggestion, i > 0 && s.suggestionBorder]}
              activeOpacity={0.7}
              onPress={() => void pick(sug)}
            >
              <Icon name="pin" size={14} color={colors.textSecondary} />
              <Text style={s.suggestionText} numberOfLines={1}>
                {sug.description}
              </Text>
            </TouchableOpacity>
          ))}
          {suggestions.length === 0 && suggestionsQuery.isFetching && (
            <View style={s.suggestion}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={s.suggestionText}>Searching…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  hint: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  row: { flexDirection: "row", gap: 10 },
  input: {
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
  btn: {
    backgroundColor: colors.white,
    borderRadius: 9999,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  btnOff: { opacity: 0.5 },
  btnText: { fontFamily: fontBody.semibold, fontSize: 14, color: planes.ink },
  dropdown: {
    marginTop: 10,
    backgroundColor: planes.navy,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    overflow: "hidden",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionBorder: { borderTopWidth: 1, borderTopColor: hair[1] },
  suggestionText: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    color: colors.white,
    flex: 1,
  },
});
