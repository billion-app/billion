/**
 * Address field with native device-location capture, then Civic lookup.
 *
 * GPS is the fast path: one native permission prompt, one fix, reverse-geocoded
 * on-device by the OS. Typed entry stays as the equal-path fallback — GPS
 * gives you where you are, not necessarily where you're *registered*, so the
 * field never treats the fix as the final answer and never blocks typing.
 *
 * Google Places autocomplete is gone from this surface: suggestions required a
 * billed server key, and the native path resolves the same need with no key
 * and no per-keystroke network round-trip.
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
import * as Location from "expo-location";

import { PinMark } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { useDeviceLocation } from "~/hooks/useDeviceLocation";
import { DigestHair, DigestPalette, fontBody } from "~/styles";

interface AddressAutocompleteProps {
  /** Initial text to seed the field (e.g. the currently stored address). */
  initialValue?: string;
  /** Commit a final address (GPS resolve, or Look Up press). */
  onSubmit: (address: string) => void;
  /**
   * Optional field hint. Pass `null` to hide — Elections empty state carries
   * the editorial lead elsewhere so we don't repeat "enter your address".
   * Omit for the default one-liner.
   */
  hint?: string | null;
  autoFocus?: boolean;
  /** Menu/sheet field: type and commit. No Look Up chrome. */
  inline?: boolean;
}

const DEFAULT_HINT = "Enter your address to see what's on your ballot.";

/** "123 Oak St, Sacramento, CA 95814" from the OS reverse-geocode placemark. */
function formatPlacemark(p: Location.LocationGeocodedAddress): string | null {
  const street = [p.streetNumber, p.street].filter(Boolean).join(" ");
  const city = p.city ?? p.district ?? p.subregion;
  const parts = [
    street,
    city,
    p.region,
    p.postalCode,
  ].filter(Boolean);
  // A fix without a street or a city is a coordinate, not a usable
  // registered address — let the caller fall back to manual entry.
  if (!street || !city) return null;
  return parts.join(", ");
}

export function AddressAutocomplete({
  initialValue = "",
  onSubmit,
  hint = DEFAULT_HINT,
  autoFocus = true,
  inline = false,
}: AddressAutocompleteProps) {
  const [input, setInput] = useState(initialValue);
  const { request: locate, locating, error: locationError } =
    useDeviceLocation();
  // The committed address while the post-GPS lookup is still resolving.
  const [resolving, setResolving] = useState(false);

  const commit = (address: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInput(address);
    onSubmit(address);
  };

  const captureLocation = async () => {
    const fix = await locate();
    if (!fix) return; // hook already set the error state we render below

    setResolving(true);
    try {
      const placemarks = await Location.reverseGeocodeAsync({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
      });
      const formatted = placemarks[0] ? formatPlacemark(placemarks[0]) : null;
      // Without a usable placemark, hand the coordinates to Civic anyway —
      // Civic accepts "latitude,longitude" and resolves the jurisdiction.
      commit(formatted ?? `${fix.coords.latitude.toFixed(5)},${fix.coords.longitude.toFixed(5)}`);
    } catch {
      // Reverse geocode failed but the fix itself was good — coordinates
      // still beat nothing, and Civic can resolve them.
      commit(
        `${fix.coords.latitude.toFixed(5)},${fix.coords.longitude.toFixed(5)}`,
      );
    } finally {
      setResolving(false);
    }
  };

  const locationStatus = resolving ? (
    inline ? null : (
      <Text style={s.statusText}>Confirming your address…</Text>
    )
  ) : locationError === "denied" ? (
    <Text style={s.statusText}>
      Location is off for Billion — type your address below instead.
    </Text>
  ) : locationError === "unavailable" ? (
    <Text style={s.statusText}>
      Location services are off — type your address below instead.
    </Text>
  ) : locationError === "failed" ? (
    <Text style={s.statusText}>
      Couldn&apos;t get a location fix — try again or type it in.
    </Text>
  ) : null;

  const gpsButton = (
    <TouchableOpacity
      style={[s.gpsBtn, locating && s.gpsBtnBusy]}
      disabled={locating || resolving}
      onPress={() => void captureLocation()}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Use my current location"
    >
      {locating || resolving ? (
        <ActivityIndicator size="small" color={DigestPalette.spark} />
      ) : (
        <>
          <PinMark size={14} color={DigestPalette.spark} />
          <Text style={s.gpsText}>Use my location</Text>
        </>
      )}
    </TouchableOpacity>
  );

  if (inline) {
    return (
      <View>
        <TextInput
          style={s.inputInline}
          placeholder="Address"
          placeholderTextColor={DigestPalette.quiet}
          value={input}
          onChangeText={setInput}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={() => {
            const next = input.trim();
            if (next) commit(next);
          }}
        />
        {gpsButton}
        {locationStatus}
      </View>
    );
  }

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
            onChangeText={setInput}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            autoFocus={autoFocus}
          />
        </View>
        <TouchableOpacity
          style={[s.btn, !input.trim() && s.btnOff]}
          disabled={!input.trim() || resolving}
          onPress={() => input.trim() && commit(input.trim())}
        >
          <Text style={s.btnText}>Look Up</Text>
        </TouchableOpacity>
      </View>

      {gpsButton}
      {locationStatus}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 12,
  },
  inputInline: {
    height: 40,
    paddingHorizontal: 10,
    color: DigestPalette.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 15,
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
    backgroundColor: DigestPalette.primary,
    borderRadius: 9999,
    height: 56,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  btnOff: { opacity: 0.5 },
  btnText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: DigestPalette.inkOnNight,
  },
  gpsBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.stone,
  },
  gpsBtnBusy: { opacity: 0.7 },
  gpsText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
  statusText: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: DigestPalette.quiet,
    marginTop: 8,
    lineHeight: 17,
  },
});
