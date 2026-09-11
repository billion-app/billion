// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require("./app.config.base.json");

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      posthogHost: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      metaAppId: process.env.META_APP_ID,
    },
  },
};
