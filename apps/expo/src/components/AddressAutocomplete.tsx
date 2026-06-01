/**
 * AddressAutocomplete — address input with a live suggestion dropdown.
 *
 * Debounces the typed query, fetches US-address predictions from
 * places.autocomplete, and lets the user tap a suggestion to commit it. Picking
 * a suggestion (or pressing Look Up with text) calls onSubmit with the chosen
 * address, which then feeds Civic's getVoterInfo. Replaces the bare text field
 * so users can't submit malformed addresses.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";

interface AddressAutocompleteProps {
  /** Initial text to seed the field (e.g. the currently stored address). */
  initialValue?: string;
  /** Commit a final address (suggestion tap or Look Up press). */
  onSubmit: (address: string) => void;
}

/** Debounce a value by `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function AddressAutocomplete({
  initialValue = "",
  onSubmit,
}: AddressAutocompleteProps) {
  const [input, setInput] = useState(initialValue);
  // Closed right after a pick so the dropdown doesn't reopen on the
  // programmatic setInput; reopened as soon as the user types again.
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounced(input, 250);

  const suggestionsQuery = useQuery({
    ...trpc.places.autocomplete.queryOptions({ query: debouncedQuery }),
    enabled: open && debouncedQuery.trim().length >= 3,
  });

  const suggestions = suggestionsQuery.data ?? [];
  const showDropdown =
    open &&
    input.trim().length >= 3 &&
    (suggestions.length > 0 || suggestionsQuery.isFetching);

  const pick = (address: string) => {
    setOpen(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInput(address);
    onSubmit(address);
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
          disabled={!input.trim()}
          onPress={() => input.trim() && onSubmit(input.trim())}
        >
          <Text style={s.btnText}>Look Up</Text>
        </TouchableOpacity>
      </View>

      {showDropdown && (
        <View style={s.dropdown}>
          {suggestions.map((sug, i) => (
            <TouchableOpacity
              key={sug.placeId}
              style={[s.suggestion, i > 0 && s.suggestionBorder]}
              activeOpacity={0.7}
              onPress={() => pick(sug.description)}
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
