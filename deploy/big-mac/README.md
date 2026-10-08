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

## Optional OAuth-backed fallback

The scraper can use a Responses-compatible proxy on this host after its usual
providers fail. The proxy owns login and token refresh; scraper containers do
not receive OAuth credentials. Keep the proxy running across logouts and host
restarts using its own service configuration.

Add these settings to `~/.config/billion/scraper.env`:

```dotenv
SCRAPER_FALLBACK_BASE_URL=http://host.docker.internal:10531/v1
SCRAPER_FALLBACK_MODEL=gpt-6-luna
```

The container's `127.0.0.1` refers to itself. Verify the host endpoint from the
running container before enabling it; OrbStack exposes the host through
`host.docker.internal`. The model must appear in the proxy's `/v1/models`.
`SCRAPER_FALLBACK_API_KEY` is optional for proxies requiring a bearer token.

Deploy a merged image containing the fallback support using the command above.
The supervisor forwards these environment variables to jobs on restart.
Leaving the URL unset disables this fallback. It covers text and structured briefs. Search fallback requires native search
support from the endpoint and rejects responses without URL citations. The
current OAuth proxy with Luna passed live text and JSON checks but did not expose
native web search; the ordinary hosted search providers are still required. It does not replace image generation
or vision review. Adding the fallback does not invalidate existing lens caches.

## Free-tier search with Tavily

For search independent of the OAuth model's native tools, add a Tavily API key
from [the Tavily dashboard](https://app.tavily.com) to `scraper.env` and select
Tavily explicitly:

```dotenv
TAVILY_API_KEY='your-private-api-key'
SCRAPER_SEARCH_PROVIDER=tavily
```

Use the free Researcher account with pay-as-you-go disabled. Tavily currently
includes [1,000 monthly credits](https://www.tavily.com/pricing). Each scraper
search requests `basic` depth with automatic parameter selection disabled,
which uses one credit, and at most five results. This does not guarantee that
1,000 credits cover every scheduled job; a research loop may search repeatedly.

In `tavily` mode, exhausted credits or an invalid key fail the search without
switching to a paid provider. Text generation retains its separate provider
order, including the OAuth fallback. Search returns source URLs and snippets;
the research agent must still open sources before citing their contents.

The default `hosted` mode retains the existing hosted search. If a Tavily key is
configured in that mode, Tavily is tried after hosted search fails and before
the Responses endpoint's native-search fallback. Deploy a merged image and
restart through the usual deployment script to activate host settings.

## Private SearXNG trial

The [pinned Compose service](searxng/compose.yaml) exposes JSON search only on
loopback port 8888. Its [engine settings](searxng/settings.yml) use upstream web
engines, so rate limits, CAPTCHAs and irrelevant results remain possible. This
service does not replace the scraper supervisor or resume paused jobs.

Copy the `searxng` directory to `~/.config/billion/searxng` on Big Mac and create
an ignored private `.env` containing `SEARXNG_SECRET` (a random 32-byte hex secret).
Do not commit that value. Start and inspect the service from that directory:

```sh
docker compose up -d
docker compose logs --tail 50
docker compose down
```

Run the [bounded comparison](../../apps/scraper/README.md#search-research-verification)
before selecting it for production. For a local trial of the Big Mac endpoint,
forward its loopback port over SSH:

```sh
ssh -N -L 18888:127.0.0.1:8888 big-mac
```

Use `SCRAPER_SEARXNG_BASE_URL=http://127.0.0.1:18888` from the local checkout.
A successful JSON response is not enough: inspect readable pages, relevance to
the specific bill, and coverage of the requested evidence. Keep Tavily as an
explicit alternative if the trial is weak; there is no automatic paid fallback.

After a successful trial, the scraper container can use these settings in its
private `scraper.env`:

```dotenv
SCRAPER_SEARCH_PROVIDER=searxng
SCRAPER_SEARXNG_BASE_URL=http://host.docker.internal:8888
```

Apply the research-library migration and deploy a merged scraper image before
resuming jobs. Provider selection, schema application, deployment and resumption
are separate operations. See [shared research](../../docs/scraper-research.md)
for cache behavior and provenance.
