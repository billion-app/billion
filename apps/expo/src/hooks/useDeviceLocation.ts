/**
 * useDeviceLocation — one-shot native location fix via expo-location.
 *
 * useDeviceAddress resolves the fix through the OS geocoder, then asks the
 * voter to confirm the suggested address. Coordinates never go to Billion.
 * One-shot by design — no background tracking or watch loop.
 *
 * Error states are plain-language because they surface in the address UI:
 * - "denied"   → the user (or the OS) said no; offer manual entry
 * - "unavailable" → location services are off device-wide
 * - "failed"   → GPS timed out or the fix was too weak to use
 *
 * Services are checked before the permission prompt because iOS reports a
 * granted foreground permission while Location Services are off device-wide;
 * without the check the fix call fails and we would tell the voter to retry
 * something that can only be fixed in Settings.
 */
import { useCallback, useState } from "react";
import * as Location from "expo-location";

export type DeviceLocationError = "denied" | "unavailable" | "failed";

export type DeviceLocationResult =
  | { location: Location.LocationObject; error: null }
  | { location: null; error: DeviceLocationError };

export interface DeviceLocationState {
  /** Return the fix or failure to the caller that owns this request. */
  request: () => Promise<DeviceLocationResult>;
  /** True while permission or GPS resolution is in flight. */
  locating: boolean;
}

export function useDeviceLocation(): DeviceLocationState {
  const [locating, setLocating] = useState(false);

  const request = useCallback(async (): Promise<DeviceLocationResult> => {
    setLocating(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        return { location: null, error: "unavailable" };
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        return { location: null, error: "denied" };
      }

      // Accuracy balanced for address resolution, not navigation. A few
      // seconds is acceptable; the user is waiting on a form field.
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { location: fix, error: null };
    } catch {
      // A provider failure (timeout, weak fix, geolocation absent on web)
      // lands here; the caller cannot act on the distinction.
      return { location: null, error: "failed" };
    } finally {
      setLocating(false);
    }
  }, []);

  return { request, locating };
}
