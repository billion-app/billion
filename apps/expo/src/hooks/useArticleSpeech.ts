/**
 * Reads an article aloud with the phone's own speech engine (`expo-speech`):
 * on-device voices, no network, no cost.
 *
 * Text arrives pre-split by `buildSpeechChunks`; each chunk is spoken in turn
 * and `onDone` advances to the next. Pause is stop-and-remember rather than
 * the engine's pause, which Android does not support, so both platforms
 * behave the same and resume from the start of the current chunk.
 *
 * `expo-speech` is a native module. Builds made before it was added do not
 * contain it, and importing it there throws, so it is required lazily and the
 * feature reports itself unavailable instead.
 */
import type * as ExpoSpeech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AppLanguage } from "~/i18n/language";
import { posthog } from "~/config/posthog";
import { speechLanguageTag } from "~/i18n/language";

type SpeechModule = typeof ExpoSpeech;

let speechModule: SpeechModule | null | undefined;

function loadSpeech(): SpeechModule | null {
  if (speechModule !== undefined) return speechModule;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    speechModule = requireOptionalNativeModule("ExpoSpeech")
      ? (require("expo-speech") as SpeechModule)
      : null;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    speechModule = null;
  }
  return speechModule;
}

const voiceByTag = new Map<string, Promise<string | undefined>>();

/** The best installed voice for a language, enhanced quality first. */
function pickVoice(
  speech: SpeechModule,
  tag: string,
): Promise<string | undefined> {
  let pending = voiceByTag.get(tag);
  if (!pending) {
    pending = speech
      .getAvailableVoicesAsync()
      .then((voices) => {
        const base = tag.split("-")[0]?.toLowerCase() ?? "";
        const matches = voices.filter((voice) =>
          voice.language.toLowerCase().replace("_", "-").startsWith(base),
        );
        const rank = (voice: (typeof voices)[number]) =>
          (voice.language.replace("_", "-").toLowerCase() === tag.toLowerCase()
            ? 2
            : 0) + (voice.quality === speech.VoiceQuality.Enhanced ? 1 : 0);
        return matches.sort((a, b) => rank(b) - rank(a))[0]?.identifier;
      })
      .catch(() => undefined);
    voiceByTag.set(tag, pending);
  }
  return pending;
}

export type SpeechStatus = "idle" | "playing" | "paused";

export function useArticleSpeech(options: {
  chunks: string[];
  language: AppLanguage;
  contentId?: string;
  mode: "explainer" | "opinions" | "source";
}) {
  const { chunks, language, contentId, mode } = options;
  const available = loadSpeech() !== null;
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [index, setIndex] = useState(0);

  // Every stop bumps the session so a late `onDone` from the previous chunk
  // cannot restart playback.
  const session = useRef(0);
  const chunksRef = useRef(chunks);
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);
  const indexRef = useRef(0);

  const halt = useCallback(() => {
    session.current += 1;
    void loadSpeech()?.stop();
  }, []);

  const speakFrom = useCallback(
    async (start: number) => {
      const speech = loadSpeech();
      if (!speech) return;
      halt();
      const mine = session.current;
      const tag = speechLanguageTag(language);
      const voice = await pickVoice(speech, tag);
      if (mine !== session.current) return;

      const speakAt = (i: number) => {
        if (mine !== session.current) return;
        const text = chunksRef.current[i];
        if (text === undefined) {
          indexRef.current = 0;
          setIndex(0);
          setStatus("idle");
          return;
        }
        indexRef.current = i;
        setIndex(i);
        speech.speak(text, {
          language: tag,
          voice,
          onDone: () => speakAt(i + 1),
          onError: () => {
            if (mine !== session.current) return;
            setStatus("idle");
          },
        });
      };
      setStatus("playing");
      speakAt(start);
    },
    [halt, language],
  );

  const play = useCallback(() => {
    posthog.capture("article_listen_started", {
      content_id: contentId ?? null,
      language,
      parts: chunksRef.current.length,
    });
    void speakFrom(0);
  }, [contentId, language, speakFrom]);

  const pause = useCallback(() => {
    halt();
    setStatus("paused");
  }, [halt]);

  const resume = useCallback(() => {
    void speakFrom(indexRef.current);
  }, [speakFrom]);

  const stop = useCallback(() => {
    halt();
    indexRef.current = 0;
    setIndex(0);
    setStatus("idle");
  }, [halt]);

  // New text (mode or language switch) invalidates the current reading.
  useEffect(() => stop, [contentId, mode, language, chunks, stop]);

  return {
    available: available && chunks.length > 0,
    status,
    index,
    total: chunks.length,
    play,
    pause,
    resume,
    stop,
  };
}
