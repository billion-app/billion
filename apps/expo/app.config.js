// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require("./app.config.base.json");

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      // Preserve the legacy embedded client value for the 0.7.0 OTA runtime.
      posthogProjectToken: "phc_CaUM5UdNDmbEhxKipFLwPoGFhPSF8R5kk7FU6w8XNAxV",
      posthogHost: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      metaAppId: process.env.META_APP_ID,
    },
  },
};
