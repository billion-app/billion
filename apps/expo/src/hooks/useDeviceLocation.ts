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
 */
import { useCallback, useState } from "react";
import * as Location from "expo-location";

export type DeviceLocationError =
  | "denied"
  | "unavailable"
  | "failed";

export interface DeviceLocationState {
  /** Fetch a one-shot fix. Resolves with null instead of throwing on any failure. */
  request: () => Promise<Location.LocationObject | null>;
  /** True while permission or GPS resolution is in flight. */
  locating: boolean;
  /** Last failure, cleared on the next successful or attempted request. */
  error: DeviceLocationError | null;
  /** True once the OS permission prompt has been answered either way. */
  permissionDecided: boolean;
}

export function useDeviceLocation(): DeviceLocationState {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<DeviceLocationError | null>(null);
  const [permissionDecided, setPermissionDecided] = useState(false);

  const request = useCallback(async (): Promise<Location.LocationObject | null> => {
    setError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setPermissionDecided(true);
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
      // Unavailable services and provider failures both land here; the
      // distinction rarely changes the copy ("turn location on / try again").
      setError("failed");
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  return { request, locating, error, permissionDecided };
}
