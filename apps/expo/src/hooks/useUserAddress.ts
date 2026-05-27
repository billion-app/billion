import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ADDRESS_KEY = "user_address";

export function useUserAddress() {
  const [address, setAddressState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ADDRESS_KEY)
      .then((value: string | null) => {
        setAddressState(value);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const setAddress = useCallback(async (newAddress: string) => {
    await AsyncStorage.setItem(ADDRESS_KEY, newAddress);
    setAddressState(newAddress);
  }, []);

  const clearAddress = useCallback(async () => {
    await AsyncStorage.removeItem(ADDRESS_KEY);
    setAddressState(null);
  }, []);

  return { address, setAddress, clearAddress, isLoading };
}
