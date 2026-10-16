# Listen and languages (mobile)

Status: proposed work, in progress on branch `feat/listen-and-languages`.

Two reader features for the Expo app:

1. **Listen**: a button in the article reader that reads the article aloud.
2. **Language**: a Settings choice of English, Español, or 中文 (Simplified)
   that changes the app's own text and translates articles.

Decisions taken with the product owner on 2026-10-15: translate both UI and
articles; mobile only (the Next.js reader is out of scope).

## Listen

**Engine: `expo-speech`.** It drives the phone's built-in speech engine
(AVSpeechSynthesizer on iOS, the system TTS service on Android). These are
on-device neural voices, so speech is free, works offline, sends no article
text anywhere, and already covers `en`, `es`, and `zh`. A bundled open model
such as Kokoro or Piper would add tens of megabytes and an ONNX runtime for
little gain over Apple's enhanced voices; we can revisit it if voice quality
is a complaint.

`expo-speech` is a native module. **It changes the native fingerprint, so it
needs a new TestFlight/App Store binary; it cannot ship as a production OTA.**
The reader hides the button when the module is not linked
(`requireOptionalNativeModule`), so an OTA onto an old binary degrades
instead of crashing.

Pieces:

- `apps/expo/src/utils/speech-script.ts` (pure, tested): turns the visible
  article (title, description, brief or markdown explainer) into plain
  sentences and splits them into chunks under the engine's input limit.
  Markdown, bold markers, links, and URLs are stripped. Source quotes are not
  read inside the explainer; "Original text" mode reads the source.
- `apps/expo/src/hooks/useArticleSpeech.ts`: plays chunks in order through
  `Speech.speak` with `onDone` advancing. Pause is implemented as stop plus a
  remembered chunk index, because Android has no pause. Picks the best
  installed voice for the language (enhanced quality first). Stops on blur,
  unmount, mode change, and language change.
- Article reader: a headphones button in the `NavHeader` actions and a small
  player bar (play/pause, stop, "Part n of m") pinned above the bottom inset.

## Language

### App text

No new i18n dependency. `apps/expo/src/i18n/`:

- `strings.ts`: an English dictionary typed `as const`; `es.ts` and `zh.ts`
  are `Partial` of the same keys, so a missing translation falls back to
  English rather than showing a key.
- `language.ts` (pure, tested): `AppLanguage = "en" | "es" | "zh"`, the
  device-locale default via `expo-localization`, and BCP-47 tags for speech.
- `LanguageProvider` + `useLanguage()` / `useT()`: persisted in AsyncStorage
  like other reader preferences.

First pass covers the tab bar, Settings, the language picker, and the article
reader. Other screens keep English until translated; the fallback makes that
safe to ship incrementally.

### Articles

New public procedure `content.getTranslation({ id, language })`:

- Loads the same English payload as `getById` (the body is extracted into a
  shared loader rather than duplicated).
- Translates only Billion-authored prose: title, description, the AI
  explainer, and an allowlist of brief fields (bill: summary, hook, facts,
  changes title/before/after, affected, unknowns, terms, context summary and
  points, deep dive, reading "why read"; court: point text, posture, effect
  groups, unknowns, terms).
- **Never translates source text**: verbatim quotes, locators, the original
  bill/court text, headlines and publishers of cited articles, and URLs stay
  as written. Quotes must stay verbatim because "View source" finds them in
  the original text. The reader labels translated content as machine
  translated and keeps "Original text" in English.
- Caches the result in a new `content_translation` table keyed by
  `(content_id, language)` with a `source_hash` of the English input, so
  the LLM runs once per article per language and re-runs only when the
  English changes. Concurrent requests for the same key share one promise.
- Uses the existing `llm` provider from `packages/api/src/lib/ai-provider.ts`.
  With no provider configured it returns `{ status: "unavailable" }` and the
  reader stays in English with a notice.

The reader renders English immediately, shows "Translating…", then swaps in
the translation. Listen reads whichever language is on screen.

Schema change ships as a committed Drizzle migration (`pnpm db:generate`).

## Verification

- Unit tests: speech script chunking/stripping, language defaults, translation
  segment collect/apply (quotes and URLs untouched, shape preserved).
- `pnpm -F @acme/api typecheck test`, `pnpm -F @acme/expo typecheck lint test`,
  `pnpm -F @acme/db` migration check.
- Device check of speech needs a dev-client build that includes `expo-speech`.

## Out of scope for today

- Next.js `/read/[id]` reader.
- Translating perspectives (lens) panels, Browse cards, and election screens.
- Server-generated audio.
