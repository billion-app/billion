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

Tavily searches share a process-wide budget of ten uncached attempts by default
(`SCRAPER_TAVILY_MAX_SEARCHES_PER_RUN`). Concurrent identical queries reuse one
request and successful results stay cached for that job. Failed searches also
count against the attempt budget. Before the first search, the job reads Tavily's
account usage and stops at the smaller of the provider's remaining credits and
the configured monthly ceiling (`SCRAPER_TAVILY_MONTHLY_CREDIT_LIMIT`, default
800). This reserves 200 credits on the Researcher plan. Zero disables searches.
The usage check fails closed; a budget stop never activates another search
provider. Account usage is a starting snapshot, so separate processes or other
applications sharing the account can spend concurrently. These limits conserve
quota; they do not guarantee full research coverage or spread usage evenly over
the month. A bill brief can still use official text when optional research is
unavailable, while perspectives without supporting citations remain absent.

In `tavily` mode, exhausted credits or an invalid key fail the search without
switching to a paid provider. Text generation retains its separate provider
order, including the OAuth fallback. Search returns source URLs and snippets;
the research agent must still open sources before citing their contents.

The default `hosted` mode retains the existing hosted search. If a Tavily key is
configured in that mode, Tavily is tried after hosted search fails and before
the Responses endpoint's native-search fallback. Deploy a merged image and
restart through the usual deployment script to activate host settings.
