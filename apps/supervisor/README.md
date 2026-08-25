# @acme/supervisor

Runs the Billion scrapers on `big-mac`, one job at a time.

## Why this exists

The scrapers used to be driven by four near-identical zsh scripts in
`~/.local/bin` on the host, started by hand over SSH. On 2026-07-28 three
backfills died the moment the SSH session that launched them closed — one had
logged a single header line and no iterations. Nothing noticed, and the archive
drain those jobs existed to perform did not happen.

Three properties follow from that, and they are what this app is for:

- **Jobs outlive the shell that started them.** launchd owns the supervisor
  (`KeepAlive`), the supervisor owns the jobs. Closing a terminal changes
  nothing; so does a reboot.
- **Only one job runs at a time, structurally.** Each old script re-implemented
  `docker container inspect <other-job>` to avoid overlap, which was O(n²) in
  scripts and silently wrong for any job nobody remembered to add. There is now
  one runner and one queue.
- **Scheduling is code.** Intervals, priorities, timeouts, budgets and backoff
  live in `src/config.ts`, get typechecked, and are covered by tests — instead
  of being encoded in `sleep` calls and `grep` on another process's stdout.

## Jobs

Defined in `src/config.ts`. Each names a script in the scraper's `dist/` and
the arguments it takes; the supervisor supplies everything else.

| id                             | schedule          | notes                                                                            |
| ------------------------------ | ----------------- | -------------------------------------------------------------------------------- |
| `congress-daily`               | daily 03:15 local | Refreshes and retains the 80 most recently updated federal bills                 |
| `open-states-{ca,nc,tx}-daily` | daily 03:30 local | Refreshes and retains the 100 most recently updated measures per supported state |
| `federalregister-weekly`       | Sundays 03:15     | Executive orders and presidential documents                                      |
| `scc-cvig-weekly`              | Sundays 03:15     | Santa Clara County voter guide                                                   |
| `ca-sos-weekly`                | Sundays 03:15     | California SoS candidate statements                                              |
| `retro-briefs`                 | manual            | Fills in missing structured briefs                                               |
| `retro-lenses`                 | manual            | Fills in missing dual-lens perspectives                                          |

The federal and state daily jobs are the point of the whole arrangement: the
app is a news feed, so a bill whose status changed today matters more than one
introduced in early 2025 that nothing has touched since. They re-read the head
of their update feeds every day and do not use `scraper_cursor` at all. State
jobs are isolated so an upstream failure in one jurisdiction cannot prevent the
other states from refreshing.

Know the tradeoff: these cover the _head_ of each feed, not all of it. Roughly
250 House bills are updated upstream per day, so an 80-bill window sees the most
recent activity rather than every change. Widen a window by raising `--recent`.

There is deliberately **no scheduled archive backfill**. The cursor walk starts
near the beginning of the congress (~17,000 measures), and each bill it enriches
pays for a brief and a dual-lens research loop. The retro jobs are
manual for the same reason — filling in the archive is a supervised spend, not
something a scheduler starts at 3am.

The three weekly scrapers are listed individually rather than as one `main.js
all` run, so that dropping `all` (which would drag the cursor walk back in)
cannot silently stop them.

The federal refresh applies an 80-row retention cap. Each state refresh applies
its own 100-row cap.
Ranking and deletion happen inside PostgreSQL and return only aggregate counts,
so retention does not download candidate rows from Supabase. Jurisdictions are
capped independently, so federal activity cannot displace a state's measures.
The manual `prune-bills` command remains available as a read-only-by-default
repair tool. PostgreSQL autovacuum makes freed space reusable; reported physical
disk size may not fall immediately after deletion.

A job that has never run fires immediately if it is interval-based, and waits
for its next occurrence if it is on a calendar schedule — deploying at 4pm must
not kick off the overnight run. A calendar job whose last run predates the most
recent occurrence _is_ due, so an outage over the scheduled time is caught up
rather than skipped.

## Operating it

```sh
# Deploy the current origin/main (refuses anything not merged)
pnpm deploy:scraper

# Check first, without touching the host
pnpm deploy:scraper --dry-run

# Watch it
ssh big-mac 'tail -f ~/Library/Logs/billion/supervisor.log'

# What ran, when, and what failed
ssh big-mac 'cat ~/.local/state/billion/supervisor-state.json'

# Run a job now, without waiting for its schedule
```

Requests are a directory rather than a socket or an HTTP port: no client is
needed, they survive a supervisor restart, and they are inspectable over SSH,
which is how this host is actually operated.

## Deployment model

```
push to main → CI (lint · format · typecheck · test) → ghcr.io/billion-app/billion-scraper:<sha>
                                                     → big-mac pulls; it never builds
```

`scripts/deploy-scraper.mjs` refuses any commit that is not an ancestor of
`origin/main`, so an unmerged branch has no path to production. It also
reinstalls the launchd plist and the wrapper from this repo on every deploy —
the host should never carry a hand-edited copy.

The image pin lives in exactly one place, `~/.config/billion/deploy.env`. It is
written only by the deploy script.

## Failure handling

A failed job backs off from 15 minutes, doubling, capped at a day — so a
permanently broken job costs one attempt a day rather than one per tick. Any
success resets the counter. State is written before a job starts as well as
after it finishes, so a host that loses power mid-job does not restart it
immediately and stack a second copy on whatever the first one left behind.

Jobs have hard timeouts (`timeoutMinutes`). A job that ignores `SIGTERM` gets
`SIGKILL` 30 seconds later, because a wedged job blocks the single queue.
