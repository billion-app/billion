# Billion social media agent

This package captures the Expo web app with Playwright, generates Instagram-ready
post folders, and can optionally post them through the Instagram browser flow.

It also renders human-led, vertical marketing videos from presenter footage,
timed captions, app recordings, and approved cutaways. Start with the full
[marketing video playbook](../../docs/marketing-video-playbook.md).

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

Create and render a video project from the repository root:

```sh
pnpm --filter @acme/social-media-agent video init \
  packages/social-media-agent/video-projects/2026-07-10-topic

pnpm --filter @acme/social-media-agent video render \
  packages/social-media-agent/video-projects/2026-07-10-topic
```

FFmpeg and ffprobe are required. Supply a reviewed SRT file, or omit `captions`
from `project.json` and configure `GEMINI_API_KEY` for automatic timed
transcription. The render command writes an upload-ready MP4, a final SRT, and a
technical QA report; human factual and rights review remains mandatory.
