# deploy/big-mac

Configuration for the long-running services on `big-mac` — the Mac that runs the
scrapers and the local image model.

These files are **live infrastructure**, not build output or leftovers. Each one
is the versioned source of something currently installed on that host, so a
change here is a change to a running service.

| file                           | installed as              | what it runs                                                                                                    |
| ------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `com.billion.supervisor.plist` | `~/Library/LaunchAgents/` | The scraper supervisor (`apps/supervisor`), which owns every scheduled and manual job                           |
| `billion-supervisor`           | `~/.local/bin/`           | The wrapper launchd execs — resolves the pinned image, mounts state, runs the container                         |
| `com.billion.flux-api.plist`   | `~/Library/LaunchAgents/` | The local FLUX HTTP server that generates header art when the hosted provider is unavailable                    |
| `Modelfile.billion-scraper`    | `ollama create`           | Pins the local LLM to a 32K context; the full advertised window costs startup latency and memory for no benefit |

## Do not edit these on the host

`scripts/deploy-scraper.mjs` reinstalls `com.billion.supervisor.plist` and
`billion-supervisor` from this directory on **every** deploy. An edit made
directly on `big-mac` is overwritten by the next one and is invisible to code
review — which is how a build of an unmerged branch once ended up running the
production backfills.

```sh
pnpm deploy:scraper            # deploy current origin/main
pnpm deploy:scraper --dry-run  # check without touching the host
```

The FLUX plist and the Modelfile are installed by hand; they change rarely and
have no deploy step of their own.

## Why the supervisor files live here rather than in `apps/supervisor/`

They were briefly under `apps/supervisor/deploy/`, which put two conventions in
the repo for the same kind of thing — host configuration. Anything describing
what runs on `big-mac` belongs in one place, next to the FLUX plist that was
already here.

## Optional local fallback

The scraper accepts an OpenAI **Responses-compatible** fallback URL. The endpoint
must support structured output and native web search for the complete article
pipeline. The scraper has no OAuth logic and does not read Codex credentials;
a separately managed proxy owns login and credential refresh.

After starting the proxy on `big-mac`, add these entries to that host's
`~/.config/billion/scraper.env`:

```sh
SCRAPER_FALLBACK_BASE_URL='http://host.docker.internal:10531/v1'
SCRAPER_FALLBACK_MODEL='gpt-6-luna'
# SCRAPER_FALLBACK_API_KEY='...'  # Only if your proxy requires a bearer token.
```

Unset the URL to disable the fallback. Existing primary providers keep their
priority. A fallback can also run alone if no primary is configured. Local
Ollama inference is configured separately with `LOCAL_LLM_BASE_URL`.

For the community `openai-oauth` proxy, log into Codex on `big-mac` using that
machine's account, then start `npx openai-oauth@latest --detach` there. See the
[proxy documentation](https://github.com/EvanZhouDev/openai-oauth#openai-oauth-cli)
for login, status, and shutdown commands. Login stays on the host; do not mount
its auth file into scraper containers.

The supervisor runs in OrbStack, so `127.0.0.1` inside the scraper is the
container, not the Mac. Verify `/v1/models` is reachable at the configured URL
from inside the container and lists the selected model before enabling jobs.
Host loopback forwarding depends on the container runtime; if it is not
reachable, configure host-to-container forwarding with access restricted to the
container. A host process outside Docker instead uses
`http://127.0.0.1:10531/v1`.

Deploy the code through the normal scraper release process and restart the
supervisor to pick up changed environment values. This code change does not
install a proxy service or enable the fallback on any host. HTTP failures and
connection errors trigger fallback; invalid generated content still goes
through the existing schema/content checks. An in-flight stream is not replayed
if it fails after streaming has started. Existing token-cost estimates use the
configured LLM prices, not a separate OAuth subscription accounting model.
