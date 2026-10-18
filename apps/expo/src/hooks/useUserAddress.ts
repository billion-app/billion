/**
 * One on-device voter address, shared by every reader.
 *
 * Screens stay mounted while the user edits the address elsewhere (Settings →
 * Location, the Feed greeting, How to Vote). A module-level listener set keeps
 * each mounted `useUserAddress` instance in step, so a change in one surface
 * updates the others without a reload. Secure storage remains the source of
 * truth; listeners only mirror a write that already succeeded.
 */
import { useCallback, useEffect, useState } from "react";

import { sessionStorage } from "~/utils/client-storage";

const ADDRESS_KEY = "user_address";

type AddressListener = (address: string | null) => void;

const listeners = new Set<AddressListener>();

function publish(address: string | null) {
  for (const listener of listeners) listener(address);
}

export function useUserAddress() {
  const [address, setAddressState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const listener: AddressListener = (value) => {
      if (active) setAddressState(value);
    };
    listeners.add(listener);

    sessionStorage
      .getItemAsync(ADDRESS_KEY)
      .then((value: string | null) => {
        if (!active) return;
        setAddressState(value);
        setIsLoading(false);
      })
      .catch(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  const setAddress = useCallback(async (newAddress: string) => {
    await sessionStorage.setItemAsync(ADDRESS_KEY, newAddress);
    setAddressState(newAddress);
    publish(newAddress);
  }, []);

  const clearAddress = useCallback(async () => {
    await sessionStorage.deleteItemAsync(ADDRESS_KEY);
    setAddressState(null);
    publish(null);
  }, []);

  return { address, setAddress, clearAddress, isLoading };
}
