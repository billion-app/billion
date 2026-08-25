# Virality markers

Four surfaces that let a reader do something with a record instead of only
reading it: keep it, send it, post it, or be met halfway when they screenshot
it. They share one design rule — **the thing that travels has to be worth
opening on its own**. Nobody forwards an install prompt.

## The shared web preview

Every outbound share points at `/b/<id>` on the web app, never at the App
Store. The page carries the brief itself — summary, what changes, who it lands
on, what it doesn't settle — with the same AI-provenance note the app shows and
a link to the official record. The install ask is at the bottom, after the
reader has been given something.

| Path                | What it is                                              |
| ------------------- | ------------------------------------------------------- |
| `/b/<id>`           | The readable page                                       |
| `/b/<id>` (OG)      | 1200×630 card a link unfurls into, via `next/og`         |
| `/b/<id>/story`     | 1080×1920 PNG for Instagram Stories                     |

`<id>` is either a bare UUID or `<title-slug>-<uuid>`. Only the trailing UUID
is read, so a link shared under a title that has since been corrected still
resolves; `generateMetadata` points `canonical` at the slugged form so search
engines consolidate on one URL without a redirect hop.

The page is public and deliberately builds a tRPC context with **no session**
(`shared-content.ts`): resolving one would add a database round trip to every
link preview to produce a page that looks the same either way.

### The generated images

Both cards live in `share-card.tsx` and are rendered by Satori, so they are
flexbox and inline styles only — no CSS variables, no cascade, and every
container states `display: flex`.

Two constraints are baked into the sizing and are easy to break by accident:

- **The 630px OG canvas cannot scroll.** It is sized for the worst case it has
  to hold: a four-line headline *and* header art. Raising the title size or the
  summary clamp will overflow that case before it overflows the common one.
- **Instagram covers the top and bottom of a story** with its own chrome —
  roughly 250px each at 1080×1920. Everything that has to be read sits inside
  the middle band rather than centred on the canvas.

Header art is only drawn when it is an inline `data:` URI (which is what the
pipeline writes). Satori fetches remote images itself, and a slow thumbnail
host would take the whole card down with it.

Brand fonts are fetched from Google at render time (`_lib/og-fonts.ts`) with an
old User-Agent, because Google serves woff2 to anything modern and Satori
cannot read woff2. Every failure path falls back to Satori's bundled font: a
card in the wrong typeface still previews the link, a missing card does not.

## Saving

The backend, the saved list, and the bookmark UI already existed but were
hidden behind `__DEV__`. They are now shipped, and reachable: the saved list
lives at `/settings/saved-articles`, which the Settings tab does not expose
outside development, so Browse carries its own **Saved** entry point.

`useSavedContent` holds the reader's whole saved set in one query rather than
asking `isSaved` per card — a list screen would otherwise open one request per
row. It is also the single source of truth, so a bill saved on the article page
is already filled in when the reader swipes back to Browse. The bookmark fills
optimistically and rolls back if the write fails.

## Screenshot detection

A screenshot is a reader telling us they want to show this to someone, in the
only way the app has given them. `useScreenshotDetection` catches it on the
article screen and opens the share sheet with different copy — a link travels,
stays readable, and can be attributed; a screenshot does none of that.

The hook **never prompts for a permission.** On Android 13 and below,
`expo-screen-capture` needs the photo-library permission, and asking a civic
app's reader for their photos in order to notice a screenshot is a worse trade
than missing the event. It attaches only where the permission is already
granted: Android 14+ grants `DETECT_SCREEN_CAPTURE` implicitly, and iOS never
needs anything.

Note for whoever ships Android: `expo-screen-capture`'s own manifest declares
`READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE` for older API levels, so those
will appear in the merged manifest and on the Play listing even though we never
request them.

### The version we did not build

[Bluesky puts its logo *into* the screenshot](https://timmarinin.net/2026/bluesky-screenshots/):
a `UITextField` with `isSecureTextEntry` renders a Follow button that iOS blanks
at capture time, revealing branding underneath. It is the better version of
this idea — it marks the image itself rather than reacting after the fact — but
it needs a native module (`expo-privacy-sensitive`) and is iOS-only. Detection
plus a share prompt is what ships today; the branded-capture trick is the
follow-up.

## Sharing to Instagram Stories

There is no supported way to hand an image straight to Instagram Stories
without a custom native module and a pasteboard write. `shareContentStory`
downloads `/b/<id>/story` into the cache and opens the system share sheet on
the file instead — Instagram appears there and offers "Add to story", as does
every other app the reader might post to.

Rendering the card on the server rather than on the phone means it can be
redesigned without an App Store release, and the phone only downloads a PNG.

## Analytics

| Event                       | Fired when                                                |
| --------------------------- | --------------------------------------------------------- |
| `content_saved`             | Bookmark filled                                           |
| `content_unsaved`           | Bookmark cleared                                          |
| `saved_articles_opened`     | Saved list opened, with the surface that opened it        |
| `article_screenshotted`     | Screenshot taken on the article screen                    |
| `content_shared`            | Link actually sent from the system share sheet            |
| `content_share_dismissed`   | Share sheet opened for a link and backed out of           |
| `content_share_sheet_opened`| Story image handed to the share sheet                     |

The story share reports reaching the sheet, not sending: the OS tells us
nothing about what the reader picked, or whether they picked anything.

Inbound attribution is separate. Shares carry
`utm_source=app&utm_medium=share&utm_campaign=<surface>`, and the install call
to action on the shared page goes through the tracked redirect as
`/r?dest=app&p=share_web` — its own campaign, because a reader who arrived from
someone else's link is a different acquisition story from one who came off a
flyer.

## Native dependencies

`expo-screen-capture` and `expo-sharing` are both native modules, so this needs
a new binary build before it reaches devices — an OTA update alone will not
pick them up. See [iOS release builds](./ios-release.md).

### The coupling CI cannot see

`bundle-expo` runs `expo export`, which bundles JavaScript and never compiles
Swift, so a green pipeline says nothing about whether these modules build.

They are genuinely coupled: `expo-screen-capture` calls
`SceneGeometry.keyWindow()`, which lives in `expo-modules-core`. On SDK 56 that
symbol only arrived in `56.0.24` while the tree resolved `56.0.22`, and the iOS
build failed outright with `cannot find 'SceneGeometry' in scope`. SDK 57
satisfies it comfortably — `expo@57.0.16` pulls `expo-modules-core@~57.0.13`,
which has it.

Anything that moves `expo`, `expo-modules-core`, or `expo-screen-capture`
relative to one another needs a real device build to prove it. Note that
Renovate automerges in this repo, so a version bump can land on a green
pipeline without anyone having compiled the result.
