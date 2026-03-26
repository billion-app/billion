import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

type SyncStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

type AsyncStorage = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const getWebStorage = () =>
  (
    globalThis as typeof globalThis & {
      localStorage?: WebStorage;
    }
  ).localStorage;

export const authStorage: SyncStorage = {
  getItem(key) {
    if (Platform.OS === "web") {
      return getWebStorage()?.getItem(key) ?? null;
    }

    return SecureStore.getItem(key);
  },
  setItem(key, value) {
    if (Platform.OS === "web") {
      getWebStorage()?.setItem(key, value);
      return;
    }

    SecureStore.setItem(key, value);
  },
};

export const sessionStorage: AsyncStorage = {
  async getItemAsync(key) {
    if (Platform.OS === "web") {
      return getWebStorage()?.getItem(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },
  async setItemAsync(key, value) {
    if (Platform.OS === "web") {
      getWebStorage()?.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key) {
    if (Platform.OS === "web") {
      getWebStorage()?.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};
