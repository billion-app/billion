import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

interface SyncStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface AsyncStorage {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

interface WebStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const getWebStorage = () =>
  (
    globalThis as typeof globalThis & {
      localStorage?: WebStorage;
    }
  ).localStorage;

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- localStorage may be undefined at runtime */
export const authStorage: SyncStorage = {
  getItem(key) {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      return storage ? storage.getItem(key) : null;
    }

    return SecureStore.getItem(key);
  },
  setItem(key, value) {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      if (storage) storage.setItem(key, value);
      return;
    }

    SecureStore.setItem(key, value);
  },
};

export const sessionStorage: AsyncStorage = {
  async getItemAsync(key) {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      return storage ? storage.getItem(key) : null;
    }

    return SecureStore.getItemAsync(key);
  },
  async setItemAsync(key, value) {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      if (storage) storage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key) {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      if (storage) storage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};
/* eslint-enable @typescript-eslint/no-unnecessary-condition */
