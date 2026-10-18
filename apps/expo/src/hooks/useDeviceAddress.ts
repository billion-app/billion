/**
 * useDeviceAddress — one-shot device fix resolved into a lookup address.
 *
 * `useDeviceLocation` owns the permission prompt and GPS read; this hook adds
 * the other half every address surface needs: hand the coordinate to the OS
 * geocoder, and fall back to the `lat,lng` the civic lookup also accepts when
 * no street address comes back. Keeping it here means the Feed, Elections, How
 * to Vote, the ballot lookup, and Settings all take the same path instead of
 * re-implementing reverse geocoding per screen.
 *
 * The typed path is never replaced: GPS gives where the person is, not where
 * they are registered, so callers keep their manual field next to this button.
 */
import { useCallback, useState } from "react";
import * as Location from "expo-location";

import type { DeviceLocationError } from "~/hooks/useDeviceLocation";
import { useDeviceLocation } from "~/hooks/useDeviceLocation";
import { formatCoordinates, formatPlacemark } from "~/utils/address";

export interface DeviceAddressState {
  /**
   * Fetch a fix, reverse-geocode it, and return a lookup address. Resolves
   * with null when the permission or fix failed; the error state is exposed
   * separately so the caller can render it.
   */
  resolve: () => Promise<string | null>;
  /** True while permission or GPS resolution is in flight. */
  locating: boolean;
  /** True while the fix is being reverse-geocoded. */
  resolving: boolean;
  /** Last failure, cleared on the next attempted request. */
  error: DeviceLocationError | null;
}

export function useDeviceAddress(): DeviceAddressState {
  const { request, locating, error } = useDeviceLocation();
  const [resolving, setResolving] = useState(false);

  const resolve = useCallback(async (): Promise<string | null> => {
    const fix = await request();
    if (!fix) return null;

    const { latitude, longitude } = fix.coords;
    setResolving(true);
    try {
      const placemarks = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      // Without a usable placemark, hand the coordinates to the lookup anyway —
      // the civic endpoints accept "latitude,longitude".
      return (
        formatPlacemark(placemarks[0]) ?? formatCoordinates(latitude, longitude)
      );
    } catch {
      // Reverse geocode failed but the fix itself was good — coordinates
      // still beat nothing.
      return formatCoordinates(latitude, longitude);
    } finally {
      setResolving(false);
    }
  }, [request]);

  return { resolve, locating, resolving, error };
}

/**
 * Plain-language status for the address surfaces. `null` means there is
 * nothing to show, which lets callers render the message unconditionally.
 */
export function deviceLocationMessage(
  error: DeviceLocationError | null,
): string | null {
  switch (error) {
    case "denied":
      return "Location is off for Billion — type your address below instead.";
    case "unavailable":
      return "Location services are off — type your address below instead.";
    case "failed":
      return "Couldn't get a location fix — try again or type it in.";
    default:
      return null;
  }
}
