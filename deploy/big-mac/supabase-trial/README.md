# Run a private production copy on Big Mac

The trial runs Billion's database, image storage, and web/API app on Big Mac.
It uses its own Docker project, credentials, data directories, and loopback
ports. Production keeps its existing database, Vercel deployment, and scraper
configuration. No scraper or notification worker runs against the copy.

The app checkout is pinned to `2002ecd040f9ae69b21edb9dd5fd3594e2277936`.
The Supabase Docker files are pinned to
[`self-hosted/v0.8.3`](https://github.com/supabase/supabase/tree/self-hosted/v0.8.3/docker),
commit `bc27d2661edd09a5d0b8d76ce33da6d4071a756e`, with Postgres 17.6.

## Open the existing trial

Forward the app and Supabase gateway from your computer:

```sh
ssh -N -L 127.0.0.1:3006:127.0.0.1:3006 -L 127.0.0.1:8006:127.0.0.1:8006 big-mac
```

Open [Browse](http://127.0.0.1:3006/browse). The
[Supabase dashboard](http://127.0.0.1:8006) requires the dashboard credentials
in Big Mac's private `~/.config/billion/supabase-trial/.env`.

The app has a new Better Auth secret and a database login scoped to the trial.
That server login has grants on the copied application tables and `BYPASSRLS`,
matching the production backend's ability to read cached enrichment. Table
grants alone hide some copied records because their row-level policies target
other roles. The login has no production credentials.
Production integration credentials are absent, so OAuth, email, civic provider
requests, and new AI generation do not reproduce production behavior. Stored
content and cached explanations come from the database snapshot. Browser
analytics points to a local inactive endpoint.

## Inspect or stop services

On Big Mac, inspect the stack and app:

```sh
cd ~/.config/billion/supabase-trial
docker compose ps
launchctl print gui/$(id -u)/com.billion.supabase-trial-app
tail -50 app.stderr.log
```

Postgres listens on `127.0.0.1:5440`. The optional session and transaction
poolers listen on `127.0.0.1:5441` and `127.0.0.1:6548`. The app uses direct
Postgres, just as Billion uses the Node PostgreSQL driver in production.

To stop the trial while preserving its data:

```sh
launchctl bootout gui/$(id -u)/com.billion.supabase-trial-app
cd ~/.config/billion/supabase-trial
docker compose down
```

To restart it:

```sh
cd ~/.config/billion/supabase-trial
docker compose up -d --wait
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.billion.supabase-trial-app.plist
```

## Inspect the snapshot and finish the image copy

The private `backup/` directory contains the compressed database dump,
`manifest.json`, `database-verified.json`, and `storage-status.json`.
The dump includes `public` and `drizzle`, which hold Billion's application
records, Better Auth tables, and applied migration history. Platform-owned
Supabase schemas are initialized by the fresh stack. Storage bucket settings
and object paths are captured separately in the same source snapshot.

`clone-database.mjs` takes a read-only, repeatable snapshot through production's
session pooler. It compares exact counts for every restored table against that
snapshot. It refuses a destination that already contains application tables
and preserves an existing dump. A failed restore rolls back its transaction;
rerunning can reuse a complete dump and manifest without another export.

As of October 20, 2026, the 50 restored tables match their snapshot counts.
The source's egress restriction returns HTTP 402 for image reads, so the 2,215
image files remain uncopied. The trial bucket settings and application image
paths are present. Those image URLs return missing-object responses until the
files are transferred. The destination passed upload, public download,
checksum, and deletion checks using a temporary test bucket.

After source Storage access is restored, run this on Big Mac:

```sh
node ~/.config/billion/supabase-trial/copy-storage.mjs ~/.config/billion/supabase-trial
```

The script uploads through the Storage API so the destination creates both
object metadata and file bytes. It verifies each copied file by checksum and
skips existing files whose checksums match their immutable paths. HTTP 402
stops the copy and records the blockage with exit code 2. It never regenerates
artwork or changes production objects. See Supabase's
[database restore guide](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
and [Storage transfer guide](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3)
for the distinction between database metadata and object bytes.

## Reproduce the initial setup

Use a fresh private directory. The preparation scripts refuse existing
credentials or application data. These commands assume the existing trial
has been stopped and its directory retained elsewhere. Do not reuse its ports
or container names for another running stack.

On your computer, fetch the pinned upstream files and copy the configuration:

```sh
git clone --depth 1 --filter=blob:none --sparse --branch self-hosted/v0.8.3 https://github.com/supabase/supabase.git /tmp/billion-supabase-upstream
git -C /tmp/billion-supabase-upstream sparse-checkout set docker
scp -r /tmp/billion-supabase-upstream/docker big-mac:.config/billion/supabase-trial
scp deploy/big-mac/supabase-trial/*.mjs deploy/big-mac/supabase-trial/*.plist deploy/big-mac/supabase-trial/compose.override.yaml big-mac:.config/billion/supabase-trial/
```

On Big Mac, initialize credentials, start Postgres, and restore the database:

```sh
cd ~/.config/billion/supabase-trial
node prepare.mjs "$PWD"
docker compose up -d --wait db
node clone-database.mjs "$PWD"
docker compose up -d --wait
node copy-storage.mjs "$PWD"
```

The last command can exit with code 2 while source Storage is restricted.
The database and app can still be tested.

Create the app checkout and its private configuration on Big Mac:

```sh
git -C ~/Developer/billion fetch origin 2002ecd040f9ae69b21edb9dd5fd3594e2277936
git -C ~/Developer/billion worktree add --detach ~/.config/billion/supabase-trial/app 2002ecd040f9ae69b21edb9dd5fd3594e2277936
cd ~/.config/billion/supabase-trial
node prepare-app.mjs "$PWD"
cd app
pnpm install --frozen-lockfile
pnpm --filter @acme/nextjs build
```

Install the app's launch agent:

```sh
sed "s|__TRIAL_ROOT__|$HOME/.config/billion/supabase-trial|g" ~/.config/billion/supabase-trial/com.billion.supabase-trial-app.plist > ~/Library/LaunchAgents/com.billion.supabase-trial-app.plist
plutil -lint ~/Library/LaunchAgents/com.billion.supabase-trial-app.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.billion.supabase-trial-app.plist
```

Keep the trial directory private. Its dump and manifest contain production
data, and its environment files contain server credentials. The source
connection file used by the dump is removed when the clone command exits.
The Supabase REST API exposes the empty `trial_api` schema rather than the
cloned application tables. The Billion app accesses those tables through
its server database login and tRPC.
