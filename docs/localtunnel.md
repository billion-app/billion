# Localtunnel Setup

How to expose your local dev server to the internet with [localtunnel](https://localtunnel.github.io/www/) so you can test the Expo app on a physical device (or share a build) without deploying.

**TL;DR**

1. **What to expose**: Only port 3000 (Next.js server)
2. **Command**: `lt --port 3000 --subdomain billion-dev`
3. **Environment variable**: `EXPO_PUBLIC_API_URL=https://billion-dev.loca.lt`
4. **Restart**: Expo dev server after changing environment
5. **Browser**: Visit the URL once to whitelist your IP

## What needs to be exposed

Only the Next.js server. It handles the tRPC API (`/api/trpc`), auth (`/api/auth`), the web frontend, and all business logic.

| Service            | Port | Needs public access    |
| ------------------ | ---- | ---------------------- |
| **Next.js server** | 3000 | ✅ YES                 |
| PostgreSQL         | 5432 | ❌ NO (internal only)  |
| Drizzle Studio     | 5555 | ❌ NO (local dev only) |

## Setup

1. **Install:** `npm install -g localtunnel`
2. **Start the dev server** from the project root: `pnpm dev` (Next.js on `http://localhost:3000`)
3. **Open a new terminal and create the tunnel:**

   ```bash
   lt --port 3000 --subdomain billion-dev
   # your url is: https://billion-dev.loca.lt
   ```

   - `--subdomain` is optional but recommended for a consistent URL (otherwise you get a random one each time)
   - The first time you visit the URL in a browser you'll see a warning page — click "Click to Continue" to whitelist your IP (once per IP)
   - Keep this terminal open; closing it stops the tunnel

4. **Point the Expo app at the tunnel** in `.env` (or `.env.local`) at the project root:

   ```bash
   EXPO_PUBLIC_API_URL=https://billion-dev.loca.lt
   ```

   The `EXPO_PUBLIC_` prefix is required for Expo to expose the variable to the client.

5. **Restart the Expo dev server** (Ctrl+C, then `pnpm dev` again) so the new env var takes effect.

## How the Expo app picks its API URL

1. **If `EXPO_PUBLIC_API_URL` is set**: uses that URL (localtunnel or production)
2. **Otherwise**: auto-detects your local IP and uses `http://<local-ip>:3000`

See `apps/expo/src/utils/base-url.ts` for the implementation.

```
Expo app ── HTTPS (tRPC) ──▶ https://billion-dev.loca.lt ── tunnels to ──▶ localhost:3000 (Next.js)
                                                                              ├── tRPC Router
                                                                              ├── Auth API
                                                                              └── SQL ──▶ Postgres
```

## Environment variables reference

```bash
# .env (project root)
EXPO_PUBLIC_API_URL=https://billion-dev.loca.lt   # Your localtunnel URL
POSTGRES_URL=postgresql://user:pass@localhost:5432/dbname

# Optional
PORT=3001                                          # Override Next.js port if 3000 is taken
AUTH_REDIRECT_PROXY_URL=https://your-production-url.com  # OAuth redirect proxy (production)
```

## Alternative: ngrok (more reliable)

localtunnel connections can be unstable. ngrok is a solid alternative (others: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/), [Tailscale](https://tailscale.com/)):

```bash
brew install ngrok                          # or https://ngrok.com/download
ngrok config add-authtoken YOUR_AUTH_TOKEN  # after signing up
ngrok http 3000
# then: EXPO_PUBLIC_API_URL=https://abc123.ngrok.io
```

## Production

In production there's no tunnel: Next.js deploys to Vercel, and the Expo app is built with `EXPO_PUBLIC_API_URL` set to the production URL (see [iOS release builds](./ios-release.md)).

## Security considerations

- localtunnel exposes your local dev server to the public internet — anyone with the URL can hit your API
- Your authentication secrets stay in environment variables; **never commit** your `.env` or expose your `AUTH_SECRET`
- Consider ngrok's password protection for sensitive development

Connection problems (timeouts, CORS, auth/cookie issues, random disconnects) are covered in [Troubleshooting](./troubleshooting.md#localtunnel-issues).
