# Private campaign browser capability

The normal California researcher fetches HTML through its existing DNS-pinned public GET transport. Only a current, officially bound campaign that returns a successful, genuinely empty module shell can request this capability. A missing capability leaves a source gap. It never bypasses a challenge or retries a rate-limit through a browser.

The host runs Playwright's authenticated allocation service outside the scraper container. The scraper receives an unguessable, short-lived Playwright endpoint, not Docker access. The host creates one disposable fixed-profile container, and Chromium runs as `pwuser` with its namespace and seccomp sandboxes enabled. Its network namespace has no external interfaces, and the syscall profile permits only AF_UNIX sockets. The credentialed scraper supplies allowed document, JavaScript and stylesheet GET responses through Playwright routing and the ordinary pinned public transport; every request and received body byte spends the research budget. Images, fonts, fetch/XHR, forms, downloads, WebSockets and outside-origin traffic are blocked. An outside-origin asset URL is rejected before DNS; an outside-origin redirect target is rejected before browser fulfillment or a next transport call. The local browser smoke verifies zero FEC DNS/transport attempts for both the ordinary and trailing-dot FEC API hostname. The browser has no database/model credentials, host mounts or Docker socket.

## Host setup

This capability requires a separately reviewed host deployment; adding source code does not enable it automatically. Use an owned checkout and its frozen dependencies. The host service must not load the repository `.env`, scraper startup or supervisor credentials.

1. Pull the fixed image before starting the service:

   ```sh
   docker pull mcr.microsoft.com/playwright@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d
   ```

2. Create an owner-readable token file containing at least 32 random characters. Configure the host service's `CAMPAIGN_BROWSER_TOKEN_FILE`, absolute `CAMPAIGN_BROWSER_DOCKER` and `CAMPAIGN_BROWSER_WRAPPER` paths. The wrapper is `chromium-pipe.mjs` in this directory and must remain beside the vendored `seccomp-browser.json`.
3. Build the scraper and run `node apps/scraper/dist/campaign-browser-host.js` under the host service manager, with a minimal environment. Default allocation listener is `127.0.0.1:9876`. For a Docker scraper, choose a host-reachable private listener using `CAMPAIGN_BROWSER_BIND`, `CAMPAIGN_BROWSER_PORT`, and `CAMPAIGN_BROWSER_ADVERTISE=host.docker.internal`. Restrict this listener and its ephemeral Playwright ports to the local scraper host; do not expose them publicly. The bearer token authorizes allocation, and the returned random WebSocket URL is itself a lease capability.
4. Set `SCRAPER_RENDERER_BASE_URL` and `SCRAPER_RENDERER_TOKEN` in the scraper's managed configuration. Do not mount the Docker socket or host token file into the scraper. Regenerate environment documentation with `pnpm env:example` after registry changes.
5. Run the local Docker isolation smoke before enabling research. Confirm the fixed image, actual Docker `HostConfig.SecurityOpt`, Chromium's sandbox report and verified container removal. A failed or unknown cleanup quarantines the host until an operator resolves it.

The HTTP API accepts only authenticated `GET /v1/capability`, empty `POST /v1/browsers`, and `DELETE /v1/browsers/<owned-id>`. It accepts no URLs, executable paths, Docker flags or browser arguments. It has one concurrent job and a maximum two-minute lease. Host restarts should be supervised with process-tree termination; inspect any labeled remaining container before restarting allocation.

## Provenance and persistence

`seccomp-provenance.json` identifies the immutable Moby baseline and the official Playwright namespace exceptions. The derived profile retains default deny, permits AF_UNIX only, and permits Chromium's namespaced `chroot` after user-namespace creation; the container has no capabilities. The obsolete Playwright baseline is retained for provenance, not used at runtime. The fixed image matches the exact Playwright 1.58.2 dependency; mismatches fail closed.

Research stores a shared, compressed private archive of original HTTP bodies, response URLs, redirects, MIME types, hashes and acquisition times, plus the actual rendered DOM, visible text and deterministic extraction. Rendered evidence points to that archive instead of pretending to be a plain HTTP response. Bounded scrolling records the actual main text at each position. Every non-hidden substantive text node must occur in an observed main-text frame before the complete context can be supplied to the speaker gate. Every observed frame must also retain its word sequence in the full context, so omission of visibly rendered attribution fails closed. A skipped offscreen attribution paragraph fails closed; a single viewport is not complete context. Private validation replays the formatter and verifies byte/clock/candidate/ownership bindings. Stable political semantics exclude asset build hashes and observation times, while full archive integrity remains independently checked. Existing dossier and model-packet limits remain in force. Reported bytes are received response-body bytes, not an operating-system wire trace.

For a missing official candidate website, the separate party discovery proof is not a substitute SOS contact. It verifies the current official roster and missing contact row, the SOS registered party website, that party's exact election/office/full-name campaign anchor, the actual redirect chain and fresh legal publisher. Legal ownership does not establish that every quotation or third-party statement is the candidate's own position.
