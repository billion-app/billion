# Troubleshooting

Known failure modes and their fixes. See also the quick notes in the [README](../README.md#troubleshooting).

## Expo / native build issues

### `pnpm run ios` crashes immediately

The monorepo has transitive peer deps (via `@better-auth/expo`) that pull in expo 55 packages, which can win pnpm's hoist election over expo 53's versions and cause crashes like:

- `ERR_PACKAGE_PATH_NOT_EXPORTED` — metro 0.83 hoisted instead of 0.82
- `Cannot read properties of undefined (reading 'push')` — `metro-core` 0.83 hoisted, breaking `Terminal` API
- `Cannot read properties of undefined (reading 'transformFile')` — `@expo/metro` 55 hoisted

These are fixed by the overrides in `pnpm-workspace.yaml` which pin `metro*`, `@expo/metro`, and `@expo/metro-config` to expo 53-compatible versions. If you ever see these errors after updating dependencies, check that the overrides haven't been removed.

### "Cannot find native module 'X'" / version mismatch warnings

**Symptoms**: Errors like `Cannot find native module 'ExpoGlassEffect'` or `Mismatch between C++ code version and JavaScript code version`

**Cause**: A native module is installed but the native binary hasn't been rebuilt to include it. This happens after adding a package with native code, upgrading Expo SDK, or running `pnpm install` without rebuilding.

**Solution**: Do a full native rebuild from `apps/expo/`:

```bash
pnpm ios   # or pnpm android
```

This runs prebuild + pod install + compiles the native project automatically. `expo start --clear` alone is not enough for native module errors.

### Always open the workspace, not the project

Open `ios/billion.xcworkspace` — never `ios/billion.xcodeproj`. The `.xcodeproj` alone won't include CocoaPods dependencies and the build will fail to link.

## TypeScript

### Errors about missing `.js` extensions in `packages/db`

**Symptoms**: `tsc` in `apps/scraper` reports errors like:

```
../../packages/db/src/client.ts(4,25): error TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'.
```

**Cause**: The scraper uses `moduleResolution: "NodeNext"` which requires `.js` extensions on relative imports. When `packages/db/dist/` exists (with compiled `.d.ts` files), TypeScript resolves from those and everything is fine. When `dist/` is missing (e.g. in a fresh clone or git worktree), TypeScript falls back to the source `.ts` files and complains.

**Solution**: Build the db package first:

```bash
pnpm -F @acme/db build
```

## Localtunnel issues

### Expo app can't connect to the tunnel

**Symptoms**: Network errors, timeout, or "Failed to fetch" errors

**Solutions**:

1. Verify the tunnel is running (`lt --port 3000`)
2. Check the URL in your browser first — you may need to click "Click to Continue" on the warning page (once per IP)
3. Ensure `EXPO_PUBLIC_API_URL` is set correctly in `.env`
4. Restart your Expo dev server after changing environment variables
5. Clear Expo cache: `pnpm --filter expo start -c`

### "CORS error" or "Blocked by CORS policy"

The Next.js server already has CORS enabled (`Access-Control-Allow-Origin: *`). If you still see CORS errors:

1. Check that you're using the full URL including `https://`
2. Ensure you're not mixing HTTP and HTTPS
3. Verify the tunnel is working by visiting the URL in a browser

### Authentication doesn't work

**Symptoms**: Session cookies not persisting, logged out after refresh

**Solutions**:

1. Check that your `AUTH_SECRET` is set in `.env`
2. Ensure cookies are enabled in your app (better-auth handles this automatically)
3. Verify the localtunnel URL uses HTTPS (required for secure cookies)
4. Check `AUTH_REDIRECT_PROXY_URL` if using OAuth providers

### Random disconnections or tunnel stops working

1. localtunnel connections can be unstable — consider [ngrok or another alternative](./localtunnel.md#alternative-ngrok-more-reliable)
2. Use a fixed subdomain to maintain consistent URLs
3. Keep the tunnel terminal window open
