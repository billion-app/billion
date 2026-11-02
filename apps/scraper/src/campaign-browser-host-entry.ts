import { readFileSync } from "node:fs";

import { createCampaignBrowserHost } from "./research/campaign-browser-host";

const tokenPath = process.env.CAMPAIGN_BROWSER_TOKEN_FILE;
if (!tokenPath) throw new Error("Owned host token file required");
const host = createCampaignBrowserHost({
  token: readFileSync(tokenPath, "utf8").trim(),
  dockerPath: process.env.CAMPAIGN_BROWSER_DOCKER ?? "/usr/local/bin/docker",
  wrapperPath: process.env.CAMPAIGN_BROWSER_WRAPPER ?? "",
  browserHost: process.env.CAMPAIGN_BROWSER_BIND ?? "127.0.0.1",
  advertisedHost: process.env.CAMPAIGN_BROWSER_ADVERTISE,
});
const port = Number(process.env.CAMPAIGN_BROWSER_PORT ?? "9876");
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid private capability port");
host.server.listen(port, process.env.CAMPAIGN_BROWSER_BIND ?? "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void host.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
