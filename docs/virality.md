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

It is **the app's article screen with blocks removed**, not a second design:
same navy canvas, same serif headline, same accent-bordered summary card, same
before/after change cards, same four-hue outcome palette where colour is a
navigation aid rather than a verdict and never the only signal. Someone who
follows the install prompt should recognise where they landed. What it drops is
everything needing interaction or depth — the dual lens, the timeline, the
glossary, the deep dive — because this page's job is to be skimmed and
forwarded, then finished in the app or on the source.

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
link preview to produce a page that looks the same either way. A missing id
becomes a 404; every other failure is rethrown so it reaches the logs rather
than being dressed up as a missing page.

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

Saving does not require an account, and deliberately so: bookmarking something
to come back to is not a social act, and account creation isn't built yet — a
server-backed bookmark would mean no bookmarks at all.

The set lives on the device (`utils/saved-store.ts`, AsyncStorage) as an
ordered list, newest first, capped at 200 so the saved screen can hydrate it in
one request. The list rules are pure functions so they can be tested without a
device; only a thin async pair touches disk. A corrupt or wrongly-shaped store
reads as "nothing saved" rather than throwing — a bad bookmark list must not
stop the app opening — and a failed write is swallowed, because the cost is a
bookmark that doesn't survive a restart, not an error on a tap.

`useSavedContent` holds that set in one React Query cache entry so every screen
agrees: a bill saved on the article page is already filled in when the reader
swipes back to Browse, and a list screen reads it once instead of asking per
card. The bookmark fills the instant it is tapped and the disk write follows.

The saved screen arrives holding ids and no session, so `content.byIds`
hydrates them — public for that reason, and it returns rows in the order asked
for, which is save order. Ids with no row are dropped rather than held as
holes, since content can be retired after someone saved it.

The server-side `SavedArticle` table and its procedures are left in place for
app builds already on people's phones. When accounts land, the device list is
what should be synced up.

The saved list lives at `/settings/saved-articles`, which the Settings tab does
not expose outside development, so Browse carries its own **Saved** entry point.

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

Instagram's documented handoff is a pasteboard write plus a URL open: the image
goes on the general pasteboard under `com.instagram.sharedSticker.*` keys, and
opening `instagram-stories://share?source_application=<id>` tells Instagram to
read it. Those are custom pasteboard types, so it cannot be done from
JavaScript — hence the local module at `modules/instagram-story`.

With Instagram installed, "Share as an image" drops the reader straight into
the story composer with the card already placed. Without it — or on anything
that isn't iOS — the same file goes to the system share sheet instead, which is
what the module reports by resolving `false` rather than throwing.

Two things the module has to get right:

- **`LSApplicationQueriesSchemes`** must list `instagram-stories`, or
  `canOpenURL` answers false and the app concludes Instagram isn't installed.
  The app config declares it.
- **The pasteboard item carries an expiry.** A story the reader opens and never
  posts should not leave the image sitting in their clipboard.

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
