# Billion social media agent

This package captures the Expo web app with Playwright, generates Instagram-ready
post folders, and can optionally post them through the Instagram browser flow.

Start the Expo web app first, then run from the repository root:

```sh
pnpm --filter @acme/social-media-agent instagram -- --category browse --count 3
pnpm --filter @acme/social-media-agent instagram -- --category feed --count 3
pnpm --filter @acme/social-media-agent instagram -- --category article --article-id <id>
```

Add `--post --no-headless` to the Instagram command to open the browser and post
the generated folders. The default app origin is `http://localhost:8081`; set
`BASE_URL` to override it. Generated screenshots and post folders stay under
`packages/social-media-agent/` regardless of the directory the command is run from.
