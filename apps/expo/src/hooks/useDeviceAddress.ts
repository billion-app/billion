/** One foreground fix, resolved on-device into an address the voter can confirm. */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import type { DeviceLocationError } from "~/hooks/useDeviceLocation";
import type { AppTranslate } from "~/i18n/app-strings";
import { useDeviceLocation } from "~/hooks/useDeviceLocation";
import { formatPlacemark } from "~/utils/address";

type DeviceAddressError = DeviceLocationError | "address-unavailable";

export function useDeviceAddress() {
  const { request, locating, error: locationError } = useDeviceLocation();
  const [resolving, setResolving] = useState(false);
  const [addressError, setAddressError] = useState<DeviceAddressError | null>(
    null,
  );
  const revision = useRef(0);
  // Typing, submitting, cancelling, and unmounting invalidate an older fix.
  const cancel = useCallback(() => {
    revision.current += 1;
    setResolving(false);
    setAddressError(null);
  }, []);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );

  const resolve = useCallback(async (): Promise<string | null> => {
    const attempt = ++revision.current;
    setAddressError(null);
    const fix = await request();
    if (!fix || attempt !== revision.current) return null;
    setResolving(true);
    try {
      const placemarks = await Location.reverseGeocodeAsync(fix.coords);
      if (attempt !== revision.current) return null;
      const address = formatPlacemark(placemarks[0]);
      // Democracy Works requires a full street address, not raw coordinates.
      if (!address) setAddressError("address-unavailable");
      return address;
    } catch {
      if (attempt === revision.current) setAddressError("address-unavailable");
      return null;
    } finally {
      if (attempt === revision.current) setResolving(false);
    }
  }, [request]);

  return {
    resolve,
    cancel,
    locating,
    resolving,
    error: addressError ?? locationError,
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
