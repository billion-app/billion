# deploy/big-mac

Configuration for the long-running services on `big-mac` — the Mac that runs the
scrapers and the local image model.

These files are **live infrastructure**, not build output or leftovers. Each one
is the versioned source of something currently installed on that host, so a
change here is a change to a running service.

| file | installed as | what it runs |
| --- | --- | --- |
| `com.billion.supervisor.plist` | `~/Library/LaunchAgents/` | The scraper supervisor (`apps/supervisor`), which owns every scheduled and manual job |
| `billion-supervisor` | `~/.local/bin/` | The wrapper launchd execs — resolves the pinned image, mounts state, runs the container |
| `com.billion.flux-api.plist` | `~/Library/LaunchAgents/` | The local FLUX HTTP server that generates header art when the hosted provider is unavailable |
| `Modelfile.billion-scraper` | `ollama create` | Pins the local LLM to a 32K context; the full advertised window costs startup latency and memory for no benefit |

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
