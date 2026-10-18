import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import type { AppTranslate } from "~/i18n/app-strings";
import { formatPlacemark } from "~/utils/address";

type DeviceAddressError =
  | "denied"
  | "unavailable"
  | "failed"
  | "address-unavailable";

export function useDeviceAddress() {
  const [phase, setPhase] = useState<"locating" | "resolving" | null>(null);
  const [error, setError] = useState<DeviceAddressError | null>(null);
  const revision = useRef(0);
  // Editing or leaving the form invalidates every stage of an older request.
  const cancel = useCallback(() => {
    revision.current += 1;
    setPhase(null);
    setError(null);
  }, []);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );

  const resolve = useCallback(async (): Promise<string | null> => {
    const attempt = ++revision.current;
    setError(null);
    setPhase("locating");
    let geocoding = false;
    try {
      // iOS may report permission granted while device-wide services are off.
      const enabled = await Location.hasServicesEnabledAsync();
      if (attempt !== revision.current) return null;
      if (!enabled) {
        setError("unavailable");
        return null;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (attempt !== revision.current) return null;
      if (!permission.granted) {
        setError("denied");
        return null;
      }
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (attempt !== revision.current) return null;
      geocoding = true;
      setPhase("resolving");
      const placemarks = await Location.reverseGeocodeAsync(fix.coords);
      if (attempt !== revision.current) return null;
      const address = formatPlacemark(placemarks[0]);
      // Democracy Works requires a full street address, not raw coordinates.
      if (!address) setError("address-unavailable");
      return address;
    } catch {
      if (attempt === revision.current) {
        setError(geocoding ? "address-unavailable" : "failed");
      }
      return null;
    } finally {
      if (attempt === revision.current) setPhase(null);
    }
  }, []);

  return {
    resolve,
    cancel,
    locating: phase === "locating",
    resolving: phase === "resolving",
    error,
  };
}

export function deviceLocationMessage(
  error: DeviceAddressError | null,
  t: AppTranslate,
): string | null {
  switch (error) {
    case "denied":
      return t("address.denied");
    case "unavailable":
      return t("address.unavailable");
    case "failed":
      return t("address.failed");
    case "address-unavailable":
      return t("address.noStreetAddress");
    default:
      return null;
  }
}
