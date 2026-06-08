import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import { getBaseUrl } from "./base-url";
import { authStorage } from "./client-storage";

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    expoClient({
      // Must match the app's registered URL scheme (app.config.json), or the
      // OAuth callback deep-link (expo-origin) won't route back into the app.
      scheme: "billion",
      storagePrefix: "expo",
      storage: authStorage,
    }),
  ],
});
