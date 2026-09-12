/**
 * Address field with Places autocomplete, then Civic lookup.
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
import { PinMark } from "~/components/digest/CraftMarks";
import { useDebounced } from "~/hooks/useDebounce";
import {
  fontBody,
  DigestHair,
  DigestPalette,
} from "~/styles";
import { trpc } from "~/utils/api";

interface AddressAutocompleteProps {
  /** Initial text to seed the field (e.g. the currently stored address). */
  initialValue?: string;
  /** Commit a final address (suggestion tap or Look Up press). */
  onSubmit: (address: string) => void;
  /**
   * Optional field hint. Pass `null` to hide — Elections empty state carries
   * the editorial lead elsewhere so we don't repeat "enter your address".
   * Omit for the default one-liner.
   */
  hint?: string | null;
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

const DEFAULT_HINT =
  "Enter your address to see what's on your ballot.";

export function AddressAutocomplete({
  initialValue = "",
  onSubmit,
  hint = DEFAULT_HINT,
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
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <View style={s.row}>
        <View style={s.field}>
          <View style={s.pin}>
            <PinMark size={18} color={DigestPalette.spark} />
          </View>
          <TextInput
            style={s.input}
            placeholder="Registered address"
            placeholderTextColor={DigestHair.inkMuted}
            value={input}
            onChangeText={(t) => {
              setOpen(true);
              setInput(t);
            }}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            autoFocus
          />
        </View>
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
            <ActivityIndicator size="small" color={DigestPalette.spark} />
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
              <PinMark size={14} color={DigestPalette.quiet} />
              <Text style={s.suggestionText} numberOfLines={1}>
                {sug.description}
              </Text>
            </TouchableOpacity>
          ))}
          {suggestions.length === 0 && suggestionsQuery.isFetching && (
            <View style={s.suggestion}>
              <ActivityIndicator size="small" color={DigestPalette.quiet} />
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
    marginTop: 12,
  },
  hint: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: DigestPalette.quiet,
    marginBottom: 12,
    lineHeight: 19,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  field: { flex: 1, position: "relative" },
  pin: { position: "absolute", left: 18, top: 19, zIndex: 1 },
  input: {
    height: 56,
    backgroundColor: DigestPalette.paper,
    borderRadius: 28,
    paddingLeft: 46,
    paddingRight: 16,
    color: DigestPalette.ink,
    fontFamily: fontBody.medium,
    fontSize: 17,
  },
  btn: {
    backgroundColor: DigestPalette.spark,
    borderRadius: 9999,
    height: 56,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  btnOff: { opacity: 0.5 },
  btnText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: DigestPalette.ink,
  },
  dropdown: {
    marginTop: 10,
    backgroundColor: DigestPalette.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.menuBorder,
    borderRadius: 18,
    overflow: "hidden",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  suggestionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.cardBorder,
  },
  suggestionText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
    flex: 1,
  },
});
