// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require("./app.config.base.json");

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  expo: {
    ...base,
    extra: {
      ...base.extra,
      posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
      posthogHost: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    },
  },
};
