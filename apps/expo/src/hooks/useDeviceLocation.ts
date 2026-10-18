/**
 * useDeviceLocation — one-shot native location fix via expo-location.
 *
 * Replaces the Google Places autocomplete flow for seeding the voter address:
 * the OS asks for permission, GPS resolves a coordinate pair, and the caller
 * decides how to use it (reverse-geocode into a mailing address, pass to
 * Civic, etc.). One-shot by design — no background tracking, no watch loop.
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

export interface DeviceLocationState {
  /** Fetch a one-shot fix. Resolves with null instead of throwing on any failure. */
  request: () => Promise<Location.LocationObject | null>;
  /** True while permission or GPS resolution is in flight. */
  locating: boolean;
  /** Last failure, cleared on the next successful or attempted request. */
  error: DeviceLocationError | null;
}

export function useDeviceLocation(): DeviceLocationState {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<DeviceLocationError | null>(null);

  const request =
    useCallback(async (): Promise<Location.LocationObject | null> => {
      setError(null);
      setLocating(true);
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setError("unavailable");
          return null;
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setError("denied");
          return null;
        }

        // Accuracy balanced for address resolution, not navigation. A few
        // seconds is acceptable; the user is waiting on a form field.
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return fix;
      } catch {
        // A provider failure (timeout, weak fix, geolocation absent on web)
        // lands here; the caller cannot act on the distinction.
        setError("failed");
        return null;
      } finally {
        setLocating(false);
      }
    }, []);

  return { request, locating, error };
}
