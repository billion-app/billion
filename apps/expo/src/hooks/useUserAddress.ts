import { useCallback, useEffect, useState } from "react";

import { sessionStorage } from "~/utils/client-storage";

const ADDRESS_KEY = "user_address";

export function useUserAddress() {
  const [address, setAddressState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    sessionStorage
      .getItemAsync(ADDRESS_KEY)
      .then((value: string | null) => {
        setAddressState(value);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const setAddress = useCallback(async (newAddress: string) => {
    await sessionStorage.setItemAsync(ADDRESS_KEY, newAddress);
    setAddressState(newAddress);
  }, []);

  const clearAddress = useCallback(async () => {
    await sessionStorage.deleteItemAsync(ADDRESS_KEY);
    setAddressState(null);
  }, []);

  return { address, setAddress, clearAddress, isLoading };
}
